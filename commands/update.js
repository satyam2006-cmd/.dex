import { getApp, updateApp } from '../storage/db.js';
import { createDesktopShortcut, removeDesktopShortcut, unlockDesktopShortcut } from '../core/shortcut.js';
import { style } from './utils.js';

export default {
  name: 'update',
  aliases: ['alter'],
  description: 'Update app URL, name, hidden status, workspaces, or self-update the CLI itself',
  async execute(args) {
    if (args.length === 0) {
      console.log(`${style.red}Error: Please specify app ID or use self-update. Usage: update <app-id> [--url <url>] ... or update self${style.reset}`);
      return;
    }

    if (args[0]?.toLowerCase() === 'self' || args.includes('--self')) {
      await this.handleSelfUpdate();
      return;
    }

    const appId = args[0].toLowerCase();
    const app = getApp(appId);
    if (!app) {
      console.log(`${style.red}App "${appId}" not found in library.${style.reset}`);
      return;
    }

    const fields = {};
    
    // Parse Flags
    const urlIdx = args.indexOf('--url');
    if (urlIdx !== -1 && args[urlIdx + 1]) {
      let formattedUrl = args[urlIdx + 1];
      if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = 'https://' + formattedUrl;
      }
      fields.url = formattedUrl;
    }

    const nameIdx = args.indexOf('--name');
    if (nameIdx !== -1 && args[nameIdx + 1]) {
      fields.name = args[nameIdx + 1];
    }

    const hiddenIdx = args.indexOf('--hidden');
    if (hiddenIdx !== -1 && args[hiddenIdx + 1]) {
      fields.hidden = args[hiddenIdx + 1].toLowerCase() === 'true';
    }

    const unlockIdx = args.indexOf('--unlock');
    if (unlockIdx !== -1) {
      fields.hidden = false;
    }

    const wsIdx = args.indexOf('--workspace');
    if (wsIdx !== -1 && args[wsIdx + 1]) {
      fields.workspaces = args[wsIdx + 1].split(',').map(s => s.trim());
    }

    if (Object.keys(fields).length === 0) {
      console.log(`${style.yellow}No updates provided. Use flags like --url, --name, --hidden, --unlock, --workspace.${style.reset}`);
      return;
    }

    // If name is changing, clean up the old desktop shortcut
    if (fields.name && fields.name !== app.name) {
      removeDesktopShortcut(app.name);
    }

    // If unlocking, reveal files
    if (fields.hidden === false) {
      unlockDesktopShortcut(app.name);
    }

    const updatedApp = updateApp(appId, fields);
    
    // Recreate shortcut with updated configs
    try {
      await createDesktopShortcut(updatedApp.name, updatedApp.id, updatedApp.hidden, updatedApp.iconPath);
      console.log(`${style.green}App "${updatedApp.name}" updated successfully!${style.reset}`);
    } catch (err) {
      console.log(`${style.green}App metadata updated, but shortcut recreation failed.${style.reset}`);
    }
  },

  async handleSelfUpdate() {
    const { exec } = await import('child_process');
    const { VERSION } = await import('../core/version.js');
    const os = await import('os');

    console.log(`Checking for updates...`);
    try {
      const res = await fetch('https://raw.githubusercontent.com/satyam2006-cmd/.dex/master/package.json');
      if (!res.ok) {
        throw new Error(`Failed to fetch version info: Status ${res.status}`);
      }
      const pkg = await res.json();
      const remoteVersion = pkg.version;

      console.log(`Local version:  ${VERSION}`);
      console.log(`Remote version: ${remoteVersion}`);

      const isNewer = (() => {
        const localParts = VERSION.split('.').map(Number);
        const remoteParts = remoteVersion.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
          const l = localParts[i] || 0;
          const r = remoteParts[i] || 0;
          if (r > l) return true;
          if (l > r) return false;
        }
        return false;
      })();

      if (!isNewer) {
        console.log(`${style.green}You are already on the latest version of .dex (v${VERSION}).${style.reset}`);
        return;
      }

      console.log(`A new version (v${remoteVersion}) is available. Updating...`);

      const platform = os.platform();
      let updateCmd = '';
      if (platform === 'win32') {
        updateCmd = 'powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/satyam2006-cmd/.dex/master/install.ps1 | iex"';
      } else {
        updateCmd = 'curl -fsSL https://raw.githubusercontent.com/satyam2006-cmd/.dex/master/install.sh | bash';
      }

      exec(updateCmd, (err, stdout, stderr) => {
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
        if (err) {
          console.error(`${style.red}Self-update failed: ${err.message}${style.reset}`);
        } else {
          console.log(`${style.green}Successfully updated .dex to v${remoteVersion}!${style.reset}`);
          console.log(`${style.yellow}IMPORTANT: If you use the .dex Chrome extension, please reload it in Chrome (chrome://extensions) to ensure compatibility.${style.reset}`);
        }
      });
    } catch (err) {
      console.error(`${style.red}Error checking or applying updates: ${err.message}${style.reset}`);
    }
  }
};
