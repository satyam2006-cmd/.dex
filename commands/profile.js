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
  profile delete <profile>
  profile add-workspace <profile> <workspace>
  profile remove-workspace <profile> <workspace>
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
      console.log(`- ${style.cyan}${profile.name}${style.reset} (${(profile.workspaces || []).length} workspace${(profile.workspaces || []).length !== 1 ? 's' : ''})`);
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
