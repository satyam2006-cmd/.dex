import { launchUrl } from './launcher.js';
import { launchPath, launchSystemCommand } from './osApps.js';
import {
  buildCatalog,
  readSearchIndex,
  writeSearchIndex,
  searchIndexIsFresh
} from './appIndexer.js';
import { findExactResult, rankResults } from './rankingEngine.js';
import { getApp, logLaunch } from '../storage/db.js';

const FUSE_OPTIONS = {
  includeScore: true,
  includeMatches: true,
  threshold: 0.42,
  ignoreLocation: true,
  minMatchCharLength: 1,
  keys: [
    { name: 'name', weight: 0.55 },
    { name: 'aliases', weight: 0.25 },
    { name: 'category', weight: 0.1 },
    { name: 'path', weight: 0.06 },
    { name: 'type', weight: 0.04 }
  ]
};

async function loadFuse() {
  try {
    const mod = await import('fuse.js');
    return mod.default || mod;
  } catch (_) {
    return null;
  }
}

function fallbackSearch(items, query) {
  const q = String(query || '').toLowerCase();
  return items
    .filter(item => {
      const haystack = [item.name, item.path, item.category, item.type, ...(item.aliases || [])]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q) || q.split(/\s+/).every(part => haystack.includes(part));
    })
    .map(item => ({ item, score: item.name.toLowerCase() === q ? 0 : 0.35, matches: [] }));
}

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function compactText(value) {
  return normalizeText(value).replace(/\s+/g, '');
}

function isStrongShortQueryMatch(item, query) {
  const normalized = normalizeText(query);
  const compact = compactText(query);
  if (normalized.length > 2) return true;

  const fields = [
    item.id,
    item.name,
    item.path,
    item.category,
    ...(item.aliases || [])
  ].map(value => ({ normalized: normalizeText(value), compact: compactText(value) }));

  return fields.some(field =>
    field.normalized === normalized ||
    field.normalized.startsWith(normalized) ||
    field.compact === compact ||
    field.compact.startsWith(compact)
  );
}

function resultLabel(result) {
  const category = result.category && result.category !== 'General' ? ` · ${result.category}` : '';
  return `${result.name} (${result.type}${category})`;
}

export function buildSearchIndex(options = {}) {
  const items = buildCatalog({ force: options.force, includeHidden: options.includeHidden });
  writeSearchIndex(items);
  return items;
}

export function getSearchIndex(options = {}) {
  if (!options.force && searchIndexIsFresh()) {
    const cached = readSearchIndex();
    if (cached.length > 0) return cached;
  }
  return buildSearchIndex(options);
}

export async function search(query, options = {}) {
  const items = getSearchIndex(options);
  const trimmed = String(query || '').trim();
  if (!trimmed) {
    return rankResults(items.map(item => ({ item, score: 0.7, matches: [] })), trimmed).slice(0, options.limit || 20);
  }

  const exact = findExactResult(items, trimmed);
  const Fuse = await loadFuse();
  const rawResults = Fuse
    ? new Fuse(items, FUSE_OPTIONS).search(trimmed)
    : fallbackSearch(items, trimmed);

  const merged = new Map();
  if (exact) merged.set(exact.id, { item: exact, score: 0, matches: [] });
  rawResults
    .filter(result => isStrongShortQueryMatch(result.item, trimmed))
    .forEach(result => merged.set(result.item.id, result));

  return rankResults(Array.from(merged.values()), trimmed).slice(0, options.limit || 20);
}

export async function recordLaunch(result) {
  if (!result?.id) return false;
  const items = getSearchIndex();
  const now = Date.now();
  const updated = items.map(item => {
    if (item.id !== result.id) return item;
    return {
      ...item,
      launchCount: (Number(item.launchCount) || 0) + 1,
      lastUsed: now
    };
  });
  writeSearchIndex(updated);

  if (result.type === 'web-app' && result.appId && getApp(result.appId)) {
    logLaunch(result.appId);
  }
  return true;
}

export async function launch(result, args = []) {
  if (!result) return false;
  let success = false;

  if (result.type === 'web-app') {
    success = await launchUrl(result.url || result.path);
  } else if (result.type === 'os-app') {
    if (result.path && String(result.path).startsWith('shell:')) {
      success = await launchSystemCommand('explorer.exe', [result.path]);
    } else if (result.path && String(result.path).startsWith('ms-settings:')) {
      success = await launchSystemCommand('explorer.exe', [result.path]);
    } else {
      success = result.path ? await launchPath(result.path) : false;
    }
    if (!success && result.appId && String(result.appId).includes('!')) {
      success = await launchSystemCommand('explorer.exe', [`shell:AppsFolder\\${result.appId}`]);
    }
    if (!success && result.name) {
      success = await launchSystemCommand(result.name);
    }
  } else if (result.type === 'workspace') {
    const { executeCommand } = await import('../commands/index.js');
    await executeCommand('launch', ['--workspace', result.workspaceId || result.path]);
    success = true;
  } else if (result.type === 'snapshot') {
    const { executeCommand } = await import('../commands/index.js');
    await executeCommand('snapshot', ['restore', result.workspaceId || result.path]);
    success = true;
  } else if (result.type === 'command') {
    const { executeCommand } = await import('../commands/index.js');
    await executeCommand(result.path, args);
    success = true;
  } else if (result.type === 'profile') {
    const { executeCommand } = await import('../commands/index.js');
    await executeCommand('profile', ['launch', result.profileId || result.path]);
    success = true;
  }

  if (success) {
    await recordLaunch(result);
  }
  return success;
}

export async function findLaunchCandidate(query, options = {}) {
  const results = await search(query, { ...options, limit: options.limit || 10 });
  const exact = results.find(result => {
    const normalized = String(query || '').toLowerCase();
    return result.name.toLowerCase() === normalized ||
      result.path?.toLowerCase?.() === normalized ||
      (result.aliases || []).some(alias => String(alias).toLowerCase() === normalized);
  });
  return { exact: exact || null, results };
}

export async function interactiveSelect(query = '', options = {}) {
  const initialResults = await search(query, { limit: options.limit || 10 });
  if (initialResults.length === 0) return null;

  try {
    const { AutoComplete, Select } = await import('enquirer');
    if (AutoComplete) {
      const prompt = new AutoComplete({
        name: 'result',
        message: options.message || 'Search',
        initial: query,
        limit: options.limit || 10,
        choices: initialResults.map(result => ({
          name: result.id,
          message: resultLabel(result),
          value: result.id
        })),
        async suggest(input, choices) {
          const results = await search(input || query, { limit: options.limit || 10 });
          const allowed = new Set(results.map(result => result.id));
          return choices.filter(choice => allowed.has(choice.name));
        }
      });
      const selectedId = await prompt.run();
      return searchById(selectedId);
    }

    const prompt = new Select({
      name: 'result',
      message: options.message || 'Select result',
      choices: initialResults.map(result => ({ name: resultLabel(result), value: result.id }))
    });
    const selectedId = await prompt.run();
    return searchById(selectedId);
  } catch (err) {
    if (err?.name === 'CancelPromptError' || err?.message === 'cancelled') return null;
    return initialResults[0];
  }
}

export function searchById(id) {
  return getSearchIndex().find(item => item.id === id) || null;
}

export function printResults(results) {
  if (results.length === 0) {
    console.log('No matching apps, workspaces, snapshots, or commands found.');
    return;
  }

  results.forEach((result, index) => {
    const prefix = index === 0 ? '❯' : ' ';
    console.log(`${prefix} ${resultLabel(result)}`);
  });
}
