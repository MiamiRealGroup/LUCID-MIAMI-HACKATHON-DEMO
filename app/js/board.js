import { speak } from './speak.js';
import { contexts } from './context.js';

let phrases = [];       // full list from manifest
let activeContext = 'core';

const CORE_IDS = ['stop', 'help', 'bathroom', 'break', 'too-loud', 'too-bright',
  'hurt', 'hungry', 'thirsty', 'mad', 'frustrated', 'happy', 'yes', 'no'];

function isUrgent(id) {
  return ['stop', 'help', 'hurt', 'break'].includes(id);
}

// Modified Fitzgerald Key categories, used only when the caregiver turns on
// colour vocabulary. Assigned per phrase id rather than guessed from the
// text, so the mapping is explicit and reviewable.
const CATEGORY = {
  // people & pronouns
  'restroom-help': 'people',
  // verbs & actions
  stop: 'verb', bathroom: 'verb', 'school-paper': 'verb',
  // adjectives & descriptive states
  'too-loud': 'adjective', 'too-bright': 'adjective', hurt: 'adjective',
  hungry: 'adjective', thirsty: 'adjective', mad: 'adjective',
  frustrated: 'adjective', happy: 'adjective', break: 'adjective',
  'school-done': 'adjective', 'school-quiet': 'adjective',
  // nouns & objects
  'school-teacher': 'noun', 'store-cart': 'noun', 'restroom-paper': 'noun',
  'restroom-soap': 'noun', 'home-tv': 'noun', 'home-blanket': 'noun',
  'store-checkout': 'noun',
  // social & conversational
  help: 'social', yes: 'social', no: 'social', 'home-hug': 'social',
  'store-find': 'social',
};

// One distinct shape per category. Colour is never the only carrier of
// meaning: these keep the grammatical cue readable in greyscale and for
// colour vision deficiency. Chosen for maximum shape difference, not hue.
const CATEGORY_SYMBOL = {
  people: '●',     // filled circle
  verb: '▲',       // triangle
  adjective: '◆',  // diamond
  noun: '■',       // square
  social: '★',     // star
};

function tileFor(phrase) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tile';
  if (phrase.id === 'stop') btn.classList.add('tile-stop');
  else if (isUrgent(phrase.id)) btn.classList.add('tile-urgent');
  // Colour vocabulary is applied only when the caregiver enables it; the
  // class is inert otherwise.
  const cat = CATEGORY[phrase.id];
  if (cat) btn.classList.add(`cat-${cat}`);
  // Deliberately NOT styled by cache status: appearance must not change with
  // network or sync state. Cache state is shown in the caregiver panel only.

  const label = document.createElement('span');
  label.className = 'tile-label';
  label.textContent = phrase.text;

  // A shape glyph carries the category too, so meaning never depends on
  // colour alone. Hidden by CSS unless colour mode is on.
  const sym = document.createElement('span');
  sym.className = 'tile-symbol';
  sym.setAttribute('aria-hidden', 'true');
  sym.textContent = CATEGORY_SYMBOL[cat] || '';

  btn.appendChild(sym);
  btn.appendChild(label);

  btn.addEventListener('click', async () => {
    // Selection is shown by a thick outline, not a colour shift — the same
    // indicator focus and eye tracking use, so it needs no colour perception.
    for (const el of btn.parentNode ? btn.parentNode.children : []) {
      el.classList && el.classList.remove('is-selected');
    }
    btn.classList.add('is-selected');

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

  // An empty board explains nothing. Say what is wrong in plain language
  // rather than leaving an unexplained blank screen.
  if (!phrases.length) {
    const note = document.createElement('p');
    note.className = 'board-empty';
    note.textContent = 'No phrases yet. A caregiver can hold Repeat or Stop for 2 seconds to set up LUCID.';
    coreGrid.appendChild(note);
    return;
  }

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
