import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { getBrowsers } from './launcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createDesktopShortcut(appName, appId, isHidden = false, customIconPath = null) {
  return new Promise((resolve, reject) => {
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const startMenuPath = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs');
    
    const desktopShortcutPath = path.join(desktopPath, `${appName}.lnk`);
    const startMenuShortcutPath = path.join(startMenuPath, `${appName}.lnk`);
    
    // Detect browser paths to borrow their icons if possible
    let iconPath = 'msedge.exe,0'; // Default fallback
    
    if (customIconPath) {
      iconPath = customIconPath;
    } else if (isHidden) {
      const lowerName = appName.toLowerCase();
      const lowerId = appId.toLowerCase();
      if (lowerName.includes('note') || lowerId.includes('note') || lowerName.includes('text') || lowerId.includes('text')) {
        iconPath = 'C:\\Windows\\System32\\notepad.exe,0';
      } else if (lowerName.includes('folder') || lowerId.includes('folder') || lowerName.includes('explorer') || lowerId.includes('explorer')) {
        iconPath = 'C:\\Windows\\System32\\imageres.dll,3';
      } else {
        // Default disguise: Calculator
        iconPath = 'C:\\Windows\\System32\\calc.exe,0';
      }
    } else {
      const browsers = getBrowsers();
      if (browsers.chrome) {
        iconPath = `${browsers.chrome},0`;
      } else if (browsers.edge) {
        iconPath = `${browsers.edge},0`;
      }
    }

    // Use wscript.exe + VBScript to launch .dex silently (no cmd popup window)
    const vbsLauncherPath = path.join(os.homedir(), '.dex_launchers', `${appId}.vbs`);
    const vbsDir = path.dirname(vbsLauncherPath);

    // Ensure the launcher directory exists
    if (!fs.existsSync(vbsDir)) {
      fs.mkdirSync(vbsDir, { recursive: true });
    }

    // Use absolute node executable and script path to avoid any PATH resolution issues
    const nodePath = process.execPath;
    const dexScriptPath = path.resolve(__dirname, '..', 'bin', 'dex.js');

    // If compiled via pkg, the executable itself is the runner. Otherwise, use node + script path.
    const runCmd = process.pkg
      ? `"""${nodePath}"" launch ${appId}"`
      : `"""${nodePath}"" ""${dexScriptPath}"" launch ${appId}"`;

    // Write a VBS silent launcher for this app (triple quotes to escape paths for WScript.Run)
    const vbsContent = [
      `Set objShell = CreateObject("WScript.Shell")`,
      `objShell.Run ${runCmd}, 0, False`
    ].join('\r\n');
    
    try {
      fs.writeFileSync(vbsLauncherPath, vbsContent, 'utf-8');
    } catch (err) {
      return reject(err);
    }

    // PowerShell script to create shortcuts on both Desktop and Start Menu
    const tempScriptPath = path.join(os.tmpdir(), `dex_shortcut_${appId}.ps1`);
    const vbsEscaped = vbsLauncherPath.replace(/\\/g, '\\\\');
    const iconEscaped = iconPath.replace(/\\/g, '\\\\');
    const desktopShortcutEscaped = desktopShortcutPath.replace(/\\/g, '\\\\');
    const startMenuShortcutEscaped = startMenuShortcutPath.replace(/\\/g, '\\\\');

    const psCommand = [
      `$WshShell = New-Object -ComObject WScript.Shell`,
      
      // 1. Desktop Shortcut
      `$Shortcut1 = $WshShell.CreateShortcut("${desktopShortcutEscaped}")`,
      `$Shortcut1.TargetPath = "wscript.exe"`,
      `$Shortcut1.Arguments = '"${vbsEscaped}"'`,
      `$Shortcut1.WindowStyle = 7`,
      `$Shortcut1.IconLocation = "${iconEscaped}"`,
      `$Shortcut1.Description = "Launch ${appName} via .DEX"`,
      `$Shortcut1.Save()`,
      
      // 2. Start Menu Shortcut
      `$Shortcut2 = $WshShell.CreateShortcut("${startMenuShortcutEscaped}")`,
      `$Shortcut2.TargetPath = "wscript.exe"`,
      `$Shortcut2.Arguments = '"${vbsEscaped}"'`,
      `$Shortcut2.WindowStyle = 7`,
      `$Shortcut2.IconLocation = "${iconEscaped}"`,
      `$Shortcut2.Description = "Launch ${appName} via .DEX"`,
      `$Shortcut2.Save()`
    ].join('\r\n');

    try {
      fs.writeFileSync(tempScriptPath, psCommand, 'utf-8');
    } catch (err) {
      return reject(err);
    }
    
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempScriptPath}"`, { windowsHide: true }, (err) => {
      try {
        if (fs.existsSync(tempScriptPath)) {
          fs.unlinkSync(tempScriptPath);
        }
      } catch (cleanupErr) {
        // Ignore cleanup error
      }
      
      if (err) {
        reject(err);
      } else {
        if (isHidden) {
          try {
            execSync(`attrib +h "${desktopShortcutPath}"`, { windowsHide: true });
          } catch (_) {}
          try {
            execSync(`attrib +h "${startMenuShortcutPath}"`, { windowsHide: true });
          } catch (_) {}
        }
        resolve(desktopShortcutPath);
      }
    });
  });
}

export function unlockDesktopShortcut(appName) {
  const desktopPath = path.join(os.homedir(), 'Desktop');
  const startMenuPath = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs');
  
  const desktopShortcutPath = path.join(desktopPath, `${appName}.lnk`);
  const startMenuShortcutPath = path.join(startMenuPath, `${appName}.lnk`);
  
  try {
    if (fs.existsSync(desktopShortcutPath)) {
      execSync(`attrib -h "${desktopShortcutPath}"`, { windowsHide: true });
    }
  } catch (_) {}
  
  try {
    if (fs.existsSync(startMenuShortcutPath)) {
      execSync(`attrib -h "${startMenuShortcutPath}"`, { windowsHide: true });
    }
  } catch (_) {}
}

export function removeDesktopShortcut(appName) {
  const desktopPath = path.join(os.homedir(), 'Desktop');
  const startMenuPath = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs');
  
  const desktopShortcutPath = path.join(desktopPath, `${appName}.lnk`);
  const startMenuShortcutPath = path.join(startMenuPath, `${appName}.lnk`);
  
  let success = false;
  
  // Try to remove hidden attribute first to ensure we can delete it
  try {
    if (fs.existsSync(desktopShortcutPath)) {
      execSync(`attrib -h "${desktopShortcutPath}"`, { windowsHide: true });
    }
  } catch (_) {}
  try {
    if (fs.existsSync(startMenuShortcutPath)) {
      execSync(`attrib -h "${startMenuShortcutPath}"`, { windowsHide: true });
    }
  } catch (_) {}

  if (fs.existsSync(desktopShortcutPath)) {
    try {
      fs.unlinkSync(desktopShortcutPath);
      success = true;
    } catch (err) {
      console.error(`Failed to delete desktop shortcut: ${desktopShortcutPath}`, err);
    }
  }
  
  if (fs.existsSync(startMenuShortcutPath)) {
    try {
      fs.unlinkSync(startMenuShortcutPath);
      success = true;
    } catch (err) {
      console.error(`Failed to delete Start Menu shortcut: ${startMenuShortcutPath}`, err);
    }
  }
  
  return success;
}
