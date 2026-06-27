import { getWorkspace, addWorkspace, readDb, writeDb } from '../storage/db.js';
import { importBrowserTabs } from '../core/browserSession.js';
import { getRunningGuiApps, launchCapturedApp } from '../core/osApps.js';
import { launchUrl } from '../core/launcher.js';
import { getCaptureExtensionPath, requestBrowserTabs } from '../core/tabCaptureBridge.js';
import { style, tick, isRegisteredAppUrl, isChromeAppUrl } from './utils.js';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

function parseSnapshotArgs(args) {
  const action = args[0]?.toLowerCase();
  const rest = action === 'save' || action === 'restore' ? args.slice(1) : args;
  let name = '';
  const extensionOnly = rest.includes('--extension-only');

  for (let i = 0; i < rest.length; i++) {
    if ((rest[i] === '-w' || rest[i] === '--workspace') && rest[i + 1]) {
      name = rest[i + 1];
      break;
    }
    if (!rest[i].startsWith('-')) {
      name = rest[i];
      break;
    }
  }

  return { action, name, extensionOnly };
}

async function captureBrowserTabs(extensionOnly = false) {
  try {
    const extensionTabs = await requestBrowserTabs();
    return {
      tabs: extensionTabs.map(tab => tab.url),
      tabDetails: extensionTabs,
      warnings: []
    };
  } catch (err) {
    if (extensionOnly) {
      return {
        tabs: [],
        tabDetails: [],
        warnings: [`${err.message}. Run: capture install`]
      };
    }
  }

  const browsers = ['chrome', 'edge', 'brave', 'opera', 'firefox'];
  const urls = new Set();
  const warnings = [`Extension not connected; using limited fallback parser. For accurate live tabs, load: ${getCaptureExtensionPath()}`];

  for (const browser of browsers) {
    try {
      const browserUrls = importBrowserTabs(browser);
      if (browserUrls.length > 40) {
        warnings.push(`${browser}: skipped ${browserUrls.length} extracted URLs because that looks like browser history, not open tabs`);
        continue;
      }
      browserUrls.forEach(url => urls.add(url));
    } catch (_) {}
  }

  return {
    tabs: Array.from(urls),
    tabDetails: Array.from(urls).map(url => ({ title: url, url })),
    warnings
  };
}

function isTerminalApp(app) {
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
}

async function askYesNo(question, context = {}) {
  if (context.rl) {
    const answer = await context.rl.question(question);
    return ['y', 'yes'].includes(answer.trim().toLowerCase());
  }

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(question);
    return ['y', 'yes'].includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
}

async function filterTerminalApps(osApps, context = {}) {
  const terminalApps = osApps.filter(isTerminalApp);
  if (terminalApps.length === 0) return osApps;

  const terminalNames = terminalApps.map(app => app.name).join(', ');
  console.log(`${style.yellow}Note: terminal detected by snapshot capture: ${terminalNames}.${style.reset}`);
  const keepTerminals = await askYesNo('Do you want to keep terminal window(s) in this workspace snapshot? (y/N): ', context);

  if (keepTerminals) {
    return osApps;
  }

  return osApps.filter(app => !isTerminalApp(app));
}

async function saveSnapshot(name, options = {}, context = {}) {
  let ws = getWorkspace(name);
  if (!ws) {
    ws = addWorkspace(name, []);
    console.log(`${tick} Created snapshot "${name}".`);
  }

  const { tabs, tabDetails, warnings } = await captureBrowserTabs(options.extensionOnly);
  const { getRunningVsCodeFolders } = await import('../core/osApps.js');
  const ideFolders = getRunningVsCodeFolders();
  const osApps = await filterTerminalApps(getRunningGuiApps(), context);

  const db = readDb();
  db.workspaces[ws.id].snapshot = {
    tabs,
    tabDetails,
    ideFolders,
    osApps,
    timestamp: new Date().toISOString()
  };
  writeDb(db);

  warnings.forEach(warning => {
    console.log(`${style.yellow}Warning: ${warning}${style.reset}`);
  });

  console.log(`
${style.bold}${style.green}Snapshot Saved!${style.reset}
Name: ${ws.name}
  - Browser tabs captured: ${tabs.length}
  - Apps in use captured: ${osApps.length}

${style.dim}Restore it with:${style.reset}
  snapshot restore ${ws.name}
`);
}

async function restoreSnapshot(name) {
  const ws = getWorkspace(name);
  if (!ws || !ws.snapshot) {
    console.log(`${style.yellow}No snapshot found for "${name}". Save one first with: snapshot save ${name}${style.reset}`);
    return;
  }

  const snapshot = ws.snapshot;
  console.log(`Restoring snapshot "${ws.name}"...`);

  if (snapshot.tabs && snapshot.tabs.length > 0) {
    if (snapshot.tabs.length > 40) {
      console.log(`${style.yellow}Snapshot has ${snapshot.tabs.length} browser tabs, which looks suspicious. Re-save it with: snapshot save ${ws.name}${style.reset}`);
      console.log(`${style.yellow}Skipped browser restore to avoid opening a tab flood.${style.reset}`);
    } else {
      console.log(`Opening ${snapshot.tabs.length} browser tab(s)...`);
      const tabDetailsMap = new Map();
      if (snapshot.tabDetails) {
        for (const detail of snapshot.tabDetails) {
          if (detail && detail.url) {
            tabDetailsMap.set(detail.url, detail);
          }
        }
      }
      for (const url of snapshot.tabs) {
        const detail = tabDetailsMap.get(url);
        let asApp;
        if (detail && detail.windowType !== undefined) {
          asApp = detail.windowType === 'app' || detail.windowType === 'popup';
        } else {
          asApp = isRegisteredAppUrl(url) || isChromeAppUrl(url);
        }
        await launchUrl(url, 'auto', asApp);
      }
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

  if (snapshot.osApps && snapshot.osApps.length > 0) {
    console.log(`Launching ${snapshot.osApps.length} OS app(s)...`);
    for (const app of snapshot.osApps) {
      await launchCapturedApp(app);
    }
  }

  console.log(`${tick} Snapshot restored successfully.`);
}

export default {
  name: 'snapshot',
  description: 'Save and restore named workspace snapshots',
  async execute(args, context = {}) {
    const { action, name, extensionOnly } = parseSnapshotArgs(args);

    if (!action || (action !== 'save' && action !== 'restore')) {
      console.log(`${style.red}Error: Please specify snapshot action ('save' or 'restore').${style.reset}`);
      console.log('Usage: snapshot save <name>');
      console.log('       snapshot restore <name>');
      return;
    }

    if (!name) {
      console.log(`${style.red}Error: Please specify snapshot name. Example: snapshot ${action} coding-session${style.reset}`);
      return;
    }

    if (action === 'save') {
      await saveSnapshot(name, { extensionOnly }, context);
    } else {
      await restoreSnapshot(name);
    }
  }
};
