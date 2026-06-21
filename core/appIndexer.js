import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { getApps, getProfiles, getWorkspaces, readDb } from '../storage/db.js';
import { inferAliases, inferCategory } from './categoryEngine.js';

export const DEX_DIR = path.join(os.homedir(), '.dex');
export const SEARCH_INDEX_PATH = path.join(DEX_DIR, 'searchIndex.json');
export const OS_APPS_CACHE_PATH = path.join(DEX_DIR, 'osAppsCache.json');
export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const OS_APPS_CACHE_VERSION = 2;

const COMMAND_DEFINITIONS = [
  ['help', 'Show help menu and available commands'],
  ['launch', 'Launch apps, OS apps, or workspaces'],
  ['create', 'Create a desktop web app shortcut'],
  ['update', 'Update a registered app'],
  ['list', 'List registered web apps'],
  ['search', 'Search apps, workspaces, snapshots, and commands'],
  ['remove', 'Remove a registered app'],
  ['recent', 'Show recently launched apps'],
  ['stats', 'Show launch statistics'],
  ['info', 'Show app details'],
  ['export', 'Export apps database'],
  ['import', 'Import apps database'],
  ['suggest', 'Suggest unused apps'],
  ['clean', 'Interactively remove unused apps'],
  ['summarize', 'Show weekly launch summary'],
  ['workspace', 'Manage workspaces'],
  ['snapshot', 'Save and restore snapshots'],
  ['capture', 'Capture live browser tabs'],
  ['serve', 'Serve dashboard assets'],
  ['profile', 'Manage and launch profiles']
];

const WINDOWS_SYSTEM_APPS = [
  {
    name: 'File Explorer',
    path: 'explorer.exe',
    aliases: ['files', 'explorer', 'file explorer', 'files explorer', 'file manager', 'folders', 'this pc'],
    category: 'System'
  },
  {
    name: 'Settings',
    path: 'ms-settings:',
    aliases: ['settings', 'preferences', 'control panel'],
    category: 'System'
  },
  {
    name: 'Task Manager',
    path: 'taskmgr.exe',
    aliases: ['task manager', 'processes'],
    category: 'System'
  },
  {
    name: 'Calculator',
    path: 'calc.exe',
    aliases: ['calculator', 'calc'],
    category: 'System'
  },
  {
    name: 'Notepad',
    path: 'notepad.exe',
    aliases: ['notes', 'text editor'],
    category: 'Productivity'
  }
];

function getSystemIntentApps() {
  return os.platform() === 'win32' ? WINDOWS_SYSTEM_APPS : [];
}

const NOISY_SHORTCUT_TERMS = [
  'uninstall',
  'reset preferences',
  'reset cache',
  'cache files',
  'safe mode',
  'readme',
  'license',
  'help',
  'frequently asked questions',
  'faqs',
  'release notes',
  'documentation',
  'installation notes',
  'jit debugger',
  'script debugging',
  'coreeditorfonts',
  'filetracker',
  'protocolhandler',
  'protocolselectormsi',
  'devenvmsi',
  'msi'
];

function ensureDexDir() {
  if (!fs.existsSync(DEX_DIR)) {
    fs.mkdirSync(DEX_DIR, { recursive: true });
  }
}

function isFresh(filePath, maxAgeMs = CACHE_MAX_AGE_MS) {
  try {
    const stat = fs.statSync(filePath);
    return Date.now() - stat.mtimeMs < maxAgeMs;
  } catch (_) {
    return false;
  }
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\.(exe|app|desktop|lnk)$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compactKey(value) {
  return normalizeName(value).replace(/\s+/g, '');
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDexDir();
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

function stableSignatureParts(apps) {
  return apps
    .map(app => [
      normalizeName(app.name),
      normalizeName(app.path || app.appId || app.command || ''),
      normalizeName(app.source || '')
    ].join('|'))
    .sort();
}

function createAppsSignature(apps) {
  const parts = stableSignatureParts(apps);
  let hash = 0;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      hash = ((hash << 5) - hash + part.charCodeAt(i)) | 0;
    }
  }
  return {
    platform: os.platform(),
    count: apps.length,
    hash: String(hash >>> 0)
  };
}

