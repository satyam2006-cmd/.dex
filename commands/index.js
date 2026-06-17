import createCmd from './create.js';
import launchCmd from './launch.js';
import listCmd from './list.js';
import searchCmd from './search.js';
import removeCmd from './remove.js';
import recentCmd from './recent.js';
import statsCmd from './stats.js';
import infoCmd from './info.js';
import exportCmd from './export.js';
import importCmd from './import.js';
import suggestCmd from './suggest.js';
import cleanCmd from './clean.js';
import summarizeCmd from './summarize.js';
import helpCmd from './help.js';
import workspaceCmd from './workspace.js';
import updateCmd from './update.js';
import serveCmd from './serve.js';

const commands = [
  createCmd,
  launchCmd,
  listCmd,
  searchCmd,
  removeCmd,
  recentCmd,
  statsCmd,
  infoCmd,
  exportCmd,
  importCmd,
  suggestCmd,
  cleanCmd,
  summarizeCmd,
  helpCmd,
  workspaceCmd,
  updateCmd,
  serveCmd
];

const registry = {};
commands.forEach(cmd => {
  registry[cmd.name] = cmd;
  if (cmd.aliases) {
    cmd.aliases.forEach(alias => {
      registry[alias] = cmd;
    });
  }
});

export function getCommand(name) {
  return registry[name.toLowerCase()] || null;
}

export function getAllCommands() {
  return commands;
}

export async function executeCommand(name, args, context = {}) {
  const cmd = getCommand(name);
  if (!cmd) {
    throw new Error(`Command "${name}" not found.`);
  }
  return await cmd.execute(args, context);
}
