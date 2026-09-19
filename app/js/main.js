import { initContextBar, onContextChange } from './context.js';
import { initCaregiver } from './caregiver.js';
import { setPhrases, setActiveContext } from './board.js';
import { speak, stop } from './speak.js';

let phrases = [];

function updateOffline() {
  const el = document.getElementById('offline-indicator');
  el.hidden = navigator.onLine;
}

function lastText() {
  return document.getElementById('speech-text').textContent;
}

async function loadPhrases() {
  try {
    const data = await (await fetch('/api/phrases')).json();
    // Accept either shape: a bare array, or { phrases: [...] }.
    phrases = Array.isArray(data) ? data : (data.phrases || []);
    setPhrases(phrases);
  } catch (err) {
    // Surface the failure instead of rendering an empty board silently.
    const strip = document.getElementById('speech-text');
    if (strip) strip.textContent = 'Could not load phrases';
    console.error('LUCID: failed to load phrases', err);
  }
}

async function boot() {
  updateOffline();
  window.addEventListener('online', updateOffline);
  window.addEventListener('offline', updateOffline);

  // Wire the context change to the board, then paint the initial state.
  onContextChange((id) => setActiveContext(id));
  initContextBar();

  initCaregiver();

  const repeat = document.getElementById('btn-repeat');
  const stopBtn = document.getElementById('btn-stop');
  repeat.addEventListener('click', () => {
    const phrase = phrases.find((p) => p.text === lastText());
    if (phrase) speak(phrase);
  });
  stopBtn.addEventListener('click', () => stop());

  await loadPhrases();

  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/sw.js'); } catch {}
  }
}

boot();
