import { getApp, getWorkspace, logLaunch } from '../storage/db.js';
import { launchUrl } from '../core/launcher.js';
import { style, tick, cross } from './utils.js';

export default {
  name: 'launch',
  description: 'Launch specified app(s) or workspace',
  async execute(args) {
    if (args.length === 0) {
      console.log(`${style.red}Error: Please specify app names, -os <app>, or --workspace <name>${style.reset}`);
      return;
    }

    let appsToLaunch = [];
    let workspaceMode = false;
    let workspaceName = '';
    const osIndex = args.findIndex(arg => arg === '-os' || arg === '--os');
    if (osIndex !== -1) {
      let osNames = args.slice(osIndex + 1).filter(arg => arg !== '-os' && arg !== '--os');
      if (osNames.length === 0) {
        console.log(`${style.red}Error: Please specify an OS app name. Example: launch -os vscode${style.reset}`);
        return;
      }

      const { launchOsApp, resolveOsApp } = await import('../core/osApps.js');
      const joinedName = osNames.join(' ');
      if (osNames.length > 1 && resolveOsApp(joinedName)) {
        osNames = [joinedName];
      }

      console.log(`Launching ${osNames.length} OS app${osNames.length !== 1 ? 's' : ''}...`);
      for (const name of osNames) {
        const result = await launchOsApp(name);
        if (result.success) {
          console.log(` ${tick} ${result.app?.name || name}`);
        } else {
          console.log(` ${cross} ${name} (OS app not found)`);
        }
      }
      return;
    }

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
        console.log(`${style.yellow}Nothing's here yet! Add apps to workspace "${ws.name}" using:${style.reset}`);
        console.log(`  workspace add -w ${ws.name} <app-name>`);
        console.log(`  create <url> [name] -w ${ws.name}`);
        return;
      }
    } else {
      // List of app names
      for (const name of args) {
        const app = getApp(name);
        if (app) {
          appsToLaunch.push(app);
        } else {
          // Check if it's a scanned OS app
          const { resolveOsApp } = await import('../core/osApps.js');
          const osApp = resolveOsApp(name);
          if (osApp) {
            appsToLaunch.push({
              id: name.toLowerCase(),
              name: osApp.name,
              type: 'os',
              path: osApp.path
            });
          } else {
            // Fallback: treat as raw system command
            appsToLaunch.push({
              id: name.toLowerCase(),
              name: name,
              type: 'system'
            });
          }
        }
      }
    }

    if (appsToLaunch.length === 0) return;

    if (appsToLaunch.length === 1 && !workspaceMode) {
      const app = appsToLaunch[0];
      console.log(`Launching ${app.name}...`);
      
      let success = false;
      if (app.type === 'os') {
        const { launchPath } = await import('../core/osApps.js');
        success = await launchPath(app.path);
      } else if (app.type === 'system') {
        const { launchSystemCommand } = await import('../core/osApps.js');
        success = await launchSystemCommand(app.name);
      } else {
        success = await launchUrl(app.url);
      }

      if (success) {
        if (app.id) {
          logLaunch(app.id);
        }
        console.log(`${style.green}App Started Successfully${style.reset}`);
      } else {
        console.log(`${style.red}Failed to start app.${style.reset}`);
      }
    } else {
      console.log(`Launching ${appsToLaunch.length} Apps...`);
      for (const app of appsToLaunch) {
        let success = false;
        if (app.type === 'os') {
          const { launchPath } = await import('../core/osApps.js');
          success = await launchPath(app.path);
        } else if (app.type === 'system') {
          const { launchSystemCommand } = await import('../core/osApps.js');
          success = await launchSystemCommand(app.name);
        } else {
          success = await launchUrl(app.url);
        }

        if (success) {
          if (app.id) {
            logLaunch(app.id);
          }
          console.log(` ${tick} ${app.name}`);
        } else {
          console.log(` ${cross} ${app.name} (failed to launch)`);
        }
      }
    }
  }
};
