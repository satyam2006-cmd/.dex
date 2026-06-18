import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Custom LZ4 block decompressor for Firefox's jsonlz4 format.
 * Firefox jsonlz4 files start with "mozLz40\0", followed by the 4-byte uncompressed size (LE),
 * then the raw LZ4-compressed block data.
 */
function decompressFirefoxLz4(buf) {
  if (buf.length < 12 || buf.toString('ascii', 0, 8) !== 'mozLz40\0') {
    throw new Error('Not a valid Firefox jsonlz4 file');
  }
  const decompressedSize = buf.readUInt32LE(8);
  const compressed = buf.subarray(12);
  const decompressed = Buffer.alloc(decompressedSize);
  
  let i = 0;
  let j = 0;
  
  while (i < compressed.length) {
    const token = compressed[i++];
    let literalLen = token >> 4;
    
    if (literalLen === 15) {
      let b;
      do {
        b = compressed[i++];
        literalLen += b;
      } while (b === 255);
    }
    
    // Copy literals
    if (j + literalLen > decompressedSize) break;
    compressed.copy(decompressed, j, i, i + literalLen);
    i += literalLen;
    j += literalLen;
    
    if (i >= compressed.length) break;
    
    const offset = compressed.readUInt16LE(i);
    i += 2;
    
    let matchLen = token & 0x0F;
    if (matchLen === 15) {
      let b;
      do {
        b = compressed[i++];
        matchLen += b;
      } while (b === 255);
    }
    matchLen += 4;
    
    let ref = j - offset;
    for (let k = 0; k < matchLen; k++) {
      if (j >= decompressedSize) break;
      decompressed[j++] = decompressed[ref++];
    }
  }
  return decompressed;
}

function isValidTabUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.hostname &&
      parsed.hostname !== 'newtab' &&
      !parsed.hostname.includes('chrome-extension')
    );
  } catch (_) {
    return false;
  }
}

function extractUrlsFromBuffer(buffer) {
  const str = buffer.toString('binary');
  const regex = /https?:\/\/[a-zA-Z0-9\-._~:\/?#\[\]@!$&'()*+,;=%]+/g;
  const matches = str.match(regex) || [];
  const urls = [];

  for (let url of matches) {
    url = url.split(/[)\]}"',]/)[0];
    if (isValidTabUrl(url)) {
      urls.push(url);
    }
  }

  return urls;
}

function readChromiumCommands(content) {
  const commands = [];
  let offset = 0;

  if (content.length >= 8 && content.toString('ascii', 0, 4) === 'SNSS') {
    offset = 8;
  }

  while (offset + 3 <= content.length) {
    const size = content.readUInt16LE(offset);
    offset += 2;

    if (size < 1 || offset + size > content.length) {
      break;
    }

    const id = content.readUInt8(offset);
    const payload = content.subarray(offset + 1, offset + size);
    commands.push({ id, payload });
    offset += size;
  }

  return commands;
}

function isPlausibleTabId(value) {
  return Number.isInteger(value) && value > 0 && value < 10000000;
}

function isPlausibleNavigationIndex(value) {
  return Number.isInteger(value) && value >= 0 && value < 1000;
}

/**
 * Extracts the current URL for each open Chromium tab from a Tabs_* file.
 *
 * Chromium tab session files store one command per navigation entry. A plain
 * URL regex sees every back/forward history item, so this parser groups
 * navigation commands by tab id and keeps one selected/latest navigation.
 */
function extractChromiumUrls(filePath) {
  const tempPath = path.join(os.tmpdir(), `dex_bs_${path.basename(filePath)}`);
  try {
    fs.copyFileSync(filePath, tempPath);
    const content = fs.readFileSync(tempPath);
    try { fs.unlinkSync(tempPath); } catch (_) {}

    const tabs = new Map();
    const commands = readChromiumCommands(content);

    for (const command of commands) {
      if (command.payload.length < 8) continue;

      const tabId = command.payload.readInt32LE(0);
      const navIndex = command.payload.readInt32LE(4);
      if (!isPlausibleTabId(tabId)) continue;

      if (command.id === 9 && isPlausibleNavigationIndex(navIndex)) {
        const tab = tabs.get(tabId) || { selectedIndex: null, navigations: new Map() };
        tab.selectedIndex = navIndex;
        tabs.set(tabId, tab);
        continue;
      }

      if (!isPlausibleNavigationIndex(navIndex)) continue;

      const urls = extractUrlsFromBuffer(command.payload);
      if (urls.length === 0) continue;

      const tab = tabs.get(tabId) || { selectedIndex: null, navigations: new Map() };
      tab.navigations.set(navIndex, urls[0]);
      tabs.set(tabId, tab);
    }

    const currentUrls = [];
    for (const tab of tabs.values()) {
      let url = tab.selectedIndex !== null ? tab.navigations.get(tab.selectedIndex) : null;
      if (!url && tab.navigations.size > 0) {
        const latestIndex = Math.max(...tab.navigations.keys());
        url = tab.navigations.get(latestIndex);
      }
      if (url && !currentUrls.includes(url)) {
        currentUrls.push(url);
      }
    }

    return currentUrls;
  } catch (err) {
    try { fs.unlinkSync(tempPath); } catch (_) {}
    throw err;
  }
}

