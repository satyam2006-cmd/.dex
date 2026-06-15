#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline/promises';
import os from 'os';
import { 
  getApp, 
  getApps, 
  addApp, 
  updateApp, 
  deleteApp, 
  getWorkspace, 
  getWorkspaces, 
  addWorkspace,
  logLaunch, 
  getStats, 
  getRecent, 
  getSuggestions, 
  getWeeklySummary, 
  exportDb, 
  importDb 
} from '../lib/db.js';
import { launchUrl } from '../lib/launcher.js';
import { createDesktopShortcut, removeDesktopShortcut } from '../lib/shortcut.js';
// [v2] Dashboard/serve imports disabled for v1 release
// import { getAvailablePort, startServer } from '../lib/dashboard.js';

// ANSI Styles
const style = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

const tick = `${style.green}✓${style.reset}`;
const cross = `${style.red}✗${style.reset}`;

// Helper: Format Relative Time
function formatRelativeTime(dateStr) {
  if (!dateStr) return 'never';
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

// Helper: Format Uptime
function getSystemUptime() {
  const uptimeSec = os.uptime();
  const hours = Math.floor(uptimeSec / 3600);
  const minutes = Math.floor((uptimeSec % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

// Helper: Extract name and ID from URL
function parseUrlDetails(urlStr) {
  try {
    let formattedUrl = urlStr;
    if (!/^https?:\/\//i.test(urlStr)) {
      formattedUrl = 'https://' + urlStr;
    }
    const parsed = new URL(formattedUrl);
    let hostname = parsed.hostname;
    if (hostname.startsWith('www.')) hostname = hostname.slice(4);
    const parts = hostname.split('.');
    
    let mainPart = parts[0];
    if (['mail', 'app', 'play', 'docs', 'my', 'dev'].includes(mainPart) && parts.length > 1) {
      mainPart = parts[1];
    }
    
    const capitalized = mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
    return { id: mainPart.toLowerCase(), name: capitalized, url: formattedUrl };
  } catch (e) {
    return { id: 'app', name: 'Web App', url: urlStr };
  }
}

// Draw screenfetch-style banner (no server)
function showBanner() {
  const stats = getStats();
  
  // Get system metrics
  const hostname = os.hostname();
  const username = os.userInfo().username || 'user';
  const osType = os.type() === 'Windows_NT' ? 'Windows' : os.type();
  const osRelease = os.release();
  const uptime = getSystemUptime();
  
  // Gorgeous Truecolor ASCII Art Logo of .DEX (matches original logo.png)
  const logo = [
    `                   \x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;43;43;43m█                        ${style.reset}`,
    `                  \x1b[38;2;63;63;63m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;72;72;72m█                        ${style.reset}`,
    `                  \x1b[38;2;48;48;48m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;68;68;68m█                        ${style.reset}`,
    `           \x1b[38;2;91;91;91m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;103;103;103m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;69;69;68m█  \x1b[38;2;49;49;49m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;111;111;111m█   \x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;42;42;42m█   \x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█ ${style.reset}`,
    `         \x1b[38;2;53;52;53m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;114;114;114m█\x1b[38;2;113;113;113m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;66;66;66m█ \x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;87;87;87m█\x1b[38;2;74;74;74m█\x1b[38;2;96;96;96m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;84;84;84m█  \x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;96;96;96m█\x1b[38;2;61;61;61m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;51;51;51m█ ${style.reset}`,
    `         \x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█      \x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;49;49;49m█\x1b[38;2;85;84;85m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;72;72;72m█\x1b[38;2;73;73;73m█\x1b[38;2;74;74;74m█\x1b[38;2;72;72;72m█\x1b[38;2;75;76;76m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█   \x1b[38;2;76;76;76m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;102;102;102m█   ${style.reset}`,
    ` \x1b[38;2;49;52;23m█\x1b[38;2;158;141;42m█\x1b[38;2;207;137;35m█\x1b[38;2;213;92;56m█\x1b[38;2;174;45;89m█\x1b[38;2;65;18;49m█  \x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;126;126;126m█      \x1b[38;2;71;71;71m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;46;46;45m█\x1b[38;2;121;121;121m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█    \x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;64;64;64m█   ${style.reset}`,
    ` \x1b[38;2;246;170;72m█\x1b[38;2;255;148;73m█\x1b[38;2;254;78;96m█\x1b[38;2;222;38;134m█\x1b[38;2;187;20;169m█\x1b[38;2;165;60;203m█  \x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;118;117;118m█    \x1b[38;2;104;103;103m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;59;59;59m█ \x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█     \x1b[38;2;112;112;112m█\x1b[38;2;120;120;120m█   \x1b[38;2;111;111;111m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;124;124;124m█\x1b[38;2;99;99;99m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m  ${style.reset}`,
    ` \x1b[38;2;129;53;66m█\x1b[38;2;172;57;159m█\x1b[38;2;106;49;190m█\x1b[38;2;55;56;192m█\x1b[38;2;44;68;191m█\x1b[38;2;60;65;137m█   \x1b[38;2;88;87;87m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;70;70;70m█  \x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;47;47;47m█ \x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;65;65;65m█   \x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;255;255;255m█\x1b[38;2;65;65;65m█${style.reset}`,
  ];

  const info = [
    `${style.bold}${style.cyan}${username}@${hostname}${style.reset}`,
    `${style.dim}------------------------${style.reset}`,
    `${style.bold}Product:${style.reset} .dex CLI & Web Dashboard`,
    `${style.bold}OS:${style.reset} ${osType} ${os.arch()} (${osRelease})`,
    `${style.bold}Kernel:${style.reset} ${os.version().split('\n')[0].substring(0, 30)}`,
    `${style.bold}Uptime:${style.reset} ${uptime}`,
    `${style.bold}NodeJS:${style.reset} ${process.version}`,
    `${style.dim}------------------------${style.reset}`,
    `${style.bold}Total Apps:${style.reset} ${stats.totalApps}`,
    `${style.bold}Total Launches:${style.reset} ${stats.totalLaunches}`,
    `${style.bold}Most Active:${style.reset} ${stats.mostUsedName}`,
    ``,
    `${style.dim}Tip: ${style.reset}${style.cyan}.dex help${style.reset}${style.dim} to see all commands${style.reset}`
  ];

  console.log('\n');
  const maxLines = Math.max(logo.length, info.length);
  for (let i = 0; i < maxLines; i++) {
    const logoLine = logo[i] || ' '.repeat(46);
    const infoLine = info[i] || '';
    console.log(`${logoLine}   ${infoLine}`);
  }
  console.log('\n');
}

// [v2] Dashboard server — disabled for v1 release
// async function launchDashboardServer() {
//   showBanner();
//   const port = await getAvailablePort(3000);
//   console.log(`Starting local web server...`);
//   await startServer(port);
//   console.log(`✓ Dashboard active at http://localhost:${port}`);
//   await launchUrl(`http://127.0.0.1:${port}`);
//   await new Promise(() => {});
// }

// Show CLI help menu
function showHelp() {
  console.log(`
${style.bold}${style.cyan}.DEX CLI${style.reset} - Manage and launch web apps directly from the terminal

${style.bold}Usage:${style.reset}
  .dex                      Show system info & banner
  .dex serve                Start the Web Dashboard
  .dex <command> [args]
  .dex <app-name>           (Fallback to launch app)

${style.bold}Commands:${style.reset}
  ${style.green}launch <app-names...>${style.reset}   Launch specified app(s).
    ${style.dim}-w, --workspace <name>  Launch all apps in the workspace.${style.reset}
  ${style.green}create <url> [name]${style.reset}     Create a desktop app shortcut from a URL.
    ${style.dim}--hidden                Disguise shortcut using system utility icons.${style.reset}
    ${style.dim}-w, --workspace <name>  Assign app to the specified workspace.${style.reset}
  ${style.green}update <app-id>${style.reset}         Update app URL, name, hidden status, or workspaces.
    ${style.dim}--url <url>             Update the Web URL.${style.reset}
    ${style.dim}--name <name>           Update the display name (updates shortcut).${style.reset}
    ${style.dim}--hidden <true|false>   Toggle disguised/hidden status.${style.reset}
    ${style.dim}--workspace <name>      Re-assign workspaces (comma-separated).${style.reset}
  ${style.green}list${style.reset}                    List all registered apps.
    ${style.dim}--all, -a               Show all apps including hidden ones.${style.reset}
    ${style.dim}--hidden                Show only hidden/disguised apps.${style.reset}
  ${style.green}search <query>${style.reset}            Search registered apps by name.
  ${style.green}remove <app-name>${style.reset}         Delete app metadata and desktop shortcut.
  ${style.green}recent${style.reset}                  Show recently launched apps.
  ${style.green}stats${style.reset}                   Show overall launch statistics.
  ${style.green}info <app-name>${style.reset}           Show detailed information about an app.
  ${style.green}export <file.json>${style.reset}        Export apps database to JSON file.
  ${style.green}import <file.json>${style.reset}        Import apps database from JSON file.
  ${style.green}serve${style.reset}                   Start the Web Dashboard server.
  ${style.green}suggest${style.reset}                 Show suggestions for unused apps (30+ days).
  ${style.green}clean${style.reset}                   Interactively remove unused apps.
  ${style.green}summarize${style.reset}               Show a weekly launch activity summary.
  ${style.green}help${style.reset}                    Show this help menu.
`);
}

// Main CLI logic
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Default action: show the screenfetch-style banner only
    showBanner();
    return;
  }
  
  if (args.includes('-h') || args.includes('--help') || args[0] === 'help') {
    showHelp();
    return;
  }

  if (args.includes('-v') || args.includes('--version')) {
    console.log('.DEX CLI v1.1.0');
    return;
  }

  const cmd = args[0].toLowerCase();

  switch (cmd) {
    case 'launch':
      await handleLaunch(args.slice(1));
      break;
      
    case 'create':
      await handleCreate(args.slice(1));
      break;
      
    case 'serve':
    case 'dashboard':
      // [v2] Web dashboard coming in a future release
      console.log(`${style.yellow}Web Dashboard is coming in .dex v2. Stay tuned!${style.reset}`);
      break;
      
    case 'update':
    case 'alter':
      await handleUpdate(args.slice(1));
      break;
      
    case 'list':
      handleList(args.slice(1));
      break;
      
    case 'search':
      handleSearch(args.slice(1));
      break;
      
    case 'remove':
      await handleRemove(args.slice(1));
      break;
      
    case 'recent':
      handleRecent();
      break;
      
    case 'stats':
      handleStats();
      break;
      
    case 'info':
      handleInfo(args.slice(1));
      break;
      
    case 'export':
      handleExport(args.slice(1));
      break;
      
    case 'import':
      handleImport(args.slice(1));
      break;
      
    case 'suggest':
      handleSuggest();
      break;
      
    case 'clean':
      await handleClean();
      break;
      
    case 'summarize':
      handleSummarize();
      break;
      
    default:
      // Fallback: Check if it's an app name (e.g. `.dex github`)
      await handleFallbackLaunch(cmd);
      break;
  }
}

// 1. LAUNCH COMMAND
async function handleLaunch(launchArgs) {
  if (launchArgs.length === 0) {
    console.log(`${style.red}Error: Please specify app names or use --workspace <name>${style.reset}`);
    return;
  }

  let appsToLaunch = [];
  let workspaceMode = false;
  let workspaceName = '';

  const wsIndex = launchArgs.findIndex(arg => arg === '--workspace' || arg === '-w');
  if (wsIndex !== -1) {
    workspaceMode = true;
    workspaceName = launchArgs[wsIndex + 1];
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
    for (const name of launchArgs) {
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

// FALLBACK LAUNCH (e.g. `.dex github`)
async function handleFallbackLaunch(appName) {
  const app = getApp(appName);
  if (app) {
    console.log(`Launching ${app.name}...`);
    const success = await launchUrl(app.url);
    if (success) {
      logLaunch(app.id);
      console.log(`${style.green}App Started Successfully${style.reset}`);
    } else {
      console.log(`${style.red}Failed to start app.${style.reset}`);
    }
  } else {
    console.log(`${style.red}Command or App "${appName}" not recognized.${style.reset}`);
    console.log(`Type ".dex list" to see registered apps, or ".dex help" for command options.`);
  }
}

// 2. CREATE COMMAND
async function handleCreate(createArgs) {
  if (createArgs.length === 0) {
    console.log(`${style.red}Error: Please specify a URL. Usage: .dex create <url> [name] [--hidden] [-w <workspace>]${style.reset}`);
    return;
  }

  const isHidden = createArgs.includes('--hidden');
  const filteredArgs = createArgs.filter(arg => arg !== '--hidden');

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

// 3. UPDATE COMMAND
async function handleUpdate(updateArgs) {
  if (updateArgs.length === 0) {
    console.log(`${style.red}Error: Please specify app ID. Usage: .dex update <app-id> [--url <url>] [--name <name>] [--hidden <true|false>] [--workspace <ws>]${style.reset}`);
    return;
  }

  const appId = updateArgs[0].toLowerCase();
  const app = getApp(appId);
  if (!app) {
    console.log(`${style.red}App "${appId}" not found in library.${style.reset}`);
    return;
  }

  const fields = {};
  
  // Parse Flags
  const urlIdx = updateArgs.indexOf('--url');
  if (urlIdx !== -1 && updateArgs[urlIdx + 1]) {
    let formattedUrl = updateArgs[urlIdx + 1];
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }
    fields.url = formattedUrl;
  }

  const nameIdx = updateArgs.indexOf('--name');
  if (nameIdx !== -1 && updateArgs[nameIdx + 1]) {
    fields.name = updateArgs[nameIdx + 1];
  }

  const hiddenIdx = updateArgs.indexOf('--hidden');
  if (hiddenIdx !== -1 && updateArgs[hiddenIdx + 1]) {
    fields.hidden = updateArgs[hiddenIdx + 1].toLowerCase() === 'true';
  }

  const wsIdx = updateArgs.indexOf('--workspace');
  if (wsIdx !== -1 && updateArgs[wsIdx + 1]) {
    fields.workspaces = updateArgs[wsIdx + 1].split(',').map(s => s.trim());
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

// 4. LIST COMMAND
function handleList(listArgs) {
  const showAll = listArgs.includes('--all') || listArgs.includes('-a');
  const showOnlyHidden = listArgs.includes('--hidden');
  
  const apps = getApps();
  if (apps.length === 0) {
    console.log('No apps registered yet. Create one with: .dex create <url>');
    return;
  }

  let filteredApps = apps;
  if (showOnlyHidden) {
    filteredApps = apps.filter(app => app.hidden);
  } else if (!showAll) {
    filteredApps = apps.filter(app => !app.hidden);
  }

  if (filteredApps.length === 0) {
    console.log('No matching apps to display.');
    return;
  }
  
  console.log(`${style.bold}Registered Apps:${style.reset}`);
  filteredApps.forEach((app, idx) => {
    const disguiseText = app.hidden ? ` ${style.dim}(hidden/disguised)${style.reset}` : '';
    console.log(`${idx + 1}. ${app.name}${disguiseText}`);
  });
}

// 5. SEARCH COMMAND
function handleSearch(searchArgs) {
  if (searchArgs.length === 0) {
    console.log(`${style.red}Error: Please specify search query.${style.reset}`);
    return;
  }
  
  const query = searchArgs[0].toLowerCase();
  const apps = getApps();
  const matches = apps.filter(app => app.name.toLowerCase().includes(query) || app.id.includes(query));
  
  if (matches.length === 0) {
    console.log('No matching apps found.');
    return;
  }
  
  matches.forEach(app => {
    const disguiseText = app.hidden ? ` (hidden)` : '';
    console.log(app.name + disguiseText);
  });
}

// 6. REMOVE COMMAND
async function handleRemove(removeArgs) {
  if (removeArgs.length === 0) {
    console.log(`${style.red}Error: Please specify app name. Usage: .dex remove <app>${style.reset}`);
    return;
  }
  
  const appName = removeArgs[0];
  const app = getApp(appName);
  if (!app) {
    console.log(`${style.red}App "${appName}" not found.${style.reset}`);
    return;
  }
  
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`Are you sure you want to remove ${app.name}? (Y/N): `);
  rl.close();
  
  if (answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes') {
    deleteApp(app.id);
    removeDesktopShortcut(app.name);
    console.log(`${style.green}App "${app.name}" and its shortcut deleted successfully.${style.reset}`);
  } else {
    console.log('Removal cancelled.');
  }
}

// 7. RECENT COMMAND
function handleRecent() {
  const recentApps = getRecent();
  if (recentApps.length === 0) {
    console.log('No recently launched apps.');
    return;
  }
  
  recentApps.forEach(app => {
    const paddedName = app.name.padEnd(15);
    const relTime = formatRelativeTime(app.lastOpened);
    console.log(`${paddedName} ${relTime}`);
  });
}

// 8. STATS COMMAND
function handleStats() {
  const stats = getStats();
  console.log(`
Total Apps: ${stats.totalApps}
Total Launches: ${stats.totalLaunches}
Most Used: ${stats.mostUsedName}
Least Used: ${stats.leastUsedName}
`);
}

// 9. INFO COMMAND
function handleInfo(infoArgs) {
  if (infoArgs.length === 0) {
    console.log(`${style.red}Error: Please specify app name. Usage: .dex info <app>${style.reset}`);
    return;
  }
  
  const app = getApp(infoArgs[0]);
  if (!app) {
    console.log(`${style.red}App "${infoArgs[0]}" not found.${style.reset}`);
    return;
  }
  
  const formattedCreated = new Date(app.created).toISOString().split('T')[0];
  const formattedLastOpened = formatRelativeTime(app.lastOpened);
  
  console.log(`
Name: ${app.name}
URL: ${app.url}
Created: ${formattedCreated}
Last Opened: ${formattedLastOpened}
Launches: ${app.launches}
Category: ${app.category}
Hidden: ${app.hidden ? 'Yes' : 'No'}
`);
}

// 10. EXPORT COMMAND
function handleExport(exportArgs) {
  if (exportArgs.length === 0) {
    console.log(`${style.red}Error: Please specify filename. Usage: .dex export <file.json>${style.reset}`);
    return;
  }
  
  const filepath = path.resolve(exportArgs[0]);
  const dbData = exportDb();
  
  try {
    fs.writeFileSync(filepath, dbData, 'utf-8');
    console.log(`${style.green}App library exported successfully to: ${filepath}${style.reset}`);
  } catch (err) {
    console.error(`${style.red}Failed to export library:${style.reset}`, err.message);
  }
}

// 11. IMPORT COMMAND
function handleImport(importArgs) {
  if (importArgs.length === 0) {
    console.log(`${style.red}Error: Please specify filename. Usage: .dex import <file.json>${style.reset}`);
    return;
  }
  
  const filepath = path.resolve(importArgs[0]);
  if (!fs.existsSync(filepath)) {
    console.log(`${style.red}File "${filepath}" does not exist.${style.reset}`);
    return;
  }
  
  try {
    const data = fs.readFileSync(filepath, 'utf-8');
    const success = importDb(data);
    if (success) {
      console.log(`${style.green}App library imported successfully.${style.reset}`);
    } else {
      console.log(`${style.red}Failed to import library (invalid schema).${style.reset}`);
    }
  } catch (err) {
    console.error(`${style.red}Failed to read import file:${style.reset}`, err.message);
  }
}

// 12. SUGGEST COMMAND
function handleSuggest() {
  const suggestions = getSuggestions();
  if (suggestions.length === 0) {
    console.log('No suggestions! All apps have been launched within the last 30 days.');
    return;
  }
  
  console.log(`${style.bold}Apps not used in 30 days:${style.reset}`);
  suggestions.forEach((app, idx) => {
    console.log(`${idx + 1}. ${app.name}`);
  });
}

// 13. CLEAN COMMAND
async function handleClean() {
  const suggestions = getSuggestions();
  if (suggestions.length === 0) {
    console.log('Your library is clean! All apps have been launched within the last 30 days.');
    return;
  }
  
  console.log(`${style.bold}The following apps haven't been used in 30 days:${style.reset}`);
  suggestions.forEach((app, idx) => {
    console.log(`${idx + 1}. ${app.name}`);
  });
  
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('\nWould you like to remove them? (Y/N): ');
  rl.close();
  
  if (answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes') {
    let count = 0;
    for (const app of suggestions) {
      deleteApp(app.id);
      removeDesktopShortcut(app.name);
      count++;
    }
    console.log(`${style.green}Successfully removed ${count} apps and their shortcuts.${style.reset}`);
  } else {
    console.log('Clean operation cancelled.');
  }
}

// 14. SUMMARIZE COMMAND
function handleSummarize() {
  const summary = getWeeklySummary();
  
  console.log(`
${style.bold}${style.cyan}Weekly Usage Summary${style.reset}
--------------------
Total Launches: ${summary.totalLaunches}
`);

  console.log(`${style.bold}Launches by Day:${style.reset}`);
  const days = Object.keys(summary.byDay);
  days.reverse();
  
  const maxLaunches = Math.max(...Object.values(summary.byDay), 1);
  
  days.forEach(day => {
    const val = summary.byDay[day];
    const barsCount = Math.round((val / maxLaunches) * 10);
    const bars = '█'.repeat(barsCount).padEnd(10, ' ');
    console.log("  " + day + ": " + style.cyan + bars + style.reset + " " + val);
  });
  
  console.log(`\n${style.bold}Most Active Apps:${style.reset}`);
  const sortedApps = Object.entries(summary.byApp)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
    
  if (sortedApps.length === 0) {
    console.log('  No launches recorded this week.');
  } else {
    sortedApps.forEach((item, idx) => {
      console.log(`  ${idx + 1}. ${item[0]}: ${item[1]} launch${item[1] !== 1 ? 'es' : ''}`);
    });
  }
  console.log();
}

main().catch(err => {
  console.error(`${style.red}Fatal Error:${style.reset}`, err);
  process.exit(1);
});
