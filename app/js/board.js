import { speak } from './speak.js';
import { contexts } from './context.js';

let phrases = [];       // full list from manifest
let activeContext = 'core';

const CORE_IDS = ['stop', 'help', 'bathroom', 'break', 'too-loud', 'too-bright',
  'hurt', 'hungry', 'thirsty', 'mad', 'frustrated', 'happy', 'yes', 'no'];

function isUrgent(id) {
  return ['stop', 'help', 'hurt', 'break'].includes(id);
}

function tileFor(phrase) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tile';
  if (phrase.id === 'stop') btn.classList.add('tile-stop');
  else if (isUrgent(phrase.id)) btn.classList.add('tile-urgent');
  // Deliberately NOT styled by cache status: appearance must not change with
  // network or sync state. Cache state is shown in the caregiver panel only.

  const label = document.createElement('span');
  label.className = 'tile-label';
  label.textContent = phrase.text;
  btn.appendChild(label);

  btn.addEventListener('click', async () => {
    const strip = document.getElementById('speech-text');
    strip.textContent = phrase.text;
    await speak(phrase);
    if (phrase.alert) {
      try { await fetch(`/api/alert/${phrase.id}`, { method: 'POST' }); } catch {}
    }
  });

  return btn;
}

export function setPhrases(list) {
  // Guard against a malformed payload: an empty board is worse than a
  // stale one, and a non-array would throw inside render().
  phrases = Array.isArray(list) ? list : [];
  render();
}

export function render() {
  const coreGrid = document.getElementById('core-grid');
  coreGrid.replaceChildren();

  // Core buttons are always present and always in the same order,
  // regardless of context.
  for (const id of CORE_IDS) {
    const phrase = phrases.find((p) => p.id === id);
    if (phrase) coreGrid.appendChild(tileFor(phrase));
  }

  // Context buttons are additive only, shown below the core row.
  const contextPhrases = phrases.filter(
    (p) => p.context === activeContext && !CORE_IDS.includes(p.id)
  );
  for (const phrase of contextPhrases) {
    coreGrid.appendChild(tileFor(phrase));
  }
}

export function setActiveContext(id) {
  activeContext = id;
  const label = contexts.find((c) => c.id === id);
  document.getElementById('context-label').textContent = label ? label.label : 'Core';
  render();
}

export { activeContext };
