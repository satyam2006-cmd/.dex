import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, execSync } from 'child_process';

function normalizeAppName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\.exe$/i, '')
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
  }

  return Array.from(aliases).filter(Boolean);
}

function commandFallbacks(query) {
  const normalized = normalizeAppName(query);
  if (['vscode', 'visualstudiocode', 'vs', 'code'].includes(normalized)) return [{ command: 'code', args: ['-n'] }];
  if (['vscodeinsiders', 'visualstudiocodeinsiders', 'codeinsiders'].includes(normalized)) return [{ command: 'code-insiders', args: ['-n'] }];
  if (normalized === 'terminal' || normalized === 'windowsterminal' || normalized === 'wt') return [{ command: 'wt', args: [] }];
  return [{ command: query, args: [] }];
}

function executableFallbacks(query) {
  const normalized = normalizeAppName(query);
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData\\Local');

  if (['vscode', 'visualstudiocode', 'vs', 'code'].includes(normalized)) {
    return [{ path: path.join(localAppData, 'Programs\\Microsoft VS Code\\Code.exe'), args: '-n' }];
  }

  if (['vscodeinsiders', 'visualstudiocodeinsiders', 'codeinsiders'].includes(normalized)) {
    return [{ path: path.join(localAppData, 'Programs\\Microsoft VS Code Insiders\\Code - Insiders.exe'), args: '-n' }];
  }

  return [];
}

function escapePowerShellSingleQuoted(value) {
  return String(value).replace(/'/g, "''");
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

/**
 * Scans Windows Start Menu locations to return a map of installed native OS apps.
 */
export function scanOsApps() {
  const appsMap = {};
  const startMenuPaths = [
    path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Microsoft\\Windows\\Start Menu\\Programs'),
    path.join(os.homedir(), 'AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs')
  ];

  startMenuPaths.forEach(dir => walkShortcuts(dir, appsMap));
  return appsMap;
}

/**
 * Launches a Windows path detached in the background using PowerShell.
 */
export function launchPath(filePath) {
  if (!filePath) return Promise.resolve(false);

  if (filePath.toLowerCase().endsWith('.lnk')) {
    const shortcut = getShortcutInfo(filePath);
    if (!shortcut?.TargetPath || !fs.existsSync(shortcut.TargetPath)) {
      return Promise.resolve(false);
    }
    return startPowerShellProcess(shortcut.TargetPath, shortcut.Arguments, shortcut.WorkingDirectory);
  }

  if (path.isAbsolute(filePath) && !fs.existsSync(filePath)) {
    return Promise.resolve(false);
  }

  return startPowerShellProcess(filePath);
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
      const success = await startPowerShellProcess(executable.path, executable.args);
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
    const psCmd = `Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('Code.exe','Code - Insiders.exe','VSCodium.exe') } | Select-Object CommandLine | ConvertTo-Json`;
    const output = execSync(`powershell -NoProfile -Command "${psCmd}"`, { encoding: 'utf8' }).trim();
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
