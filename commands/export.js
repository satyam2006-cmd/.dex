import fs from 'fs';
import path from 'path';
import { exportDb } from '../storage/db.js';
import { style } from './utils.js';

export default {
  name: 'export',
  description: 'Export apps database to JSON file',
  async execute(args) {
    if (args.length === 0) {
      console.log(`${style.red}Error: Please specify filename. Usage: .dex export <file.json>${style.reset}`);
      return;
    }
    
    const filepath = path.resolve(args[0]);
    const dbData = exportDb();
    
    try {
      fs.writeFileSync(filepath, dbData, 'utf-8');
      console.log(`${style.green}App library exported successfully to: ${filepath}${style.reset}`);
    } catch (err) {
      console.error(`${style.red}Failed to export library:${style.reset}`, err.message);
    }
  }
};
