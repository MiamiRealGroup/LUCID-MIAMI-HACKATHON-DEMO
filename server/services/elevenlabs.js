import fs from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const API = 'https://api.elevenlabs.io/v1';

// A stable, natural default voice so the app can synthesize before a
// caregiver has picked one. Overridable via ELEVENLABS_VOICE_ID.
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

export function apiKey() {
  return process.env.ELEVENLABS_API_KEY || '';
}

export function hasKey() {
  return apiKey().length > 0;
}

export async function listVoices() {
  const res = await fetch(`${API}/voices`, {
    headers: { 'xi-api-key': apiKey() },
  });
  if (!res.ok) throw new Error(`ElevenLabs voices failed (${res.status})`);
  const data = await res.json();
  return (data.voices || []).map((v) => ({
    id: v.voice_id,
    name: v.name,
    labels: v.labels || {},
  }));
}

export async function synthesize(text, { voiceId, modelId } = {}) {
  const voice = voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const model = modelId || process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

  const res = await fetch(`${API}/text-to-speech/${voice}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey(),
      'content-type': 'application/json',
      accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.body; // web ReadableStream of audio/mpeg
}

export async function synthesizeToFile(text, filePath, opts = {}) {
  const body = await synthesize(text, opts);
  await pipeline(Readable.fromWeb(body), fs.createWriteStream(filePath));
}
