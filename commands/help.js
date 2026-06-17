import { style } from './utils.js';

export default {
  name: 'help',
  description: 'Show help menu and available commands',
  async execute() {
    console.log(`
${style.bold}${style.cyan}.DEX CLI & Shell${style.reset} - Manage and launch web apps directly from the terminal

${style.bold}Usage:${style.reset}
  .dex                      Starts interactive REPL shell (when run with no args)
  .dex <command> [args]     Run command directly

${style.bold}Shell Commands:${style.reset}
  ${style.green}help${style.reset}                    Show this help menu
  ${style.green}clear${style.reset}                   Clear the terminal screen
  ${style.green}exit${style.reset}                    Exit the REPL shell
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
  ${style.green}suggest${style.reset}                 Show suggestions for unused apps (30+ days).
  ${style.green}clean${style.reset}                   Interactively remove unused apps.
  ${style.green}summarize${style.reset}               Show a weekly launch activity summary.
  ${style.green}workspace <subcommand>${style.reset}      Manage workspaces.
    ${style.dim}create <name>           Create a new workspace.${style.reset}
    ${style.dim}add <ws> <app>          Add an app to a workspace.${style.reset}
    ${style.dim}remove <ws> [app]       Remove an app or delete workspace.${style.reset}
    ${style.dim}launch <name>           Launch all apps in the workspace.${style.reset}
    ${style.dim}list                    List all workspaces.${style.reset}
`);
  }
};

