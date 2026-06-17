import { style } from './utils.js';

export default {
  name: 'serve',
  aliases: ['dashboard'],
  description: 'Start the Web Dashboard server (Coming in v2)',
  async execute() {
    console.log(`${style.yellow}Web Dashboard is coming in .dex v2. Stay tuned!${style.reset}`);
  }
};