function normalizeCachePayload(payload) {
  if (Array.isArray(payload)) {
    return {
      version: 1,
      platform: os.platform(),
      updatedAt: 0,
      signature: createAppsSignature(payload),
      apps: payload
    };
  }

  if (!payload || !Array.isArray(payload.apps)) {
    return {
      version: OS_APPS_CACHE_VERSION,
      platform: os.platform(),
      updatedAt: 0,
      signature: null,
      apps: []
    };
  }

  return payload;
}

function writeOsAppsCache(apps) {
  writeJson(OS_APPS_CACHE_PATH, {
    version: OS_APPS_CACHE_VERSION,
    platform: os.platform(),
    updatedAt: Date.now(),
    signature: createAppsSignature(apps),
    changeSignal: getQuickOsChangeSignal(),
    apps
  });
}

function getShortcutDirectoryStamp(dir) {
  if (!fs.existsSync(dir)) return 'missing';
  let count = 0;
  let latest = 0;
  const walk = current => {
    try {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && /\.(lnk|desktop)$/i.test(entry.name)) {
          count += 1;
          latest = Math.max(latest, fs.statSync(fullPath).mtimeMs);
        }
      }
    } catch (_) {}
  };
  walk(dir);
  return `${count}:${Math.floor(latest)}`;
}

function getQuickOsChangeSignal() {
  const platform = os.platform();

  if (platform === 'win32') {
    const startApps = runPowerShellJson('Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Compress');
    const installedPrograms = runPowerShellJson(`$paths=@('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'); $items=foreach($p in $paths){Get-ItemProperty $p -ErrorAction SilentlyContinue | Where-Object {$_.DisplayName} | Select-Object DisplayName,DisplayVersion}; $items | ConvertTo-Json -Compress`);
    const shortcutStamps = [
      path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Microsoft\\Windows\\Start Menu\\Programs'),
      path.join(os.homedir(), 'AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs'),
      path.join(os.homedir(), 'Desktop'),
      path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Desktop')
    ].map(getShortcutDirectoryStamp);

    return createAppsSignature([
      ...startApps.map(app => ({ name: app.Name, path: app.AppID, source: 'Get-StartApps' })),
      ...installedPrograms.map(app => ({ name: app.DisplayName, path: app.DisplayVersion, source: 'Installed Programs Registry' })),
      ...shortcutStamps.map((stamp, index) => ({ name: `shortcut-dir-${index}`, path: stamp, source: 'Shortcut Directories' }))
    ]);
  }

  if (platform === 'darwin') {
    const dirs = ['/Applications', '/System/Applications', '/System/Applications/Utilities', path.join(os.homedir(), 'Applications')];
    return createAppsSignature(dirs.map(dir => ({ name: dir, path: getShortcutDirectoryStamp(dir), source: 'Application Directories' })));
  }

  const dirs = [
    path.join(os.homedir(), '.local/share/applications'),
    '/usr/local/share/applications',
    '/usr/share/applications',
    '/var/lib/flatpak/exports/share/applications',
    path.join(os.homedir(), '.local/share/flatpak/exports/share/applications'),
    '/var/lib/snapd/desktop/applications'
  ];
  return createAppsSignature(dirs.map(dir => ({ name: dir, path: getShortcutDirectoryStamp(dir), source: 'Desktop File Directories' })));
}

function signaturesEqual(a, b) {
  return Boolean(a && b && a.platform === b.platform && a.count === b.count && a.hash === b.hash);
}

function runPowerShellJson(script) {
  try {
    const output = execFileSync(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000, windowsHide: true }
    ).trim();
    if (!output) return [];
    const parsed = JSON.parse(output);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (_) {
    return [];
  }
}

