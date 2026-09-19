import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { APP_DIR, AUDIO_DIR, MANIFEST_PATH, DATA_DIR } from './paths.js';
import api from './routes/api.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// API
app.use('/api', api);

// Cached audio: immutable, cacheable, never goes through a route that
// needs the network.
app.use('/audio', express.static(AUDIO_DIR, { immutable: true, maxAge: '1y' }));

// App shell + assets (plain static files; no build step).
app.use(express.static(APP_DIR, { index: 'index.html' }));

// SPA fallback so caregiver/voice routes work on refresh.
app.get(/^\/(?!api|audio).*/, (req, res) => {
  res.sendFile(path.join(APP_DIR, 'index.html'));
});

// Ensure data dirs exist on cold start.
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(AUDIO_DIR, { recursive: true });

app.listen(PORT, () => {
  console.log(`LUCID running on http://localhost:${PORT}`);
});
