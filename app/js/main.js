import { initContextBar, onContextChange } from './context.js';
import { initCaregiver, applyColourMode } from './caregiver.js';
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

// A long-press entry point is useless if nobody knows it exists. State it
// once, on the first visit only, then never show it again — a person using
// this board should not be given anything new to read twice.
function showCaregiverHint() {
  const el = document.getElementById('caregiver-hint');
  if (!el) return;
  try {
    if (localStorage.getItem('lucid-hint-seen') === '1') return;
    localStorage.setItem('lucid-hint-seen', '1');
  } catch {
    // Storage unavailable (private mode): skip the hint rather than risk
    // showing it on every single load.
    return;
  }
  el.textContent = 'Caregivers: press and hold Repeat or Stop for 2 seconds to open settings.';
  el.hidden = false;
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

  showCaregiverHint();
  initCaregiver();
  applyColourMode();

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
