import { APP_DIR, AUDIO_DIR, MANIFEST_PATH } from '../paths.js';
import path from 'node:path';
import fs from 'node:fs/promises';

// Maps a context id to the audio subfolder that holds its clips.
const CONTEXT_DIRS = {
  core: 'core',
  home: 'home',
  school: 'school',
  store: 'store',
  restroom: 'restroom',
};

// Always return POSIX separators: this value is used both as a filesystem
// path (Node accepts "/" on Windows too) and as the public URL suffix, so
// a backslash from path.join would produce a broken "/audio/core\stop.mp3".
export function audioPathFor(phrase) {
  const dir = CONTEXT_DIRS[phrase.context] || 'core';
  return `${dir}/${phrase.id}.mp3`;
}

// Pure: builds the client-facing entries and touches nothing. A GET must not
// write to disk, so the read path uses this and only the sync path persists.
export function buildEntries(phrases, statusByAudio) {
  return phrases.map((p) => {
    const audio = audioPathFor(p);
    return {
      id: p.id,
      text: p.text,
      context: p.context,
      alert: !!p.alert,
      audio,
      url: `/audio/${audio}`,
      status: statusByAudio[audio] ? 'cached' : p.status || 'pending',
    };
  });
}

// Persists a manifest for offline clients that want to preload the list.
export async function writeManifest(phrases, statusByAudio) {
  const entries = buildEntries(phrases, statusByAudio);
  await fs.mkdir(AUDIO_DIR, { recursive: true });
  await fs.writeFile(MANIFEST_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), phrases: entries }, null, 2));
  return entries;
}

export function resolveAudioAbs(relativeAudioPath) {
  return path.join(AUDIO_DIR, relativeAudioPath);
}

export function appFile(file) {
  return path.join(APP_DIR, file);
}
