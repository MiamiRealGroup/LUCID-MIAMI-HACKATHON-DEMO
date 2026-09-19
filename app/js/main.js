import { initContextBar } from './context.js';
import { initCaregiver } from './caregiver.js';
import { setPhrases } from './board.js';
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
    const manifest = await (await fetch('/api/phrases')).json();
    phrases = manifest.phrases;
    setPhrases(phrases);
  } catch {
    // Server unavailable: the service worker may still serve a cached manifest.
  }
}

async function boot() {
  updateOffline();
  window.addEventListener('online', updateOffline);
  window.addEventListener('offline', updateOffline);

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
