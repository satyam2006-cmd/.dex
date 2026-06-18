import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, execSync, execFileSync } from 'child_process';

const PLATFORM = os.platform();

function normalizeAppName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\.(exe|app|desktop)$/i, '')
    .replace(/[^a-z0-9]+/g, '');
}

function queryAliases(query) {
  const normalized = normalizeAppName(query);
  const aliases = new Set([normalized]);

  if (['vscode', 'vs', 'code'].includes(normalized)) {
    aliases.add('visualstudiocode');
    aliases.add('code');
    aliases.add('codeinsiders');
    aliases.add('visualstudiocodeinsiders');
    aliases.add('vscodium');
  }

  if (normalized === 'terminal' || normalized === 'wt') {
    aliases.add('windowsterminal');
    aliases.add('terminal');
    aliases.add('gnometerminal');
    aliases.add('konsole');
    aliases.add('xfce4terminal');
    aliases.add('xterm');
  }

  return Array.from(aliases).filter(Boolean);
}

function commandFallbacks(query) {
  const normalized = normalizeAppName(query);
  if (['vscode', 'visualstudiocode', 'vs', 'code'].includes(normalized)) return [{ command: 'code', args: ['-n'] }];
  if (['vscodeinsiders', 'visualstudiocodeinsiders', 'codeinsiders'].includes(normalized)) return [{ command: 'code-insiders', args: ['-n'] }];
  if (normalized === 'terminal' || normalized === 'windowsterminal' || normalized === 'wt') {
    if (PLATFORM === 'win32') return [{ command: 'wt', args: [] }];
    if (PLATFORM === 'darwin') return [{ command: 'open', args: ['-a', 'Terminal'] }];
    return [
      { command: 'x-terminal-emulator', args: [] },
      { command: 'gnome-terminal', args: [] },
      { command: 'konsole', args: [] },
      { command: 'xfce4-terminal', args: [] },
      { command: 'xterm', args: [] }
    ];
  }
  if (PLATFORM === 'darwin') {
    return [
      { command: 'open', args: ['-a', query] },
      { command: query, args: [] }
    ];
  }
  return [{ command: query, args: [] }];
}

function executableFallbacks(query) {
  const normalized = normalizeAppName(query);
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData\\Local');

  if (PLATFORM === 'win32') {
    if (['vscode', 'visualstudiocode', 'vs', 'code'].includes(normalized)) {
      return [{ path: path.join(localAppData, 'Programs\\Microsoft VS Code\\Code.exe'), args: '-n' }];
    }

    if (['vscodeinsiders', 'visualstudiocodeinsiders', 'codeinsiders'].includes(normalized)) {
      return [{ path: path.join(localAppData, 'Programs\\Microsoft VS Code Insiders\\Code - Insiders.exe'), args: '-n' }];
    }
  }

  if (PLATFORM === 'darwin') {
    if (['vscode', 'visualstudiocode', 'vs', 'code'].includes(normalized)) {
      return [{ path: '/Applications/Visual Studio Code.app', args: '' }];
    }

    if (['vscodeinsiders', 'visualstudiocodeinsiders', 'codeinsiders'].includes(normalized)) {
      return [{ path: '/Applications/Visual Studio Code - Insiders.app', args: '' }];
    }
  }

  return [];
}

function escapePowerShellSingleQuoted(value) {
  return String(value).replace(/'/g, "''");
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
      const value = line.slice(idx + 1);
      if (key === 'Name' || key === 'Exec' || key === 'NoDisplay' || key === 'Hidden') {
        entry[key] = value;
      }
    }
    if (!entry.Name || !entry.Exec || entry.NoDisplay === 'true' || entry.Hidden === 'true') {
      return null;
    }
    return entry;
  } catch (_) {
    return null;
  }
}

