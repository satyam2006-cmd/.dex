import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import os from 'os';
import fs from 'fs';
import path from 'path';

import { getCommand } from '../commands/index.js';
import { getApps, getWorkspaces, getStats, getRecent } from '../storage/db.js';
import { style, formatRelativeTime, getSystemUptime } from '../commands/utils.js';

const historyFile = path.join(os.homedir(), '.dex', 'history.txt');

// Load history from file (newest first for readline)
function loadHistory() {
  try {
    if (fs.existsSync(historyFile)) {
      return fs.readFileSync(historyFile, 'utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .reverse();
    }
  } catch (err) {
    // Silently ignore history load errors
  }
  return [];
}

// Save command to history file
function saveHistory(command) {
  try {
    const dir = path.dirname(historyFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(historyFile, command + '\n', 'utf-8');
  } catch (err) {
    // Silently ignore history save errors
  }
}

// Branded Startup Screen
function showBrandedStartupScreen() {
  const stats = getStats();
  const username = os.userInfo().username || 'user';
  const hostname = os.hostname();
  const osType = os.type() === 'Windows_NT' ? 'Windows' : os.type();
  const osRelease = os.release();
  const uptime = getSystemUptime();
  
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
    `${style.dim}Tip: Type ${style.reset}${style.bold}help${style.reset}${style.dim} to see all commands`,
    `${style.dim}Type ${style.reset}${style.bold}exit${style.reset}${style.dim} to quit shell`
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

// Tab Completer
export function completer(line) {
  const builtInCommands = [
    'launch', 'create', 'update', 'list', 'search', 'remove', 
    'recent', 'stats', 'info', 'export', 'import', 'suggest', 
    'clean', 'summarize', 'help', 'exit', 'workspace', 'clear', 'cls'
  ];

  const apps = getApps();
  const appNames = apps.map(a => a.name.toLowerCase());
  const appIds = apps.map(a => a.id);
  const workspaces = Object.keys(getWorkspaces());

  const parts = line.trimStart().split(/\s+/);
  const currentWord = parts[parts.length - 1] || '';
  const isTrailingSpace = line.endsWith(' ');

  // If we're at the very start of the line or only typing the command name
  if (parts.length === 0 || (parts.length === 1 && !isTrailingSpace)) {
    const query = parts[0] ? parts[0].toLowerCase() : '';
    // Suggest commands and also app names (since unknown commands fallback to launch <app-name>)
    const candidates = [...builtInCommands, ...appIds, ...appNames];
    const uniqueCandidates = [...new Set(candidates)];
    const hits = uniqueCandidates.filter(c => c.startsWith(query));
    return [hits.length ? hits : uniqueCandidates, query];
  }

  // We are parsing arguments of a command
  const cmd = parts[0].toLowerCase();

  if (cmd === 'launch' || cmd === 'remove' || cmd === 'info' || cmd === 'update') {
    const query = isTrailingSpace ? '' : currentWord.toLowerCase();
    const candidates = [...appIds, ...appNames];
    const hits = candidates.filter(c => c.startsWith(query));
    return [hits, query];
  }

  if (cmd === 'workspace') {
    // workspace subcommand
    if (parts.length === 2 && !isTrailingSpace) {
      const query = parts[1].toLowerCase();
      const candidates = ['create', 'add', 'remove', 'list'];
      const hits = candidates.filter(c => c.startsWith(query));
      return [hits, query];
    }

    if (parts.length === 2 && isTrailingSpace) {
      // User typed "workspace " -> suggest subcommands
      const candidates = ['create', 'add', 'remove', 'list'];
      return [candidates, ''];
    }

    // workspace add/remove subcommand arguments
    const sub = parts[1].toLowerCase();
    if (sub === 'add' || sub === 'remove' || sub === 'delete') {
      if (parts.length === 3 && !isTrailingSpace) {
        // user typed "workspace add co" -> complete workspace name
        const query = parts[2].toLowerCase();
        const hits = workspaces.filter(w => w.startsWith(query));
        return [hits, query];
      }

      if (parts.length === 3 && isTrailingSpace) {
        // user typed "workspace add coding " -> complete app names
        const candidates = [...appIds, ...appNames];
        return [candidates, ''];
      }

      if (parts.length === 4 && !isTrailingSpace) {
        // user typed "workspace add coding gi" -> complete app names
        const query = parts[3].toLowerCase();
        const candidates = [...appIds, ...appNames];
        const hits = candidates.filter(c => c.startsWith(query));
        return [hits, query];
      }
    }
  }

  return [[], ''];
}

// Start REPL Shell
export async function startRepl() {
  process.title = '.dex';
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b]2;.dex\x07');
  }
  showBrandedStartupScreen();

  const rl = readline.createInterface({
    input,
    output,
    completer,
    historySize: 100
  });

  // Load history from file
  rl.history = loadHistory();

  // Handle Ctrl+C
  rl.on('SIGINT', () => {
    console.log('\nGoodbye!');
    rl.close();
    process.exit(0);
  });

  while (true) {
    try {
      const line = await rl.question(`${style.bold}${style.cyan}.dex>${style.reset} `);
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        console.log('Goodbye!');
        rl.close();
        process.exit(0);
      }

      if (trimmed.toLowerCase() === 'clear' || trimmed.toLowerCase() === 'cls') {
        process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
        console.clear();
        showBrandedStartupScreen();
        continue;
      }

      saveHistory(trimmed);

      const parts = trimmed.split(/\s+/);
      const cmdName = parts[0];
      const cmdArgs = parts.slice(1);

      const cmd = getCommand(cmdName);
      if (cmd) {
        await cmd.execute(cmdArgs, { rl, isInteractiveShell: true });
      } else {
        // Fallback: Unknown commands should attempt: launch <app-name>
        const app = getApps().find(a => a.id === cmdName.toLowerCase() || a.name.toLowerCase() === cmdName.toLowerCase());
        if (app) {
          const launchCmd = getCommand('launch');
          await launchCmd.execute([app.id], { rl, isInteractiveShell: true });
        } else {
          console.log(`${style.red}Command or App "${cmdName}" not recognized.${style.reset}`);
          console.log(`Type ${style.bold}help${style.reset} to see available commands.`);
        }
      }
    } catch (err) {
      console.error(`${style.red}Error executing command:${style.reset}`, err);
    }
  }
}
