import { addApp } from '../storage/db.js';
import { createDesktopShortcut } from '../core/shortcut.js';
import { style, parseUrlDetails } from './utils.js';

export default {
  name: 'create',
  description: 'Create a desktop app shortcut from a URL',
  async execute(args) {
    if (args.length === 0) {
      console.log(`${style.red}Error: Please specify a URL. Usage: .dex create <url> [name] [--hidden] [-w <workspace>]${style.reset}`);
      return;
    }

    const isHidden = args.includes('--hidden');
    const filteredArgs = args.filter(arg => arg !== '--hidden');

    const urlArg = filteredArgs[0];
    let appName = filteredArgs[1];
    
    // Look for workspace flags
    let workspaceName = '';
    const wsIndex = filteredArgs.findIndex(arg => arg === '--workspace' || arg === '-w');
    if (wsIndex !== -1 && filteredArgs[wsIndex + 1]) {
      workspaceName = filteredArgs[wsIndex + 1];
      if (wsIndex === 1) {
        appName = undefined;
      }
    }

    const details = parseUrlDetails(urlArg);
    const finalId = appName ? appName.toLowerCase() : details.id;
    const finalName = appName || details.name;

    const appData = {
      id: finalId,
      name: finalName,
      url: details.url,
      hidden: isHidden
    };

    if (workspaceName) {
      appData.workspaces = [workspaceName.toLowerCase()];
    }

    // Save to DB
    addApp(appData);

    // Generate Desktop Shortcut
    try {
      const shortcutPath = await createDesktopShortcut(finalName, finalId, isHidden);
      console.log(`
${style.bold}${style.green}App Created${style.reset}
Name: ${finalName}
Location: Desktop
${isHidden ? style.dim + 'Shortcut Camouflaged / Hidden' + style.reset : ''}
`);
    } catch (err) {
      console.log(`
${style.bold}${style.green}App Created${style.reset}
Name: ${finalName}
${style.yellow}Warning: Failed to create desktop shortcut. App saved to library.${style.reset}
`);
    }
  }
};