function splitCommandLine(commandLine) {
  const args = [];
  let current = '';
  let quote = null;

  for (const char of String(commandLine || '')) {
    if ((char === '"' || char === "'") && !quote) {
      quote = char;
    } else if (char === quote) {
      quote = null;
    } else if (/\s/.test(char) && !quote) {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) args.push(current);
  return args;
}

function launchDesktopFile(desktopPath) {
  const entry = parseDesktopFile(desktopPath);
  if (!entry) return Promise.resolve(false);

  const cleanedExec = entry.Exec
    .replace(/%[fFuUdDnNickvm]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const [command, ...args] = splitCommandLine(cleanedExec);
  if (!command) return Promise.resolve(false);

  return launchSystemCommand(command, args);
}

function getShortcutInfo(shortcutPath) {
  try {
    const escapedPath = escapePowerShellSingleQuoted(shortcutPath);
    const command = `$w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut('${escapedPath}'); [pscustomobject]@{TargetPath=$s.TargetPath; Arguments=$s.Arguments; WorkingDirectory=$s.WorkingDirectory} | ConvertTo-Json -Compress`;
    const output = execSync(`powershell -NoProfile -Command "${command}"`, { encoding: 'utf8' }).trim();
    return output ? JSON.parse(output) : null;
  } catch (_) {
    return null;
  }
}

function startPowerShellProcess(filePath, args = '', workingDirectory = '') {
  return new Promise((resolve) => {
    const escapedPath = escapePowerShellSingleQuoted(filePath);
    const escapedArgs = escapePowerShellSingleQuoted(args || '');
    const escapedWorkingDirectory = escapePowerShellSingleQuoted(workingDirectory || '');
    let command = `$ErrorActionPreference='Stop'; Start-Process -FilePath '${escapedPath}'`;

    if (args) {
      command += ` -ArgumentList '${escapedArgs}'`;
    }
    if (workingDirectory && fs.existsSync(workingDirectory)) {
      command += ` -WorkingDirectory '${escapedWorkingDirectory}'`;
    }

    const ps = spawn('powershell', ['-NoProfile', '-Command', command], {
      stdio: 'ignore'
    });

    ps.on('error', () => resolve(false));
    ps.on('exit', (code) => resolve(code === 0));
  });
}

/**
 * Recursively walks a directory and collects all .lnk (shortcut) files.
 */
function walkShortcuts(dir, appsMap = {}) {
  if (!fs.existsSync(dir)) return appsMap;
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        walkShortcuts(fullPath, appsMap);
      } else if (item.isFile() && item.name.endsWith('.lnk')) {
        const appName = path.basename(item.name, '.lnk');
        // If there's a collision, favor user profile shortcuts over system ones
        const key = appName.toLowerCase();
        if (!appsMap[key] || fullPath.includes(os.homedir())) {
          appsMap[key] = {
            name: appName,
            path: fullPath
          };
        }
      }
    }
  } catch (_) {}
  return appsMap;
}

function walkMacApps(dir, appsMap = {}) {
  if (!fs.existsSync(dir)) return appsMap;
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory() && item.name.endsWith('.app')) {
        const appName = path.basename(item.name, '.app');
        const key = appName.toLowerCase();
        appsMap[key] = { name: appName, path: fullPath, type: 'app' };
      } else if (item.isDirectory()) {
        walkMacApps(fullPath, appsMap);
      }
    }
  } catch (_) {}
  return appsMap;
}

function walkDesktopFiles(dir, appsMap = {}) {
  if (!fs.existsSync(dir)) return appsMap;
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        walkDesktopFiles(fullPath, appsMap);
      } else if (item.isFile() && item.name.endsWith('.desktop')) {
        const entry = parseDesktopFile(fullPath);
        if (!entry) continue;
        const key = entry.Name.toLowerCase();
        if (!appsMap[key] || fullPath.startsWith(os.homedir())) {
          appsMap[key] = {
            name: entry.Name,
            path: fullPath,
            type: 'desktop',
            exec: entry.Exec
          };
        }
      }
    }
  } catch (_) {}
  return appsMap;
}

/**
 * Scans native app locations for the current OS and returns a map of installed apps.
 */
