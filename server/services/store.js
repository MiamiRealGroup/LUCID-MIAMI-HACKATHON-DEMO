import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from '../paths.js';

export async function readJson(name, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, name), 'utf8'));
  } catch {
    return fallback;
  }
}

export async function writeJson(name, data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, name), JSON.stringify(data, null, 2) + '\n');
}
