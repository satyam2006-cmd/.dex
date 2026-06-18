import readline from 'readline/promises';
import { getWorkspace, getWorkspaces, addWorkspace, deleteWorkspace, getApp, getApps, addApp, readDb, writeDb } from '../storage/db.js';
import { style, tick, cross, parseUrlDetails } from './utils.js';

export default {
  name: 'workspace',
  description: 'Manage workspaces, snapshots, and browser tab imports',
  async execute(args, context = {}) {
    if (args.length === 0) {
      this.showHelp();
      return;
    }

    const sub = args[0].toLowerCase();
    const subArgs = args.slice(1);

    switch (sub) {
      case 'create':
        await this.handleCreate(subArgs);
        break;
      case 'delete':
        await this.handleDelete(subArgs);
        break;
      case 'rename':
      case 'update':
        await this.handleRename(subArgs);
        break;
      case 'add':
        await this.handleAdd(subArgs);
        break;
      case 'add-os':
        await this.handleAddOs(subArgs);
        break;
      case 'remove':
      case 'remove-app':
        await this.handleRemove(subArgs);
        break;
      case 'list':
      case 'ls':
        this.handleList();
        break;
      case 'launch':
        await this.handleLaunch(subArgs);
        break;
      case 'snapshot':
        await this.handleSnapshot(subArgs, context);
        break;
      case 'import':
        await this.handleImport(subArgs, context);
        break;
      default:
        console.log(`${style.red}Unknown workspace subcommand: "${sub}"${style.reset}`);
        this.showHelp();
        break;
    }
  },

  showHelp() {
    console.log(`
${style.bold}Workspace Usage:${style.reset}
  workspace list                               List all workspaces
  workspace create -w <name>                   Create a new empty workspace
  workspace delete -w <name>                   Delete an existing workspace
  workspace rename -w <old-name> <new-name>     Rename a workspace
  workspace add -w <name> <app-name>           Add an app to a workspace
  workspace add-os -w <name> <os-app-name>     Add a native OS app (e.g. notepad, spotify)
  workspace remove -w <name> <app-name>        Remove an app from a workspace
  workspace launch -w <name>                   Launch all apps in a workspace
  workspace snapshot save -w <name>            Save current open tabs and VS Code folders
  workspace snapshot restore -w <name>        Restore the saved snapshot
  workspace import -w <name> <browser>         Import open tabs from Chrome/Edge/Brave/Opera
`);
  },

  /**
   * Helper to parse workspace name and extra parameters, supporting the -w flag.
   */
  parseWorkspaceArgs(args) {
    let workspaceName = '';
    let extraArgs = [];
    let i = 0;
    while (i < args.length) {
      if (args[i] === '-w' || args[i] === '--workspace') {
        workspaceName = args[i + 1] || '';
        i += 2;
      } else {
        extraArgs.push(args[i]);
        i++;
      }
    }
    if (!workspaceName && extraArgs.length > 0) {
      workspaceName = extraArgs[0];
      extraArgs = extraArgs.slice(1);
    }
    return { workspaceName, extraArgs };
  },

  async handleCreate(subArgs) {
    const { workspaceName } = this.parseWorkspaceArgs(subArgs);
    if (!workspaceName) {
      console.log(`${style.red}Error: Please specify workspace name. Example: workspace create -w coding${style.reset}`);
      return;
    }
    const ws = getWorkspace(workspaceName);
    if (ws) {
      console.log(`${style.yellow}Workspace "${workspaceName}" already exists.${style.reset}`);
      return;
    }
    addWorkspace(workspaceName, []);
    console.log(`${tick} Workspace "${workspaceName}" created successfully.`);
    console.log(`${style.dim}This workspace is empty. To add apps to it, run:${style.reset}`);
    console.log(`  workspace add -w ${workspaceName} <app-name>`);
    console.log(`  workspace add-os -w ${workspaceName} <os-app-name>`);
    console.log(`  create <url> [name] -w ${workspaceName}`);
  },

  async handleDelete(subArgs) {
    const { workspaceName } = this.parseWorkspaceArgs(subArgs);
    if (!workspaceName) {
      console.log(`${style.red}Error: Please specify workspace name. Example: workspace delete -w coding${style.reset}`);
      return;
    }
    const ws = getWorkspace(workspaceName);
    if (!ws) {
      console.log(`${style.red}Workspace "${workspaceName}" not found.${style.reset}`);
      return;
    }
    deleteWorkspace(ws.id);
    console.log(`${tick} Workspace "${ws.name}" deleted successfully.`);
  },

  async handleRename(subArgs) {
    const { workspaceName, extraArgs } = this.parseWorkspaceArgs(subArgs);
    const newName = extraArgs[0];
    if (!workspaceName || !newName) {
      console.log(`${style.red}Error: Please specify the old name and new name. Example: workspace rename -w oldName newName${style.reset}`);
      return;
    }
    const ws = getWorkspace(workspaceName);
    if (!ws) {
      console.log(`${style.red}Workspace "${workspaceName}" not found.${style.reset}`);
      return;
    }

    const db = readDb();
    const oldKey = ws.id;
    const newKey = newName.toLowerCase();

    if (db.workspaces[newKey]) {
      console.log(`${style.red}Error: Workspace "${newName}" already exists.${style.reset}`);
      return;
    }

    db.workspaces[newKey] = {
      id: newKey,
      name: newName,
      apps: ws.apps,
      snapshot: ws.snapshot || null
    };
    delete db.workspaces[oldKey];

    // Update apps workspaces references
    Object.keys(db.apps).forEach(appKey => {
      const app = db.apps[appKey];
      if (app.workspaces) {
        app.workspaces = app.workspaces.map(w => w === oldKey ? newKey : w);
      }
    });

    writeDb(db);
    console.log(`${tick} Workspace "${ws.name}" renamed to "${newName}" successfully.`);
  },

  async handleAdd(subArgs) {
    const { workspaceName, extraArgs } = this.parseWorkspaceArgs(subArgs);
    const appName = extraArgs[0];
    if (!workspaceName || !appName) {
      console.log(`${style.red}Error: Please specify workspace and app. Example: workspace add -w coding github${style.reset}`);
      return;
    }
    const ws = getWorkspace(workspaceName);
    if (!ws) {
      console.log(`${style.red}Error: Workspace "${workspaceName}" not found. Create it first using: workspace create -w ${workspaceName}${style.reset}`);
      return;
    }

    let app = getApp(appName);
    if (!app) {
      // Check if it exists on the OS
      const { scanOsApps } = await import('../core/osApps.js');
      const osApps = scanOsApps();
      const osApp = osApps[appName.toLowerCase()];
      if (osApp) {
        app = addApp({
          id: appName.toLowerCase(),
          name: osApp.name,
          type: 'os',
          path: osApp.path,
          workspaces: [ws.id]
        });
      } else {
        // Fallback: register as a system command
        app = addApp({
          id: appName.toLowerCase(),
          name: appName,
          type: 'system',
          workspaces: [ws.id]
        });
      }
    }

    if (ws.apps.includes(app.id)) {
      console.log(`${style.yellow}App "${app.name}" is already in workspace "${ws.name}".${style.reset}`);
      return;
    }

    const newApps = [...ws.apps, app.id];
    addWorkspace(ws.name, newApps);
    console.log(`${tick} App "${app.name}" added to workspace "${ws.name}".`);
  },

  async handleAddOs(subArgs) {
    const { workspaceName, extraArgs } = this.parseWorkspaceArgs(subArgs);
    const appName = extraArgs[0];
    if (!workspaceName || !appName) {
      console.log(`${style.red}Error: Please specify workspace and OS app name. Example: workspace add-os -w coding notepad${style.reset}`);
      return;
    }
    const ws = getWorkspace(workspaceName);
    if (!ws) {
      console.log(`${style.red}Error: Workspace "${workspaceName}" not found. Create it first using: workspace create -w ${workspaceName}${style.reset}`);
      return;
    }

    const { scanOsApps } = await import('../core/osApps.js');
    const osApps = scanOsApps();
    const osApp = osApps[appName.toLowerCase()];
    
    let appData;
    if (osApp) {
      appData = {
        id: appName.toLowerCase(),
        name: osApp.name,
        type: 'os',
        path: osApp.path,
        workspaces: [ws.id]
      };
    } else {
      // Register as raw system command fallback
      appData = {
        id: appName.toLowerCase(),
        name: appName,
        type: 'system',
        workspaces: [ws.id]
      };
    }

    addApp(appData);

    if (!ws.apps.includes(appData.id)) {
      const newApps = [...ws.apps, appData.id];
      addWorkspace(ws.name, newApps);
    }
    console.log(`${tick} OS App "${appData.name}" added to workspace "${ws.name}".`);
  },

  async handleRemove(subArgs) {
    const { workspaceName, extraArgs } = this.parseWorkspaceArgs(subArgs);
    const appName = extraArgs[0];
    if (!workspaceName) {
      console.log(`${style.red}Error: Please specify workspace name. Example: workspace remove -w coding <app-name>${style.reset}`);
      return;
    }
    const ws = getWorkspace(workspaceName);
    if (!ws) {
      console.log(`${style.red}Workspace "${workspaceName}" not found.${style.reset}`);
      return;
    }

    if (appName) {
      const app = getApp(appName);
      if (!app) {
        console.log(`${style.red}App "${appName}" not found.${style.reset}`);
        return;
      }
      if (!ws.apps.includes(app.id)) {
        console.log(`${style.yellow}App "${app.name}" is not in workspace "${ws.name}".${style.reset}`);
        return;
      }
      const newApps = ws.apps.filter(id => id !== app.id);
      addWorkspace(ws.name, newApps);
      console.log(`${tick} App "${app.name}" removed from workspace "${ws.name}".`);
    } else {
      deleteWorkspace(ws.id);
      console.log(`${tick} Workspace "${ws.name}" deleted successfully.`);
    }
  },

  async handleLaunch(subArgs) {
    const { workspaceName } = this.parseWorkspaceArgs(subArgs);
    if (!workspaceName) {
      console.log(`${style.red}Error: Please specify workspace name. Example: workspace launch -w coding${style.reset}`);
      return;
    }
    const ws = getWorkspace(workspaceName);
    if (!ws) {
      console.log(`${style.red}Workspace "${workspaceName}" not found.${style.reset}`);
      return;
    }
    if (ws.apps.length === 0) {
      console.log(`${style.yellow}Nothing's here yet! Add apps to workspace "${ws.name}" using:${style.reset}`);
      console.log(`  workspace add -w ${ws.name} <app-name>`);
      console.log(`  workspace add-os -w ${ws.name} <os-app-name>`);
      console.log(`  create <url> [name] -w ${ws.name}`);
      return;
    }
    const launchCmd = (await import('./launch.js')).default;
    await launchCmd.execute(['--workspace', ws.name]);
  },

  isTerminalApp(app) {
    const value = `${app?.name || ''} ${app?.path || ''} ${app?.launchName || ''}`.toLowerCase();
    return [
      'windowsterminal',
      'windows terminal',
      'terminal.exe',
      'wt.exe',
      'powershell.exe',
      'pwsh.exe',
      'cmd.exe',
      'conhost.exe',
      'openconsole.exe'
    ].some(term => value.includes(term));
  },

  async askYesNo(question, context = {}) {
    if (context.rl) {
      const answer = await context.rl.question(question);
      return ['y', 'yes'].includes(answer.trim().toLowerCase());
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = await rl.question(question);
      return ['y', 'yes'].includes(answer.trim().toLowerCase());
    } finally {
      rl.close();
    }
  },

  async filterTerminalApps(osApps, context = {}) {
    const terminalApps = osApps.filter(app => this.isTerminalApp(app));
    if (terminalApps.length === 0) return osApps;

    const terminalNames = terminalApps.map(app => app.name).join(', ');
    console.log(`${style.yellow}Note: terminal detected by snapshot capture: ${terminalNames}.${style.reset}`);
    const keepTerminals = await this.askYesNo('Do you want to keep terminal window(s) in this workspace snapshot? (y/N): ', context);

    if (keepTerminals) {
      return osApps;
    }

    return osApps.filter(app => !this.isTerminalApp(app));
  },

  async handleSnapshot(subArgs, context = {}) {
    if (subArgs.length === 0) {
      console.log(`${style.red}Error: Please specify snapshot action ('save' or 'restore').${style.reset}`);
      console.log(`Usage: workspace snapshot [save|restore] -w <workspace>`);
      return;
    }
    const action = subArgs[0].toLowerCase();
    const { workspaceName } = this.parseWorkspaceArgs(subArgs.slice(1));
    if (!workspaceName) {
      console.log(`${style.red}Error: Please specify workspace name. Example: workspace snapshot ${action} -w coding${style.reset}`);
      return;
    }

    if (action === 'save') {
      let currentWs = getWorkspace(workspaceName);
      if (!currentWs) {
        currentWs = addWorkspace(workspaceName, []);
        console.log(`${tick} Created workspace "${workspaceName}".`);
      }
      console.log(`Saving snapshot for workspace "${currentWs.name}"...`);
      const { getRunningGuiApps, getRunningVsCodeFolders } = await import('../core/osApps.js');
      const { importBrowserTabs } = await import('../core/browserSession.js');

      let tabs = [];
      try { tabs = importBrowserTabs('chrome'); } catch (_) {}
      if (tabs.length === 0) {
        try { tabs = importBrowserTabs('edge'); } catch (_) {}
      }
      
      const ideFolders = getRunningVsCodeFolders();
      const osApps = await this.filterTerminalApps(getRunningGuiApps(), context);

      const db = readDb();
      db.workspaces[currentWs.id].snapshot = {
        tabs,
        ideFolders,
        osApps,
        timestamp: new Date().toISOString()
      };
      writeDb(db);

      console.log(`
${style.bold}${style.green}Snapshot Saved!${style.reset}
Workspace: ${currentWs.name}
  - Browser Tabs captured: ${tabs.length}
  - IDE Folders (VS Code) captured: ${ideFolders.length}
  - OS GUI Programs captured: ${osApps.length}
`);
    } else if (action === 'restore') {
      const ws = getWorkspace(workspaceName);
      if (!ws) {
        console.log(`${style.red}Workspace "${workspaceName}" not found.${style.reset}`);
        return;
      }
      const snapshot = ws.snapshot;
      if (!snapshot) {
        console.log(`${style.yellow}No snapshot found for workspace "${ws.name}". Save one first with: workspace snapshot save -w ${ws.name}${style.reset}`);
        return;
      }
      console.log(`Restoring snapshot for workspace "${ws.name}"...`);

      // 1. Restore tabs
      const { launchUrl } = await import('../core/launcher.js');
      if (snapshot.tabs && snapshot.tabs.length > 0) {
        console.log(`Restoring ${snapshot.tabs.length} tabs...`);
        for (const url of snapshot.tabs) {
          await launchUrl(url);
        }
      }

      // 2. Restore IDE folders
      const { launchSystemCommand } = await import('../core/osApps.js');
      if (snapshot.ideFolders && snapshot.ideFolders.length > 0) {
        console.log(`Opening ${snapshot.ideFolders.length} VS Code folder(s)...`);
        for (const folder of snapshot.ideFolders) {
          await launchSystemCommand('code', [folder]);
        }
      }

      // 3. Restore OS Apps
      if (snapshot.osApps && snapshot.osApps.length > 0) {
        console.log(`Launching ${snapshot.osApps.length} OS Apps...`);
        for (const app of snapshot.osApps) {
          await launchSystemCommand(app.path);
        }
      }
      console.log(`${tick} Snapshot restored successfully!`);
    } else {
      console.log(`${style.red}Unknown snapshot action "${action}". Use 'save' or 'restore'.${style.reset}`);
    }
  },

  async handleImport(subArgs, context) {
    const { workspaceName, extraArgs } = this.parseWorkspaceArgs(subArgs);
    const browser = extraArgs[0];
    if (!workspaceName || !browser) {
      console.log(`${style.red}Error: Please specify workspace and browser. Example: workspace import -w coding chrome${style.reset}`);
      return;
    }

    console.log(`Scanning active tabs from "${browser}"...`);
    const { importBrowserTabs } = await import('../core/browserSession.js');
    
    let urls = [];
    try {
      urls = importBrowserTabs(browser);
    } catch (err) {
      console.log(`${style.red}Error importing tabs: ${err.message}${style.reset}`);
      return;
    }

    if (urls.length === 0) {
      console.log(`${style.yellow}No active tabs found in browser "${browser}".${style.reset}`);
      return;
    }

    console.log(`Found ${urls.length} active tab(s) in "${browser}".`);
    
    let answer = '';
    const questionText = `Import these ${urls.length} tabs into workspace "${workspaceName}"? (Y/N): `;
    if (context.rl) {
      answer = await context.rl.question(questionText);
    } else {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      answer = await rl.question(questionText);
      rl.close();
    }

    if (answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes') {
      let ws = getWorkspace(workspaceName);
      if (!ws) {
        addWorkspace(workspaceName, []);
        ws = getWorkspace(workspaceName);
      }

      const importedApps = [];
      for (const url of urls) {
        const details = parseUrlDetails(url);
        const appId = details.id + '_' + Math.random().toString(36).substring(2, 6);
        const appData = {
          id: appId,
          name: details.name,
          url: url,
          workspaces: [ws.id]
        };
        addApp(appData);

        try {
          const { createDesktopShortcut } = await import('../core/shortcut.js');
          await createDesktopShortcut(details.name, appId, false);
        } catch (_) {}

        importedApps.push(appId);
      }

      const newApps = [...new Set([...ws.apps, ...importedApps])];
      addWorkspace(ws.name, newApps);
      console.log(`${tick} Successfully imported ${importedApps.length} tabs into workspace "${workspaceName}".`);
    } else {
      console.log('Import cancelled.');
    }
  },

  handleList() {
    const workspaces = getWorkspaces();
    const list = Object.values(workspaces);
    if (list.length === 0) {
      console.log('No workspaces created yet. Create one with: workspace create -w <name>');
      return;
    }

    console.log(`${style.bold}Workspaces:${style.reset}`);
    list.forEach(ws => {
      const appCount = ws.apps.length;
      console.log(`- ${style.cyan}${ws.name}${style.reset} (${appCount} app${appCount !== 1 ? 's' : ''})`);
      if (appCount > 0) {
        ws.apps.forEach(appId => {
          const app = getApp(appId);
          console.log(`  └─ ${app ? app.name : appId}`);
        });
      } else {
        console.log(`  └─ ${style.dim}(No apps. Run "workspace add -w ${ws.name} <app>" to populate)${style.reset}`);
      }
    });
  }
};
