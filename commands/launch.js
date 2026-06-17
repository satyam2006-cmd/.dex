import { getApp, getWorkspace, logLaunch } from '../storage/db.js';
import { launchUrl } from '../core/launcher.js';
import { style, tick, cross } from './utils.js';

export default {
  name: 'launch',
  description: 'Launch specified app(s) or workspace',
  async execute(args) {
    if (args.length === 0) {
      console.log(`${style.red}Error: Please specify app names or use --workspace <name>${style.reset}`);
      return;
    }

    let appsToLaunch = [];
    let workspaceMode = false;
    let workspaceName = '';

    const wsIndex = args.findIndex(arg => arg === '--workspace' || arg === '-w');
    if (wsIndex !== -1) {
      workspaceMode = true;
      workspaceName = args[wsIndex + 1];
      if (!workspaceName) {
        console.log(`${style.red}Error: Please specify workspace name${style.reset}`);
        return;
      }
      
      const ws = getWorkspace(workspaceName);
      if (!ws) {
        console.log(`${style.red}Workspace "${workspaceName}" not found.${style.reset}`);
        return;
      }
      
      console.log(`${style.bold}${style.cyan}${ws.name} Workspace${style.reset}`);
      appsToLaunch = ws.apps.map(id => getApp(id)).filter(Boolean);
      
      if (appsToLaunch.length === 0) {
        console.log('No apps assigned to this workspace.');
        return;
      }
    } else {
      // List of app names
      for (const name of args) {
        const app = getApp(name);
        if (app) {
          appsToLaunch.push(app);
        } else {
          console.log(`${cross} App "${name}" not found. Type ".dex list" to check names.`);
        }
      }
    }

    if (appsToLaunch.length === 0) return;

    if (appsToLaunch.length === 1 && !workspaceMode) {
      const app = appsToLaunch[0];
      console.log(`Launching ${app.name}...`);
      const success = await launchUrl(app.url);
      if (success) {
        logLaunch(app.id);
        console.log(`${style.green}App Started Successfully${style.reset}`);
      } else {
        console.log(`${style.red}Failed to start app.${style.reset}`);
      }
    } else {
      console.log(`Launching ${appsToLaunch.length} Apps...`);
      for (const app of appsToLaunch) {
        const success = await launchUrl(app.url);
        if (success) {
          logLaunch(app.id);
          console.log(` ${tick} ${app.name}`);
        } else {
          console.log(` ${cross} ${app.name} (failed to launch)`);
        }
      }
    }
  }
};