function escapePowerShellSingleQuoted(value) {
  return String(value || '').replace(/'/g, "''");
}

function getWindowsShortcutsMetadata(shortcutPaths) {
  if (!shortcutPaths.length) return new Map();
  try {
    const encodedPaths = shortcutPaths.map(escapePowerShellSingleQuoted).map(value => `'${value}'`).join(',');
    const script = `$w=New-Object -ComObject WScript.Shell; $paths=@(${encodedPaths}); $items=foreach($p in $paths){try{$s=$w.CreateShortcut($p); [pscustomobject]@{ShortcutPath=$p;TargetPath=$s.TargetPath;Arguments=$s.Arguments;WorkingDirectory=$s.WorkingDirectory;Description=$s.Description;IconLocation=$s.IconLocation}}catch{}}; $items | ConvertTo-Json -Compress`;
    const rows = runPowerShellJson(script);
    return new Map(rows.map(shortcut => [shortcut.ShortcutPath, {
      targetPath: shortcut.TargetPath || '',
      arguments: shortcut.Arguments || '',
      workingDirectory: shortcut.WorkingDirectory || '',
      description: shortcut.Description || '',
      iconPath: shortcut.IconLocation || ''
    }]));
  } catch (_) {
    return new Map();
  }
}

function isLikelyNonLaunchable(candidate) {
  const text = normalizeName([
    candidate.name,
    candidate.description,
    candidate.path,
    candidate.targetPath,
    candidate.arguments,
    candidate.uninstallString
  ].filter(Boolean).join(' '));

  return NOISY_SHORTCUT_TERMS.some(term => text.includes(term));
}

function mergeApp(appsMap, candidate) {
  if (!candidate?.name) return;
  const name = candidate.name.replace(/\s+/g, ' ').trim();
  if (!name) return;
  if (isLikelyNonLaunchable({ ...candidate, name })) return;

  const pathValue = candidate.path || candidate.appId || candidate.command || '';
  const key = compactKey(name) || compactKey(pathValue);
  if (!key) return;

  const existing = appsMap.get(key);
  const next = {
    name,
    path: candidate.path || candidate.appId || candidate.command || null,
    appId: candidate.appId || null,
    command: candidate.command || null,
    aliases: candidate.aliases || [],
    category: candidate.category || '',
    publisher: candidate.publisher || '',
    version: candidate.version || '',
    description: candidate.description || '',
    installLocation: candidate.installLocation || '',
    iconPath: candidate.iconPath || '',
    uninstallString: candidate.uninstallString || '',
    targetPath: candidate.targetPath || '',
    arguments: candidate.arguments || '',
    workingDirectory: candidate.workingDirectory || '',
    productName: candidate.productName || '',
    source: candidate.source || 'unknown',
    sourcePriority: candidate.sourcePriority || 99
  };

  if (!existing || next.sourcePriority < existing.sourcePriority) {
    appsMap.set(key, { ...existing, ...next, sources: [...new Set([...(existing?.sources || []), next.source])] });
    return;
  }

  appsMap.set(key, {
    ...existing,
    path: existing.path || next.path,
    appId: existing.appId || next.appId,
    command: existing.command || next.command,
    aliases: [...new Set([...(existing.aliases || []), ...(next.aliases || [])])],
    category: existing.category || next.category,
    publisher: existing.publisher || next.publisher,
    version: existing.version || next.version,
    description: existing.description || next.description,
    installLocation: existing.installLocation || next.installLocation,
    iconPath: existing.iconPath || next.iconPath,
    uninstallString: existing.uninstallString || next.uninstallString,
    targetPath: existing.targetPath || next.targetPath,
    arguments: existing.arguments || next.arguments,
    workingDirectory: existing.workingDirectory || next.workingDirectory,
    productName: existing.productName || next.productName,
    sources: [...new Set([...(existing.sources || []), next.source])]
  });
}

function walkShortcuts(dir, appsMap, source, sourcePriority) {
  if (!fs.existsSync(dir)) return;
  const shortcuts = [];
  const collect = current => {
    try {
      const items = fs.readdirSync(current, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(current, item.name);
        if (item.isDirectory()) {
          collect(fullPath);
        } else if (item.isFile() && item.name.toLowerCase().endsWith('.lnk')) {
          shortcuts.push(fullPath);
        }
      }
    } catch (_) {}
  };

  collect(dir);
  const metadataByPath = getWindowsShortcutsMetadata(shortcuts);

  try {
    for (const fullPath of shortcuts) {
      const shortcutMetadata = metadataByPath.get(fullPath) || {};
      mergeApp(appsMap, {
        name: path.basename(fullPath, '.lnk'),
        path: shortcutMetadata.targetPath || fullPath,
        aliases: [path.basename(fullPath, '.lnk')],
        ...shortcutMetadata,
        source,
        sourcePriority
      });
    }
  } catch (_) {}
}

function queryWindowsStartApps(appsMap) {
  const script = `Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Compress`;
  for (const app of runPowerShellJson(script)) {
    mergeApp(appsMap, {
      name: app.Name,
      appId: app.AppID,
      path: app.AppID ? `shell:AppsFolder\\${app.AppID}` : null,
      description: app.AppID || '',
      source: 'Get-StartApps',
      sourcePriority: 1
    });
  }
}

function queryWindowsAppPaths(appsMap) {
  const script = `$paths=@('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\*','HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\*','HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\*');
$items=foreach($p in $paths){Get-ItemProperty $p -ErrorAction SilentlyContinue | ForEach-Object {[pscustomobject]@{Name=($_.PSChildName -replace '\\.exe$','');Path=$_.'(default)';InstallLocation=$_.Path}}};
$items | Where-Object {$_.Name -and $_.Path} | ConvertTo-Json -Compress`;
  for (const app of runPowerShellJson(script)) {
    mergeApp(appsMap, {
      name: app.Name,
      path: app.Path,
      installLocation: app.InstallLocation || '',
      source: 'Registry App Paths',
      sourcePriority: 2
    });
  }
}

function queryWindowsInstalledPrograms(appsMap) {
  const script = `$paths=@('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*');
$items=foreach($p in $paths){Get-ItemProperty $p -ErrorAction SilentlyContinue | ForEach-Object {[pscustomobject]@{Name=$_.DisplayName;Path=$_.DisplayIcon;InstallLocation=$_.InstallLocation;Publisher=$_.Publisher;Version=$_.DisplayVersion;Description=$_.Comments;UninstallString=$_.UninstallString;IconPath=$_.DisplayIcon;SystemComponent=$_.SystemComponent;ReleaseType=$_.ReleaseType}}};
$items | Where-Object {$_.Name} | ConvertTo-Json -Compress`;
  for (const app of runPowerShellJson(script)) {
    if (app.SystemComponent === 1 || app.ReleaseType) continue;
    let programPath = app.Path || app.InstallLocation || null;
    if (programPath) {
      programPath = String(programPath).replace(/^"|"$/g, '').split(',')[0];
    }
    mergeApp(appsMap, {
      name: app.Name,
      path: programPath,
      publisher: app.Publisher || '',
      version: app.Version || '',
      description: app.Description || '',
      installLocation: app.InstallLocation || '',
      iconPath: app.IconPath || '',
      uninstallString: app.UninstallString || '',
      source: 'Installed Programs Registry',
      sourcePriority: 3
    });
  }
}

function scanWindowsApps() {
  const appsMap = new Map();
  WINDOWS_SYSTEM_APPS.forEach(app => mergeApp(appsMap, { ...app, source: 'Windows System', sourcePriority: 0 }));
  queryWindowsStartApps(appsMap);
  queryWindowsAppPaths(appsMap);
  queryWindowsInstalledPrograms(appsMap);

  const startMenuPaths = [
    path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Microsoft\\Windows\\Start Menu\\Programs'),
    path.join(os.homedir(), 'AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs')
  ];
  startMenuPaths.forEach(dir => walkShortcuts(dir, appsMap, 'Start Menu Shortcuts', 4));

  const desktopPaths = [
    path.join(os.homedir(), 'Desktop'),
    path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Desktop')
  ];
  desktopPaths.forEach(dir => walkShortcuts(dir, appsMap, 'Desktop Shortcuts', 5));

  return Array.from(appsMap.values());
}

function walkMacApps(dir, appsMap) {
  if (!fs.existsSync(dir)) return;
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory() && item.name.endsWith('.app')) {
        const plistPath = path.join(fullPath, 'Contents', 'Info.plist');
        let metadata = {};
        if (fs.existsSync(plistPath)) {
          try {
            const content = fs.readFileSync(plistPath, 'utf-8');
            const getPlistValue = key => {
              const match = content.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`));
              return match ? match[1] : '';
            };
            metadata = {
              description: getPlistValue('CFBundleGetInfoString') || getPlistValue('NSHumanReadableCopyright'),
              version: getPlistValue('CFBundleShortVersionString'),
              productName: getPlistValue('CFBundleName'),
              publisher: getPlistValue('CFBundleIdentifier').split('.').slice(0, 2).join('.')
            };
          } catch (_) {}
        }
        mergeApp(appsMap, { name: metadata.productName || path.basename(item.name, '.app'), path: fullPath, ...metadata, source: 'Applications', sourcePriority: 1 });
      } else if (item.isDirectory()) {
        walkMacApps(fullPath, appsMap);
      }
    }
  } catch (_) {}
}

function parseDesktopFile(desktopPath) {
  try {
    const content = fs.readFileSync(desktopPath, 'utf-8');
    const entry = {};
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const idx = line.indexOf('=');
      const key = line.slice(0, idx);
      if (['Name', 'Exec', 'NoDisplay', 'Hidden', 'Comment', 'Categories', 'Icon', 'StartupWMClass'].includes(key)) {
        entry[key] = line.slice(idx + 1);
      }
    }
    if (!entry.Name || !entry.Exec || entry.NoDisplay === 'true' || entry.Hidden === 'true') return null;
    return entry;
  } catch (_) {
    return null;
  }
}

function walkDesktopFiles(dir, appsMap) {
  if (!fs.existsSync(dir)) return;
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        walkDesktopFiles(fullPath, appsMap);
      } else if (item.isFile() && item.name.endsWith('.desktop')) {
        const entry = parseDesktopFile(fullPath);
        if (entry) mergeApp(appsMap, {
          name: entry.Name,
          path: fullPath,
          command: entry.Exec,
          description: entry.Comment || '',
          category: entry.Categories || '',
          iconPath: entry.Icon || '',
          aliases: [entry.StartupWMClass, ...(entry.Categories || '').split(';')].filter(Boolean),
          source: 'Desktop Files',
          sourcePriority: 1
        });
      }
    }
  } catch (_) {}
}

export function scanOsApplications() {
  const platform = os.platform();
  if (platform === 'win32') return scanWindowsApps();

  const appsMap = new Map();
  if (platform === 'darwin') {
    ['/Applications', '/System/Applications', '/System/Applications/Utilities', path.join(os.homedir(), 'Applications')]
      .forEach(dir => walkMacApps(dir, appsMap));
    return Array.from(appsMap.values());
  }

  [
    path.join(os.homedir(), '.local/share/applications'),
    '/usr/local/share/applications',
    '/usr/share/applications',
    '/var/lib/flatpak/exports/share/applications',
    path.join(os.homedir(), '.local/share/flatpak/exports/share/applications'),
    '/var/lib/snapd/desktop/applications'
  ].forEach(dir => walkDesktopFiles(dir, appsMap));
  return Array.from(appsMap.values());
}

export function getCachedOsApplications(options = {}) {
  const payload = normalizeCachePayload(readJson(OS_APPS_CACHE_PATH, null));

  if (!options.force && payload.apps.length > 0 && isFresh(OS_APPS_CACHE_PATH)) {
    const currentSignal = getQuickOsChangeSignal();
    if (payload.version === OS_APPS_CACHE_VERSION && signaturesEqual(payload.changeSignal, currentSignal)) {
      return payload.apps;
    }
  }

  const apps = scanOsApplications();
  writeOsAppsCache(apps);
  return apps;
}

export function osAppsCacheIsCurrent() {
  const payload = normalizeCachePayload(readJson(OS_APPS_CACHE_PATH, null));
  if (payload.apps.length === 0 || !isFresh(OS_APPS_CACHE_PATH)) return false;
  if (payload.version !== OS_APPS_CACHE_VERSION) return false;
  return signaturesEqual(payload.changeSignal, getQuickOsChangeSignal());
}

function toIndexItem({ id, name, type, path: itemPath, aliases = [], category = '', launchCount = 0, lastUsed = 0, meta = {} }) {
  const inferredCategory = inferCategory(name, category);
  const inferredAliases = inferAliases(name, type, inferredCategory);
  return {
    id,
    name,
    type,
    path: itemPath || '',
    aliases: Array.from(new Set([...aliases, ...inferredAliases])).filter(Boolean),
    category: inferredCategory,
    launchCount: Number(launchCount) || 0,
    lastUsed: Number(lastUsed) || 0,
    ...meta
  };
}

export function buildCatalog(options = {}) {
  const items = [];
  const db = readDb();

  for (const app of getApps()) {
    if (app.hidden && !options.includeHidden) continue;
    const type = app.type === 'os' ? 'os-app' : 'web-app';
    items.push(toIndexItem({
      id: `${type}:${app.id}`,
      name: app.name,
      type,
      path: app.path || app.url || '',
      category: app.category,
      launchCount: app.launches,
      lastUsed: app.lastOpened ? new Date(app.lastOpened).getTime() : 0,
      meta: { appId: app.id, url: app.url || null }
    }));
  }

  for (const app of getCachedOsApplications({ force: options.force })) {
    items.push(toIndexItem({
      id: `os-app:${compactKey(app.name)}`,
      name: app.name,
      type: 'os-app',
      path: app.path,
      aliases: [app.command, app.appId, ...(app.aliases || [])].filter(Boolean),
      category: app.category,
      meta: {
        appId: app.appId || null,
        command: app.command || null,
        source: app.source || null,
        publisher: app.publisher || '',
        version: app.version || '',
        description: app.description || '',
        installLocation: app.installLocation || '',
        iconPath: app.iconPath || '',
        targetPath: app.targetPath || '',
        arguments: app.arguments || '',
        workingDirectory: app.workingDirectory || '',
        productName: app.productName || '',
        sources: app.sources || []
      }
    }));
  }

  for (const app of getSystemIntentApps()) {
    items.push(toIndexItem({
      id: `os-app:intent:${compactKey(app.name)}`,
      name: app.name,
      type: 'os-app',
      path: app.path,
      aliases: app.aliases,
      category: app.category,
      meta: { appId: null, command: app.path, source: 'System Intent' }
    }));
  }

  for (const ws of Object.values(getWorkspaces())) {
    items.push(toIndexItem({
      id: `workspace:${ws.id}`,
      name: ws.name,
      type: 'workspace',
      path: ws.id,
      aliases: ['workspace', ...(ws.apps || [])],
      meta: { workspaceId: ws.id }
    }));

    if (ws.snapshot) {
      items.push(toIndexItem({
        id: `snapshot:${ws.id}`,
        name: `${ws.name} snapshot`,
        type: 'snapshot',
        path: ws.id,
        aliases: ['snapshot', 'restore', ws.name],
        meta: { workspaceId: ws.id }
      }));
    }
  }

  for (const profile of Object.values(getProfiles())) {
    items.push(toIndexItem({
      id: `profile:${profile.id}`,
      name: profile.name,
      type: 'profile',
      path: profile.id,
      aliases: ['profile', 'mode', ...(profile.workspaces || []), ...(profile.workflows || []).map(flow => flow.name || flow.command || '').filter(Boolean)],
      category: 'Profile',
      launchCount: profile.launches,
      lastUsed: profile.lastOpened ? new Date(profile.lastOpened).getTime() : 0,
      meta: { profileId: profile.id }
    }));
  }

  for (const [name, description] of COMMAND_DEFINITIONS) {
    items.push(toIndexItem({
      id: `command:${name}`,
      name,
      type: 'command',
      path: name,
      aliases: description.split(/\s+/).map(word => word.toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean),
      category: 'Command'
    }));
  }

  const previous = readJson(SEARCH_INDEX_PATH, []);
  const previousById = new Map(previous.map(item => [item.id, item]));
  const deduped = new Map();
  for (const item of items) {
    const existing = deduped.get(item.id) || previousById.get(item.id);
    deduped.set(item.id, {
      ...item,
      launchCount: Math.max(item.launchCount || 0, existing?.launchCount || 0),
      lastUsed: Math.max(item.lastUsed || 0, existing?.lastUsed || 0)
    });
  }

  return Array.from(deduped.values());
}

export function readSearchIndex() {
  return readJson(SEARCH_INDEX_PATH, []);
}

export function writeSearchIndex(items) {
  writeJson(SEARCH_INDEX_PATH, items);
}

export function searchIndexIsFresh() {
  return fs.existsSync(SEARCH_INDEX_PATH) && isFresh(SEARCH_INDEX_PATH) && osAppsCacheIsCurrent();
}
