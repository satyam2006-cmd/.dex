import fs from 'fs';
import path from 'path';
import os from 'os';
import { VERSION } from '../core/version.js';

const DB_DIR = path.join(os.homedir(), '.dex');
const DB_PATH = path.join(DB_DIR, 'apps.json');

const INITIAL_DB = {
  version: VERSION,
  apps: {},
  workspaces: {},
  launches_log: []
};

let cachedDb = null;

// Helper: Ensure DB directory and file exist
export function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(INITIAL_DB, null, 2), 'utf-8');
  }
}

// Read whole DB
export function readDb(forceRefresh = false) {
  if (cachedDb && !forceRefresh) {
    return cachedDb;
  }
  initDb();
  try {
    const content = fs.readFileSync(DB_PATH, 'utf-8');
    cachedDb = JSON.parse(content);
    // Ensure essential structure is present
    if (!cachedDb) cachedDb = { ...INITIAL_DB };
    if (!cachedDb.apps) cachedDb.apps = {};
    if (!cachedDb.workspaces) cachedDb.workspaces = {};
    if (!cachedDb.launches_log) cachedDb.launches_log = [];
    if (!cachedDb.version) cachedDb.version = VERSION;
    return cachedDb;
  } catch (err) {
    console.error('Failed to read database, resetting to initial state.', err);
    cachedDb = { ...INITIAL_DB };
    return cachedDb;
  }
}

