function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function recencyBoost(lastUsed) {
  if (!lastUsed) return 0;
  const ageMs = Date.now() - Number(lastUsed);
  if (ageMs <= 0) return 20;
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  if (ageDays < 1) return 20;
  if (ageDays < 7) return 14;
  if (ageDays < 30) return 8;
  return 2;
}

function metadataBoost(item) {
  let boost = 0;
  if (item.publisher) boost += 4;
  if (item.productName) boost += 3;
  if (item.targetPath && /\.exe$/i.test(item.targetPath)) boost += 3;
  if (item.installLocation) boost += 3;
  if (item.iconPath) boost += 1;
  if (item.source === 'System Intent') boost += 12;
  if (item.source === 'Get-StartApps') boost += 5;
  if (item.source === 'Registry App Paths') boost += 4;
  if (/documentation|release notes|faq|uninstall|readme|license/i.test(`${item.name} ${item.description || ''}`)) {
    boost -= 30;
  }
  return boost;
}

export function rankSearchResult(result, query) {
  const item = result.item || result;
  const normalizedQuery = normalize(query);
  const normalizedName = normalize(item.name);
  const aliases = Array.isArray(item.aliases) ? item.aliases.map(normalize) : [];
  const fuseScore = typeof result.score === 'number' ? result.score : 1;

  let score = 0;
  if (normalizedName === normalizedQuery) score += 100;
  if (normalizedName.startsWith(normalizedQuery)) score += 50;
  if (normalizedName.includes(normalizedQuery)) score += 25;
  if (aliases.includes(normalizedQuery)) score += 70;
  if (aliases.some(alias => alias.startsWith(normalizedQuery))) score += 35;
  if (aliases.some(alias => alias.includes(normalizedQuery))) score += 20;

  score += Math.max(0, 40 * (1 - fuseScore));
  score += Math.min(25, Math.log2((Number(item.launchCount) || 0) + 1) * 6);
  score += recencyBoost(item.lastUsed);
  score += metadataBoost(item);

  if (item.type === 'os-app') score += 3;
  if (item.type === 'web-app') score += 2;

  return {
    ...item,
    score,
    fuzzyScore: fuseScore,
    matchedOn: result.matches || []
  };
}

export function rankResults(results, query) {
  return results
    .map(result => rankSearchResult(result, query))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if ((b.launchCount || 0) !== (a.launchCount || 0)) return (b.launchCount || 0) - (a.launchCount || 0);
      return String(a.name).localeCompare(String(b.name));
    });
}

export function findExactResult(items, query) {
  const normalizedQuery = normalize(query);
  return items.find(item => {
    const name = normalize(item.name);
    const id = normalize(item.id);
    const aliases = Array.isArray(item.aliases) ? item.aliases.map(normalize) : [];
    return name === normalizedQuery || id === normalizedQuery || aliases.includes(normalizedQuery);
  }) || null;
}
