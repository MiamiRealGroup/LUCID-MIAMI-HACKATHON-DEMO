import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, '..');
export const APP_DIR = path.join(ROOT, 'app');
export const AUDIO_DIR = path.join(ROOT, 'audio');
export const DATA_DIR = path.join(here, 'data');
export const MANIFEST_PATH = path.join(AUDIO_DIR, 'manifest.json');
