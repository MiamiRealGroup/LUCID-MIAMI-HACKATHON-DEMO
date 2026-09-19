import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { readJson, writeJson } from '../services/store.js';
import { synthesizeToFile, hasKey, listVoices } from '../services/elevenlabs.js';
import { atomicWrite, removeAudio } from '../services/cache.js';
import { audioPathFor, buildEntries, writeManifest } from '../services/manifest.js';
import { AUDIO_DIR } from '../paths.js';

const router = Router();

async function loadPhrases() {
  return readJson('phrases.json', []);
}
async function savePhrases(list) {
  await writeJson('phrases.json', list);
}
async function loadProfile() {
  return readJson('profiles.json', { voice: { id: '' }, contexts: [], alert: { channel: 'log', enabled: false } });
}

async function isAudioCached(rel) {
  try {
    const s = await fs.stat(path.join(AUDIO_DIR, rel));
    return s.size > 0;
  } catch {
    return false;
  }
}

router.get('/health', (req, res) => {
  res.json({ ok: true, elevenlabs: hasKey(), time: new Date().toISOString() });
});

router.get('/phrases', async (req, res) => {
  const phrases = await loadPhrases();
  const status = {};
  await Promise.all(
    phrases.map(async (p) => {
      const rel = audioPathFor(p);
      try {
        const s = await fs.stat(path.join(AUDIO_DIR, rel));
        status[rel] = s.size > 0;
      } catch {
        status[rel] = false;
      }
    })
  );
  // buildEntries is pure: a GET must not write to disk.
  res.json({ phrases: buildEntries(phrases, status) });
});

router.post('/phrases', async (req, res) => {
  const { text, context = 'core', alert = false } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  const phrases = await loadPhrases();
  const id = crypto.createHash('sha1').update(`${context}:${text.trim().toLowerCase()}`).digest('hex').slice(0, 12);
  if (phrases.some((p) => p.id === id)) {
    return res.status(409).json({ error: 'phrase already exists' });
  }
  const phrase = { id, text: text.trim(), context, alert: !!alert };
  phrases.push(phrase);
  await savePhrases(phrases);
  res.status(201).json({ phrase });
});

router.post('/phrase/:id/generate', async (req, res) => {
  if (!hasKey()) return res.status(503).json({ error: 'ElevenLabs API key not configured' });
  const phrases = await loadPhrases();
  const phrase = phrases.find((p) => p.id === req.params.id);
  if (!phrase) return res.status(404).json({ error: 'phrase not found' });

  const profile = await loadProfile();
  const rel = audioPathFor(phrase);
  const abs = path.join(AUDIO_DIR, rel);
  const tmp = `${abs}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await synthesizeToFile(phrase.text, tmp, {
      voiceId: profile.voice?.id || undefined,
      modelId: process.env.ELEVENLABS_MODEL_ID || undefined,
    });
    const bytes = await atomicWrite(tmp, abs);
    phrase.status = 'cached';
    await savePhrases(phrases);
    res.json({ ok: true, id: phrase.id, bytes });
  } catch (err) {
    await fs.rm(tmp, { force: true });
    phrase.status = 'failed';
    await savePhrases(phrases);
    res.status(502).json({ error: String(err.message || err) });
  }
});

// Generate every phrase that is not yet cached. Long-running; the client
// calls it for the caregiver "Prepare offline" flow.
router.post('/prepare', async (req, res) => {
  if (!hasKey()) return res.status(503).json({ error: 'ElevenLabs API key not configured' });
  const phrases = await loadPhrases();
  const profile = await loadProfile();
  const results = [];
  for (const phrase of phrases) {
    const rel = audioPathFor(phrase);
    const abs = path.join(AUDIO_DIR, rel);
    if (await isAudioCached(rel)) {
      results.push({ id: phrase.id, status: 'cached' });
      continue;
    }
    const tmp = `${abs}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    try {
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await synthesizeToFile(phrase.text, tmp, {
        voiceId: profile.voice?.id || undefined,
        modelId: process.env.ELEVENLABS_MODEL_ID || undefined,
      });
      await atomicWrite(tmp, abs);
      phrase.status = 'cached';
      results.push({ id: phrase.id, status: 'cached' });
    } catch (err) {
      await fs.rm(tmp, { force: true });
      phrase.status = 'failed';
      results.push({ id: phrase.id, status: 'failed', error: String(err.message || err) });
    }
  }
  await savePhrases(phrases);
  res.json({ results });
});

router.delete('/phrase/:id', async (req, res) => {
  const phrases = await loadPhrases();
  const phrase = phrases.find((p) => p.id === req.params.id);
  if (!phrase) return res.status(404).json({ error: 'phrase not found' });
  if (phrase.context === 'core') {
    return res.status(400).json({ error: 'core phrases cannot be removed' });
  }
  await removeAudio(audioPathFor(phrase));
  await savePhrases(phrases.filter((p) => p.id !== phrase.id));
  res.json({ ok: true });
});

router.get('/voices', async (req, res) => {
  if (!hasKey()) return res.status(503).json({ error: 'ElevenLabs API key not configured' });
  try {
    res.json(await listVoices());
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
});

router.get('/profile', async (req, res) => {
  res.json(await loadProfile());
});

router.post('/profile', async (req, res) => {
  const profile = await loadProfile();
  const next = { ...profile, ...(req.body || {}) };
  await writeJson('profiles.json', next);
  res.json(next);
});

router.post('/alert/:id', async (req, res) => {
  const phrases = await loadPhrases();
  const phrase = phrases.find((p) => p.id === req.params.id);
  if (!phrase) return res.status(404).json({ error: 'phrase not found' });
  const profile = await loadProfile();
  const channel = profile.alert?.channel || 'log';
  if (channel === 'log') {
    console.log(`[alert] "${phrase.text}" (${new Date().toISOString()})`);
    return res.json({ ok: true, channel: 'log' });
  }
  // Future providers (SMS/WhatsApp) plug in here. Nothing is sent to a
  // real phone unless the caregiver has configured and enabled a channel.
  res.json({ ok: false, channel, error: 'alert channel not configured' });
});

export default router;
