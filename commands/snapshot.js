import { getWorkspace, addWorkspace, readDb, writeDb } from '../storage/db.js';
import { importBrowserTabs } from '../core/browserSession.js';
import { getRunningGuiApps, launchCapturedApp } from '../core/osApps.js';
import { launchUrl } from '../core/launcher.js';
import { getCaptureExtensionPath, requestBrowserTabs } from '../core/tabCaptureBridge.js';
import { style, tick } from './utils.js';

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

async function saveSnapshot(name, options = {}) {
  let ws = getWorkspace(name);
  if (!ws) {
    ws = addWorkspace(name, []);
    console.log(`${tick} Created snapshot "${name}".`);
  }

  const { tabs, tabDetails, warnings } = await captureBrowserTabs(options.extensionOnly);
  const osApps = getRunningGuiApps();

  const db = readDb();
  db.workspaces[ws.id].snapshot = {
    tabs,
    tabDetails,
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
      for (const url of snapshot.tabs) {
        await launchUrl(url);
      }
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
  async execute(args) {
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
      await saveSnapshot(name, { extensionOnly });
    } else {
      await restoreSnapshot(name);
    }
  }
};
