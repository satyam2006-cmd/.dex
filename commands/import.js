import fs from 'fs';
import path from 'path';
import { importDb } from '../storage/db.js';
import { style } from './utils.js';

export default {
  name: 'import',
  description: 'Import apps database from JSON file',
  async execute(args) {
    if (args.length === 0) {
      console.log(`${style.red}Error: Please specify filename. Usage: .dex import <file.json>${style.reset}`);
      return;
    }
    
    const filepath = path.resolve(args[0]);
    if (!fs.existsSync(filepath)) {
      console.log(`${style.red}File "${filepath}" does not exist.${style.reset}`);
      return;
    }
    
    try {
      const data = fs.readFileSync(filepath, 'utf-8');
      const success = importDb(data);
      if (success) {
        console.log(`${style.green}App library imported successfully.${style.reset}`);
      } else {
        console.log(`${style.red}Failed to import library (invalid schema).${style.reset}`);
      }
    } catch (err) {
      console.error(`${style.red}Failed to read import file:${style.reset}`, err.message);
    }
  }
};
