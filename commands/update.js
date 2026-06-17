import { getApp, updateApp } from '../storage/db.js';
import { createDesktopShortcut, removeDesktopShortcut } from '../core/shortcut.js';
import { style } from './utils.js';

export default {
  name: 'update',
  aliases: ['alter'],
  description: 'Update app URL, name, hidden status, or workspaces',
  async execute(args) {
    if (args.length === 0) {
      console.log(`${style.red}Error: Please specify app ID. Usage: update <app-id> [--url <url>] [--name <name>] [--hidden <true|false>] [--workspace <ws>]${style.reset}`);
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

    const wsIdx = args.indexOf('--workspace');
    if (wsIdx !== -1 && args[wsIdx + 1]) {
      fields.workspaces = args[wsIdx + 1].split(',').map(s => s.trim());
    }

    if (Object.keys(fields).length === 0) {
      console.log(`${style.yellow}No updates provided. Use flags like --url, --name, --hidden, --workspace.${style.reset}`);
      return;
    }

    // If name is changing, clean up the old desktop shortcut
    if (fields.name && fields.name !== app.name) {
      removeDesktopShortcut(app.name);
    }

    const updatedApp = updateApp(appId, fields);
    
    // Recreate shortcut with updated configs
    try {
      await createDesktopShortcut(updatedApp.name, updatedApp.id, updatedApp.hidden);
      console.log(`${style.green}App "${updatedApp.name}" updated successfully!${style.reset}`);
    } catch (err) {
      console.log(`${style.green}App metadata updated, but shortcut recreation failed.${style.reset}`);
    }
  }
};
