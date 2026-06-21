import {
  addProfile,
  deleteProfile,
  getProfile,
  getProfiles,
  getWorkspace,
  logProfileLaunch,
  renameProfile,
  updateProfile
} from '../storage/db.js';
import { style, tick, cross } from './utils.js';

function normalizeProfileArg(value = '') {
  return String(value).replace(/^--/, '').toLowerCase();
}

function parseProfileArgs(args) {
  const firstFlag = args.find(arg => arg.startsWith('--') && arg.length > 2);
  const name = firstFlag ? normalizeProfileArg(firstFlag) : normalizeProfileArg(args[0] || '');
  return { name, rest: firstFlag ? args.filter(arg => arg !== firstFlag) : args.slice(1) };
}

async function launchProfile(profile) {
  const { executeCommand } = await import('./index.js');
  console.log(`${style.bold}${style.cyan}${profile.name} Profile${style.reset}`);

  for (const workspaceId of profile.workspaces || []) {
    const ws = getWorkspace(workspaceId);
    if (!ws) {
      console.log(` ${cross} Workspace "${workspaceId}" not found`);
      continue;
    }
    await executeCommand('launch', ['--workspace', ws.name]);
  }

  for (const workflow of profile.workflows || []) {
    if (!workflow.command) continue;
    const parts = workflow.command.split(/\s+/).filter(Boolean);
    const cmd = parts[0];
    const cmdArgs = parts.slice(1);
    try {
      await executeCommand(cmd, cmdArgs);
      console.log(` ${tick} ${workflow.name || workflow.command}`);
    } catch (err) {
      console.log(` ${cross} ${workflow.name || workflow.command} (${err.message || 'failed'})`);
    }
  }

  logProfileLaunch(profile.id);
}