/**
 * Extracts URLs from Firefox jsonlz4 files.
 */
function extractFirefoxUrls(filePath) {
  const content = fs.readFileSync(filePath);
  const decompressed = decompressFirefoxLz4(content);
  const jsonStr = decompressed.toString('utf-8');
  const session = JSON.parse(jsonStr);
  const urls = new Set();
  
  if (session && session.windows) {
    for (const win of session.windows) {
      if (win.tabs) {
        for (const tab of win.tabs) {
          if (tab.entries && tab.entries.length > 0) {
            const lastEntry = tab.entries[tab.entries.length - 1];
            if (lastEntry.url && lastEntry.url.startsWith('http')) {
              urls.add(lastEntry.url);
            }
          }
        }
      }
    }
  }
  return Array.from(urls);
}

/**
 * Resolves standard user data / profile paths for the given browser.
 */
export function getBrowserSessionsPaths(browser) {
  const home = os.homedir();
  const paths = [];
  
  if (browser === 'chrome') {
    paths.push(path.join(home, 'AppData\\Local\\Google\\Chrome\\User Data'));
  } else if (browser === 'edge') {
    paths.push(path.join(home, 'AppData\\Local\\Microsoft\\Edge\\User Data'));
  } else if (browser === 'brave') {
    paths.push(path.join(home, 'AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data'));
  } else if (browser === 'opera') {
    paths.push(path.join(home, 'AppData\\Roaming\\Opera Software\\Opera Stable'));
    paths.push(path.join(home, 'AppData\\Roaming\\Opera Software\\Opera GX Stable'));
  } else if (browser === 'firefox') {
    paths.push(path.join(home, 'AppData\\Roaming\\Mozilla\\Firefox\\Profiles'));
  }
  
  return paths.filter(p => fs.existsSync(p));
}

/**
 * Reads all active open tabs for the specified browser, automatically skipping locked files.
 * @param {string} browserName - e.g. "chrome", "edge", "brave", "opera", "firefox"
 * @returns {string[]} List of unique URLs
 */
export function importBrowserTabs(browserName) {
  const browser = browserName.toLowerCase();
  const basePaths = getBrowserSessionsPaths(browser);
  
  if (basePaths.length === 0) {
    throw new Error(`Could not find profile folders for browser "${browserName}".`);
  }
  
  if (browser === 'firefox') {
    const urls = new Set();
    for (const base of basePaths) {
      try {
        const profiles = fs.readdirSync(base);
        for (const profile of profiles) {
          const recoveryPath = path.join(base, profile, 'sessionstore-backups', 'recovery.jsonlz4');
          const prevPath = path.join(base, profile, 'sessionstore-backups', 'previous.jsonlz4');
          
          for (const p of [recoveryPath, prevPath]) {
            if (fs.existsSync(p)) {
              try {
                const fileUrls = extractFirefoxUrls(p);
                fileUrls.forEach(u => urls.add(u));
                if (fileUrls.length > 0) break; 
              } catch (_) {}
            }
          }
        }
      } catch (_) {}
    }
    return Array.from(urls);
  }
  
  // Chromium browsers
  const sessionsDirs = [];
  for (const base of basePaths) {
    try {
      const children = fs.readdirSync(base);
      for (const child of children) {
        const fullChild = path.join(base, child);
        if (fs.statSync(fullChild).isDirectory()) {
          const sessionsPath = path.join(fullChild, 'Sessions');
          if (fs.existsSync(sessionsPath)) {
            sessionsDirs.push(sessionsPath);
          }
        }
      }
      const directSessions = path.join(base, 'Sessions');
      if (fs.existsSync(directSessions)) {
        sessionsDirs.push(directSessions);
      }
    } catch (_) {}
  }
  
  if (sessionsDirs.length === 0) {
    throw new Error(`No active profiles or sessions found for browser "${browserName}".`);
  }
  
  const tabFiles = [];
  for (const dir of sessionsDirs) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.startsWith('Tabs_')) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          tabFiles.push({
            path: fullPath,
            mtime: stat.mtimeMs
          });
        }
      }
    } catch (_) {}
  }
  
  tabFiles.sort((a, b) => b.mtime - a.mtime);
  
  // Tabs_* files are much closer to currently open tabs. Session_* files can
  // include a large amount of back/forward history and cause inflated captures.
  for (const fileInfo of tabFiles) {
    try {
      const urls = extractChromiumUrls(fileInfo.path);
      if (urls.length > 0) {
        return urls; 
      }
    } catch (_) {}
  }
  
  return [];
}
