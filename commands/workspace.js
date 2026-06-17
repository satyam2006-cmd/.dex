import { getWorkspace, getWorkspaces, addWorkspace, deleteWorkspace, getApp, updateApp } from '../storage/db.js';
import { style, tick, cross } from './utils.js';

export default {
  name: 'workspace',
  description: 'Manage workspaces and group web apps',
  async execute(args) {
    if (args.length === 0) {
      this.showHelp();
      return;
    }

    const sub = args[0].toLowerCase();

    switch (sub) {
      case 'create':
        await this.handleCreate(args.slice(1));
        break;
      case 'add':
        await this.handleAdd(args.slice(1));
        break;
      case 'remove':
      case 'delete':
        await this.handleRemove(args.slice(1));
        break;
      case 'list':
        this.handleList();
        break;
      case 'launch':
        await this.handleLaunch(args.slice(1));
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
  workspace list                   List all workspaces and their apps
  workspace create <name>          Create a new workspace
  workspace add <name> <app-name>  Add an app to a workspace
  workspace remove <name> [app]    Remove an app from a workspace, or delete the workspace
  workspace launch <name>          Launch all apps in the workspace
`);
  },

  async handleLaunch(args) {
    if (args.length === 0) {
      console.log(`${style.red}Error: Please specify workspace name. Example: workspace launch coding${style.reset}`);
      return;
    }
    const wsName = args[0];
    const launchCmd = (await import('./launch.js')).default;
    await launchCmd.execute(['--workspace', wsName]);
  },


  async handleCreate(args) {
    if (args.length === 0) {
      console.log(`${style.red}Error: Please specify workspace name. Example: workspace create coding${style.reset}`);
      return;
    }
    const name = args[0];
    const ws = getWorkspace(name);
    if (ws) {
      console.log(`${style.yellow}Workspace "${name}" already exists.${style.reset}`);
      return;
    }
    addWorkspace(name, []);
    console.log(`${tick} Workspace "${name}" created successfully.`);
  },

  async handleAdd(args) {
    if (args.length < 2) {
      console.log(`${style.red}Error: Please specify workspace name and app name. Example: workspace add coding github${style.reset}`);
      return;
    }
    const wsName = args[0];
    const appName = args[1];

    const ws = getWorkspace(wsName);
    if (!ws) {
      console.log(`${style.red}Error: Workspace "${wsName}" does not exist. Create it first using: workspace create ${wsName}${style.reset}`);
      return;
    }

    const app = getApp(appName);
    if (!app) {
      console.log(`${style.red}Error: App "${appName}" not found in library.${style.reset}`);
      return;
    }

    if (ws.apps.includes(app.id)) {
      console.log(`${style.yellow}App "${app.name}" is already in workspace "${ws.name}".${style.reset}`);
      return;
    }

    // Add app to workspace
    const newApps = [...ws.apps, app.id];
    addWorkspace(ws.name, newApps);
    console.log(`${tick} App "${app.name}" added to workspace "${ws.name}".`);
  },

  async handleRemove(args) {
    if (args.length === 0) {
      console.log(`${style.red}Error: Please specify workspace name. Example: workspace remove coding${style.reset}`);
      return;
    }
    const wsName = args[0];
    const appName = args[1];

    const ws = getWorkspace(wsName);
    if (!ws) {
      console.log(`${style.red}Workspace "${wsName}" not found.${style.reset}`);
      return;
    }

    if (appName) {
      // Remove specific app from workspace
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
      // Delete whole workspace
      deleteWorkspace(ws.id);
      console.log(`${tick} Workspace "${ws.name}" deleted successfully.`);
    }
  },

  handleList() {
    const workspaces = getWorkspaces();
    const list = Object.values(workspaces);
    if (list.length === 0) {
      console.log('No workspaces created yet. Create one with: workspace create <name>');
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
      }
    });
  }
};