export function scanOsApps() {
  const appsMap = {};

  if (PLATFORM === 'darwin') {
    [
      '/Applications',
      '/System/Applications',
      '/System/Applications/Utilities',
      path.join(os.homedir(), 'Applications')
    ].forEach(dir => walkMacApps(dir, appsMap));
    return appsMap;
  }

  if (PLATFORM === 'linux') {
    [
      path.join(os.homedir(), '.local/share/applications'),
      '/usr/local/share/applications',
      '/usr/share/applications',
      '/var/lib/flatpak/exports/share/applications',
      path.join(os.homedir(), '.local/share/flatpak/exports/share/applications'),
      '/var/lib/snapd/desktop/applications'
    ].forEach(dir => walkDesktopFiles(dir, appsMap));
    return appsMap;
  }

  const startMenuPaths = [
    path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Microsoft\\Windows\\Start Menu\\Programs'),
    path.join(os.homedir(), 'AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs')
  ];

  startMenuPaths.forEach(dir => walkShortcuts(dir, appsMap));
  return appsMap;
}

/**
 * Launches an app, shortcut, .desktop file, or executable path detached in the background.
 */
export function launchPath(filePath, args = '') {
  if (!filePath) return Promise.resolve(false);

  if (PLATFORM === 'darwin' && filePath.toLowerCase().endsWith('.app')) {
    return launchSystemCommand('open', ['-n', filePath]);
  }

  if (PLATFORM === 'linux' && filePath.toLowerCase().endsWith('.desktop')) {
    return launchDesktopFile(filePath);
  }

  if (PLATFORM === 'win32' && filePath.toLowerCase().endsWith('.lnk')) {
    const shortcut = getShortcutInfo(filePath);
    if (!shortcut?.TargetPath || !fs.existsSync(shortcut.TargetPath)) {
      return Promise.resolve(false);
    }
    return startPowerShellProcess(shortcut.TargetPath, shortcut.Arguments, shortcut.WorkingDirectory);
  }

  if (path.isAbsolute(filePath) && !fs.existsSync(filePath)) {
    return Promise.resolve(false);
  }

  if (PLATFORM === 'win32') {
    return startPowerShellProcess(filePath, args);
  }

  if (path.isAbsolute(filePath)) {
    return launchSystemCommand(filePath);
  }

  return launchSystemCommand(filePath);
}

/**
 * Launches a Windows shortcut (.lnk file) detached in the background using PowerShell.
 */
export function launchLnkFile(lnkPath) {
  return launchPath(lnkPath);
}

/**
 * Launches a system command or executable path in detached mode.
 */
export function launchSystemCommand(cmdName, cmdArgs = []) {
  return new Promise((resolve) => {
    const proc = spawn(cmdName, cmdArgs, {
      detached: true,
      stdio: 'ignore'
    });
    
    let started = true;
    proc.on('error', () => {
      started = false;
      resolve(false);
    });

    setTimeout(() => {
      if (started) {
        proc.unref();
        resolve(true);
      }
    }, 100);
  });
}

export function resolveOsApp(query) {
  const osApps = scanOsApps();
  const rawQuery = String(query || '').toLowerCase();
  const aliases = queryAliases(query);

  if (aliases.length === 0) return null;

  const entries = Object.values(osApps);
  return (
    osApps[rawQuery] ||
    entries.find(app => aliases.includes(normalizeAppName(app.name))) ||
    entries.find(app => aliases.some(alias => normalizeAppName(app.name).startsWith(alias))) ||
    entries.find(app => aliases.some(alias => normalizeAppName(app.name).includes(alias))) ||
    null
  );
}

export async function launchOsApp(query) {
  const app = resolveOsApp(query);
  if (app) {
    const success = await launchPath(app.path);
    if (success) {
      return { app, success: true };
    }
  }

  for (const executable of executableFallbacks(query)) {
    if (fs.existsSync(executable.path)) {
      const success = await launchPath(executable.path, executable.args);
      if (success) {
        return {
          app: { name: query, path: executable.path },
          success: true
        };
      }
    }
  }

  for (const fallback of commandFallbacks(query)) {
    const success = await launchSystemCommand(fallback.command, fallback.args);
    if (success) {
      return {
        app: { name: query, path: null },
        success: true
      };
    }
  }

  return { app: null, success: false };
}

