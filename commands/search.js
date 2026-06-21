import { style } from './utils.js';
import { buildSearchIndex, interactiveSelect, launch, printResults, search } from '../core/searchEngine.js';

export default {
  name: 'search',
  description: 'Search apps, workspaces, snapshots, profiles, and commands',
  async execute(args) {
    if (args.includes('--refresh')) {
      buildSearchIndex({ force: true });
      console.log(`${style.green}Search index refreshed.${style.reset}`);
      return;
    }

    const shouldLaunch = args.includes('--launch') || args.includes('-l');
    const queryArgs = args.filter(arg => arg !== '--launch' && arg !== '-l');

    if (queryArgs.length === 0) {
      if (!process.stdin.isTTY || !process.stdout.isTTY) {
        console.log(`${style.red}Interactive search requires a TTY. Use: search <query>${style.reset}`);
        return;
      }
      const selected = await interactiveSelect('', { message: 'Search' });
      if (selected) {
        console.log(`Launching ${selected.name}...`);
        await launch(selected);
      }
      return;
    }

    const query = queryArgs.join(' ');
    const results = await search(query, { limit: 10 });

    if (shouldLaunch) {
      const selected = results[0];
      if (!selected) {
        console.log('No matching apps, workspaces, snapshots, profiles, or commands found.');
        return;
      }
      console.log(`Launching ${selected.name}...`);
      await launch(selected);
      return;
    }

    printResults(results);
  }
};