export default {
  name: 'profile',
  aliases: ['profiles', 'mode'],
  description: 'Create, manage, and launch higher-level profiles',
  async execute(args) {
    if (args.length === 0) {
      this.showHelp();
      return;
    }

    const sub = args[0].toLowerCase();
    if (sub.startsWith('--')) {
      const profile = getProfile(normalizeProfileArg(sub));
      if (!profile) {
        console.log(`${style.red}Profile "${normalizeProfileArg(sub)}" not found.${style.reset}`);
        return;
      }
      await launchProfile(profile);
      return;
    }

    switch (sub) {
      case 'create':
        await this.handleCreate(args.slice(1));
        break;
      case 'delete':
      case 'remove':
        await this.handleDelete(args.slice(1));
        break;
      case 'rename':
      case 'edit':
      case 'update':
        await this.handleRename(args.slice(1));
        break;
      case 'list':
      case 'ls':
        this.handleList();
        break;
      case 'show':
      case 'info':
      case 'view':
        this.handleShow(args.slice(1));
        break;
      case 'add-workspace':
      case 'add-ws':
        await this.handleAddWorkspace(args.slice(1));
        break;
      case 'remove-workspace':
      case 'remove-ws':
        await this.handleRemoveWorkspace(args.slice(1));
        break;
      case 'add-workflow':
      case 'add-flow':
        await this.handleAddWorkflow(args.slice(1));
        break;
      case 'edit-workflow':
      case 'update-workflow':
      case 'edit-flow':
        await this.handleEditWorkflow(args.slice(1));
        break;
      case 'remove-workflow':
      case 'remove-flow':
        await this.handleRemoveWorkflow(args.slice(1));
        break;
      case 'launch':
      case 'run':
        await this.handleLaunch(args.slice(1));
        break;
      default: {
        const profile = getProfile(sub);
        if (profile) {
          await launchProfile(profile);
        } else {
          console.log(`${style.red}Unknown profile command: "${sub}"${style.reset}`);
          this.showHelp();
        }
      }
    }
  },

  showHelp() {
    console.log(`
${style.bold}Profile Usage:${style.reset}
  profile list
  profile show <name>
  profile create <name>
  profile rename <profile> <new-name>
  profile add-workspace <profile> <workspace>
  profile remove-workspace <profile> <workspace>
  profile add-workflow <profile> <name> -- <command...>
  profile edit-workflow <profile> <name> -- <command...>
  profile remove-workflow <profile> <name>
  profile launch <profile>
  profile --gaming
`);
  },

  async handleCreate(args) {
    const { name } = parseProfileArgs(args);
    if (!name) {
      console.log(`${style.red}Error: Please specify profile name. Example: profile create gaming${style.reset}`);
      return;
    }
    const profile = addProfile(name);
    console.log(`${tick} Profile "${profile.name}" created.`);
  },

  async handleDelete(args) {
    const { name } = parseProfileArgs(args);
    if (!name) {
      console.log(`${style.red}Error: Please specify profile name.${style.reset}`);
      return;
    }
    if (!deleteProfile(name)) {
      console.log(`${style.red}Profile "${name}" not found.${style.reset}`);
      return;
    }
    console.log(`${tick} Profile "${name}" deleted.`);
  },

  handleShow(args) {
    const { name } = parseProfileArgs(args);
    const profile = getProfile(name);
    if (!profile) {
      console.log(`${style.red}Profile "${name}" not found.${style.reset}`);
      return;
    }
    console.log(`${style.bold}${style.cyan}${profile.name}${style.reset}`);
    console.log(`ID: ${profile.id}`);
    console.log(`Created: ${profile.created || 'unknown'}`);
    console.log(`Last opened: ${profile.lastOpened || 'never'}`);
    console.log(`Launches: ${profile.launches || 0}`);
    console.log('Workspaces:');
    if ((profile.workspaces || []).length === 0) {
      console.log(`  ${style.dim}(none)${style.reset}`);
    } else {
      profile.workspaces.forEach(workspaceId => console.log(`  - ${workspaceId}`));
    }
    console.log('Workflows:');
    if ((profile.workflows || []).length === 0) {
      console.log(`  ${style.dim}(none)${style.reset}`);
    } else {
      profile.workflows.forEach(workflow => console.log(`  - ${workflow.name}: ${workflow.command}`));
    }
  },

  async handleRename(args) {
    const { name, rest } = parseProfileArgs(args);
    const newName = rest[0];
    if (!name || !newName) {
      console.log(`${style.red}Usage: profile rename <profile> <new-name>${style.reset}`);
      return;
    }
    if (!getProfile(name)) {
      console.log(`${style.red}Profile "${name}" not found.${style.reset}`);
      return;
    }
    if (getProfile(newName)) {
      console.log(`${style.red}Profile "${newName}" already exists.${style.reset}`);
      return;
    }
    const profile = renameProfile(name, newName);
    if (!profile) {
      console.log(`${style.red}Could not rename profile "${name}".${style.reset}`);
      return;
    }
    console.log(`${tick} Profile "${name}" renamed to "${profile.name}".`);
  },

  handleList() {
    const profiles = Object.values(getProfiles());
    if (profiles.length === 0) {
      console.log('No profiles yet. Create one with: profile create gaming');
      return;
    }
    console.log(`${style.bold}Profiles:${style.reset}`);
    profiles.forEach(profile => {
      console.log(`- ${style.cyan}${profile.name}${style.reset} (${profile.workspaces.length} workspace${profile.workspaces.length !== 1 ? 's' : ''}, ${profile.workflows.length} workflow${profile.workflows.length !== 1 ? 's' : ''})`);
    });
  },

  async handleAddWorkspace(args) {
    const profileName = normalizeProfileArg(args[0] || '');
    const workspaceName = args[1];
    if (!profileName || !workspaceName) {
      console.log(`${style.red}Usage: profile add-workspace <profile> <workspace>${style.reset}`);
      return;
    }
    const profile = getProfile(profileName) || addProfile(profileName);
    const ws = getWorkspace(workspaceName);
    if (!ws) {
      console.log(`${style.red}Workspace "${workspaceName}" not found.${style.reset}`);
      return;
    }
    const workspaces = [...new Set([...(profile.workspaces || []), ws.id])];
    updateProfile(profile.id, { workspaces });
    console.log(`${tick} Added workspace "${ws.name}" to profile "${profile.name}".`);
  },

  async handleRemoveWorkspace(args) {
    const profileName = normalizeProfileArg(args[0] || '');
    const workspaceName = args[1];
    if (!profileName || !workspaceName) {
      console.log(`${style.red}Usage: profile remove-workspace <profile> <workspace>${style.reset}`);
      return;
    }
    const profile = getProfile(profileName);
    if (!profile) {
      console.log(`${style.red}Profile "${profileName}" not found.${style.reset}`);
      return;
    }
    const ws = getWorkspace(workspaceName);
    const workspaceId = ws?.id || normalizeProfileArg(workspaceName);
    if (!(profile.workspaces || []).includes(workspaceId)) {
      console.log(`${style.yellow}Workspace "${workspaceName}" is not in profile "${profile.name}".${style.reset}`);
      return;
    }
    const workspaces = (profile.workspaces || []).filter(id => id !== workspaceId);
    updateProfile(profile.id, { workspaces });
    console.log(`${tick} Removed workspace "${workspaceName}" from profile "${profile.name}".`);
  },

  async handleAddWorkflow(args) {
    const separator = args.indexOf('--');
    const profileName = normalizeProfileArg(args[0] || '');
    const workflowName = args[1];
    const command = separator !== -1 ? args.slice(separator + 1).join(' ') : args.slice(2).join(' ');
    if (!profileName || !workflowName || !command) {
      console.log(`${style.red}Usage: profile add-workflow <profile> <name> -- <command...>${style.reset}`);
      return;
    }
    const profile = getProfile(profileName) || addProfile(profileName);
    const workflows = [...(profile.workflows || []), { name: workflowName, command }];
    updateProfile(profile.id, { workflows });
    console.log(`${tick} Added workflow "${workflowName}" to profile "${profile.name}".`);
  },

  async handleEditWorkflow(args) {
    const separator = args.indexOf('--');
    const profileName = normalizeProfileArg(args[0] || '');
    const workflowName = args[1];
    const command = separator !== -1 ? args.slice(separator + 1).join(' ') : args.slice(2).join(' ');
    if (!profileName || !workflowName || !command) {
      console.log(`${style.red}Usage: profile edit-workflow <profile> <name> -- <command...>${style.reset}`);
      return;
    }
    const profile = getProfile(profileName);
    if (!profile) {
      console.log(`${style.red}Profile "${profileName}" not found.${style.reset}`);
      return;
    }
    const workflows = profile.workflows || [];
    const index = workflows.findIndex(flow => normalizeProfileArg(flow.name || '') === normalizeProfileArg(workflowName));
    if (index === -1) {
      console.log(`${style.red}Workflow "${workflowName}" not found in profile "${profile.name}".${style.reset}`);
      return;
    }
    const nextWorkflows = workflows.map((flow, i) => i === index ? { ...flow, name: flow.name || workflowName, command } : flow);
    updateProfile(profile.id, { workflows: nextWorkflows });
    console.log(`${tick} Updated workflow "${workflowName}" in profile "${profile.name}".`);
  },

  async handleRemoveWorkflow(args) {
    const profileName = normalizeProfileArg(args[0] || '');
    const workflowName = args[1];
    if (!profileName || !workflowName) {
      console.log(`${style.red}Usage: profile remove-workflow <profile> <name>${style.reset}`);
      return;
    }
    const profile = getProfile(profileName);
    if (!profile) {
      console.log(`${style.red}Profile "${profileName}" not found.${style.reset}`);
      return;
    }
    const workflows = profile.workflows || [];
    const nextWorkflows = workflows.filter(flow => normalizeProfileArg(flow.name || '') !== normalizeProfileArg(workflowName));
    if (nextWorkflows.length === workflows.length) {
      console.log(`${style.red}Workflow "${workflowName}" not found in profile "${profile.name}".${style.reset}`);
      return;
    }
    updateProfile(profile.id, { workflows: nextWorkflows });
    console.log(`${tick} Removed workflow "${workflowName}" from profile "${profile.name}".`);
  },

  async handleLaunch(args) {
    const { name } = parseProfileArgs(args);
    const profile = getProfile(name);
    if (!profile) {
      console.log(`${style.red}Profile "${name}" not found.${style.reset}`);
      return;
    }
    await launchProfile(profile);
  }
};