export async function launchCapturedApp(app) {
  if (app?.path) {
    const success = await launchPath(app.path);
    if (success) return true;
  }

  if (app?.name) {
    const result = await launchOsApp(app.name);
    return result.success;
  }

  return false;
}

/**
 * Scans the OS for running GUI applications (visible windows) excluding system shells/overlays.
 */
export function getRunningGuiApps() {
  try {
    if (PLATFORM === 'darwin') {
      const script = `tell application "System Events" to get the name of every process whose background only is false`;
      const output = execFileSync('osascript', ['-e', script], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (!output) return [];
      const excludeList = ['finder', 'google chrome', 'microsoft edge', 'brave browser', 'opera', 'firefox'];
      return output
        .split(/\s*,\s*/)
        .filter(Boolean)
        .filter(name => !excludeList.includes(name.toLowerCase()))
        .map(name => ({ name, path: null, launchName: name }));
    }

    if (PLATFORM === 'linux') {
      let output = '';
      try {
        output = execSync('wmctrl -lx', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      } catch (_) {
        return [];
      }
      const excludeList = ['chrome', 'chromium', 'firefox', 'brave', 'opera', 'msedge'];
      const seen = new Map();
      output.split(/\r?\n/).forEach(line => {
        const parts = line.trim().split(/\s+/);
        const wmClass = parts[2] || '';
        const appName = wmClass.split('.').pop() || wmClass;
        if (appName && !excludeList.includes(appName.toLowerCase())) {
          seen.set(appName.toLowerCase(), { name: appName, path: null, launchName: appName });
        }
      });
      return Array.from(seen.values());
    }

    const psCmd = `Get-Process | Where-Object MainWindowTitle | Select-Object Name, Path | ConvertTo-Json`;
    const output = execSync(`powershell -NoProfile -Command "${psCmd}"`, { encoding: 'utf8' }).trim();
    if (!output) return [];

    let parsed = JSON.parse(output);
    if (!Array.isArray(parsed)) parsed = [parsed];

    // Filter out common OS/System overlays and browsers (which are snapshot-captured via tabs)
    const excludeList = [
      'explorer', 'applicationframehost', 'textinputhost', 'nvidia overlay',
      'aqauserps', 'chrome', 'msedge', 'brave', 'opera', 'firefox'
    ];

    return parsed
      .filter(app => app && app.Name && app.Path)
      .filter(app => !excludeList.includes(app.Name.toLowerCase()))
      .map(app => ({
        name: app.Name,
        path: app.Path,
        launchName: app.Name
      }));
  } catch (_) {
    return [];
  }
}

/**
 * Queries active Win32_Process command lines to identify open folders in VS Code.
 */
export function getRunningVsCodeFolders() {
  try {
    if (PLATFORM !== 'win32') {
      return [];
    }

    const psCmd = `$ErrorActionPreference='SilentlyContinue'; Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -in @('Code.exe','Code - Insiders.exe','VSCodium.exe') } | Select-Object CommandLine | ConvertTo-Json`;
    const output = execSync(`powershell -NoProfile -Command "${psCmd}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (!output) return [];

    let parsed = JSON.parse(output);
    if (!Array.isArray(parsed)) parsed = [parsed];

    const folders = new Set();
    const pathRegex = /(?:"|')?([a-zA-Z]:\\[^"']+)(?:"|')?/g;

    for (const proc of parsed) {
      if (!proc || !proc.CommandLine) continue;
      let match;
      while ((match = pathRegex.exec(proc.CommandLine)) !== null) {
        const potentialPath = match[1].trim();
        try {
          if (fs.existsSync(potentialPath) && fs.statSync(potentialPath).isDirectory()) {
            // Exclude VS Code resources, extensions, and standard system paths
            if (!potentialPath.toLowerCase().includes('.vscode') &&
                !potentialPath.toLowerCase().includes('microsoft vs code') &&
                !potentialPath.toLowerCase().includes('windows\\system32')) {
              folders.add(potentialPath);
            }
          }
        } catch (_) {}
      }
    }
    return Array.from(folders);
  } catch (_) {
    return [];
  }
}
