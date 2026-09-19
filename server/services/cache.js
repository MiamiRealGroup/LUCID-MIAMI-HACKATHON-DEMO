import fs from 'node:fs/promises';
import path from 'node:path';
import { AUDIO_DIR } from '../paths.js';

// Minimal audio sniff so a failed/garbled download can never replace a
// working clip. Accepts ID3v2 (mp3) or an MPEG frame sync (0xFFEx).
function looksLikeAudio(buf) {
  if (!buf || buf.length < 1024) return false;
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true; // "ID3"
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true; // MPEG sync
  return false;
}

export async function cacheExists(relativePath) {
  try {
    const stat = await fs.stat(path.join(AUDIO_DIR, relativePath));
    return stat.size > 0;
  } catch {
    return false;
  }
}

// Write to a temp file, validate the bytes, then atomically rename into
// place. The rename is atomic on the same filesystem, so a partial write
// or failed validation leaves the previous clip untouched.
export async function atomicWrite(tmpPath, finalPath) {
  const buf = await fs.readFile(tmpPath);
  if (!looksLikeAudio(buf)) throw new Error('generated audio failed validation');
  await fs.mkdir(path.dirname(finalPath), { recursive: true });
  await fs.rename(tmpPath, finalPath);
  return buf.length;
}

export async function removeAudio(relativePath) {
  try {
    await fs.unlink(path.join(AUDIO_DIR, relativePath));
  } catch {
    // already gone
  }
}