// Write whole DB
export function writeDb(data) {
  initDb();
  cachedDb = data;
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// --- App Operations ---

export function getApps() {
  const db = readDb();
  return Object.values(db.apps);
}

export function getApp(id) {
  if (!id || typeof id !== 'string') return null;
  const db = readDb();
  const key = id.toLowerCase();
  if (db.apps[key]) return db.apps[key];
  return Object.values(db.apps).find(app => app.name?.toLowerCase() === key) || null;
}

export function addApp(app) {
  const db = readDb();
  const id = app.id.toLowerCase();
  
  const existingApp = db.apps[id] || {};
  
  db.apps[id] = {
    id,
    name: app.name,
    url: app.url || null,
    type: app.type || existingApp.type || 'web',
    path: app.path || existingApp.path || null,
    created: existingApp.created || new Date().toISOString(),
    lastOpened: existingApp.lastOpened || null,
    launches: existingApp.launches || 0,
    category: app.category || 'General',
    workspaces: app.workspaces || existingApp.workspaces || [],
    hidden: app.hidden ?? existingApp.hidden ?? false,
    iconPath: app.iconPath || existingApp.iconPath || null
  };
  
  // Make sure workspaces database has references updated if specified
  if (app.workspaces) {
    app.workspaces.forEach(wsId => {
      const wsKey = wsId.toLowerCase();
      if (!db.workspaces[wsKey]) {
        db.workspaces[wsKey] = {
          id: wsKey,
          name: wsId.charAt(0).toUpperCase() + wsId.slice(1),
          apps: []
        };
      }
      if (!db.workspaces[wsKey].apps.includes(id)) {
        db.workspaces[wsKey].apps.push(id);
      }
    });
  }
  
  writeDb(db);
  return db.apps[id];
}

export function updateApp(id, fields) {
  const db = readDb();
  const key = id.toLowerCase();
  if (!db.apps[key]) return null;
  
  const app = db.apps[key];
  
  if (fields.name !== undefined) app.name = fields.name;
  if (fields.url !== undefined) app.url = fields.url;
  if (fields.type !== undefined) app.type = fields.type;
  if (fields.path !== undefined) app.path = fields.path;
  if (fields.category !== undefined) app.category = fields.category;
  if (fields.hidden !== undefined) app.hidden = fields.hidden;
  
  // Handle workspace updates if provided
  if (fields.workspaces !== undefined) {
    // remove from all workspaces first
    Object.keys(db.workspaces).forEach(wsKey => {
      db.workspaces[wsKey].apps = db.workspaces[wsKey].apps.filter(appId => appId !== key);
    });
    
    app.workspaces = fields.workspaces.map(w => w.toLowerCase());
    
    // add to new workspaces
    fields.workspaces.forEach(wsId => {
      const wsKey = wsId.toLowerCase();
      if (!db.workspaces[wsKey]) {
        db.workspaces[wsKey] = {
          id: wsKey,
          name: wsId.charAt(0).toUpperCase() + wsId.slice(1),
          apps: []
        };
      }
      if (!db.workspaces[wsKey].apps.includes(key)) {
        db.workspaces[wsKey].apps.push(key);
      }
    });
  }
  
  writeDb(db);
  return app;
}

export function deleteApp(id) {
  const db = readDb();
  const key = id.toLowerCase();
  if (!db.apps[key]) return false;
  
  const app = db.apps[key];
  
  // Remove from workspaces
  Object.keys(db.workspaces).forEach(wsKey => {
    db.workspaces[wsKey].apps = db.workspaces[wsKey].apps.filter(appId => appId !== key);
  });
  
  // Remove from apps
  delete db.apps[key];
  
  // Remove logs for this app
  db.launches_log = db.launches_log.filter(log => log.appId !== key);
  
  writeDb(db);
  return app;
}

// --- Workspace Operations ---

export function getWorkspaces() {
  const db = readDb();
  return db.workspaces;
}

export function getWorkspace(id) {
  if (!id || typeof id !== 'string') return null;
  const db = readDb();
  return db.workspaces[id.toLowerCase()] || null;
}

export function addWorkspace(name, appIds = []) {
  const db = readDb();
  const id = name.toLowerCase();
  const existingWorkspace = db.workspaces[id] || {};
  
  db.workspaces[id] = {
    id,
    name: name,
    apps: appIds.map(appId => appId.toLowerCase()),
    snapshot: existingWorkspace.snapshot || null
  };
  
  // Update workspace lists in apps
  Object.keys(db.apps).forEach(appKey => {
    const app = db.apps[appKey];
    if (db.workspaces[id].apps.includes(appKey)) {
      if (!app.workspaces.includes(id)) {
        app.workspaces.push(id);
      }
    } else {
      app.workspaces = app.workspaces.filter(wsId => wsId !== id);
    }
  });
  
  writeDb(db);
  return db.workspaces[id];
}

export function deleteWorkspace(id) {
  if (!id || typeof id !== 'string') return false;
  const db = readDb();
  const key = id.toLowerCase();
  if (!db.workspaces[key]) return false;
  
  // Update apps
  Object.keys(db.apps).forEach(appKey => {
    const app = db.apps[appKey];
    if (app && app.workspaces) {
      app.workspaces = app.workspaces.filter(wsId => wsId !== key);
    }
  });
  
  delete db.workspaces[key];
  writeDb(db);
  return true;
}

// --- Stats & Logging ---

export function logLaunch(appId) {
  const db = readDb();
  const key = appId.toLowerCase();
  if (!db.apps[key]) return false;
  
  const timestamp = new Date().toISOString();
  db.apps[key].lastOpened = timestamp;
  db.apps[key].launches += 1;
  
  db.launches_log.push({
    appId: key,
    timestamp
  });
  
  writeDb(db);
  return db.apps[key];
}

export function getStats() {
  const db = readDb();
  const apps = Object.values(db.apps);
  
  const totalApps = apps.length;
  const totalLaunches = apps.reduce((sum, app) => sum + app.launches, 0);
  
  let mostUsed = null;
  let leastUsed = null;
  
  if (apps.length > 0) {
    // Sort by launches descending for most used
    const sortedByUsage = [...apps].sort((a, b) => b.launches - a.launches);
    mostUsed = sortedByUsage[0];
    leastUsed = sortedByUsage[sortedByUsage.length - 1];
  }
  
  return {
    totalApps,
    totalLaunches,
    mostUsedName: mostUsed ? mostUsed.name : 'N/A',
    leastUsedName: leastUsed ? leastUsed.name : 'N/A'
  };
}

export function getRecent() {
  const apps = getApps();
  // Filter for apps that have been opened at least once and sort by lastOpened desc
  return apps
    .filter(app => app.lastOpened)
    .sort((a, b) => new Date(b.lastOpened) - new Date(a.lastOpened));
}

// Returns apps not opened in 30 days
export function getSuggestions() {
  const apps = getApps();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  return apps.filter(app => {
    // If never opened and created more than 7 days ago (to give user time to open new apps)
    if (!app.lastOpened) {
      const createdDate = new Date(app.created);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return createdDate < sevenDaysAgo;
    }
    
    const lastOpenedDate = new Date(app.lastOpened);
    return lastOpenedDate < thirtyDaysAgo;
  });
}

// Summarize launches by day for last 7 days
export function getWeeklySummary() {
  const db = readDb();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Filter logs in the last 7 days
  const recentLogs = db.launches_log.filter(log => new Date(log.timestamp) >= sevenDaysAgo);
  
  const summaryByApp = {};
  const summaryByDay = {};
  
  // Initialize days
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayStr = d.toLocaleDateString(undefined, { weekday: 'short' });
    summaryByDay[dayStr] = 0;
  }
  
  recentLogs.forEach(log => {
    const appName = db.apps[log.appId] ? db.apps[log.appId].name : log.appId;
    summaryByApp[appName] = (summaryByApp[appName] || 0) + 1;
    
    const dayStr = new Date(log.timestamp).toLocaleDateString(undefined, { weekday: 'short' });
    if (dayStr in summaryByDay) {
      summaryByDay[dayStr] += 1;
    }
  });
  
  return {
    totalLaunches: recentLogs.length,
    byApp: summaryByApp,
    byDay: summaryByDay
  };
}

// Export database content as JSON string
export function exportDb() {
  const db = readDb();
  return JSON.stringify(db, null, 2);
}

// Import database content
export function importDb(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data.apps || !data.workspaces) {
      throw new Error("Invalid schema: missing 'apps' or 'workspaces'");
    }
    writeDb(data);
    return true;
  } catch (err) {
    console.error('Import failed:', err.message);
    return false;
  }
}
