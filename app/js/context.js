export const contexts = [
  { id: 'core', label: 'Core', always: true },
  { id: 'home', label: 'Home' },
  { id: 'school', label: 'School' },
  { id: 'store', label: 'Store' },
  { id: 'restroom', label: 'Restroom' },
];

let current = 'core';
const listeners = [];

// board.js must not be imported here: it imports this module, and a cycle
// between the two makes import order decide whether `contexts` is defined.
// Instead, subscribers register a callback and main.js wires them together.
export function onContextChange(fn) {
  listeners.push(fn);
}

export function currentContext() {
  return current;
}

function emit(id) {
  for (const fn of listeners) fn(id);
}

export function initContextBar() {
  const bar = document.getElementById('context-bar');
  bar.replaceChildren();
  for (const c of contexts) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'contextchip' + (c.id === current ? ' active' : '');
    chip.dataset.context = c.id;
    chip.textContent = c.label;
    chip.setAttribute('aria-pressed', String(c.id === current));
    chip.addEventListener('click', () => setContext(c.id));
    bar.appendChild(chip);
  }
  emit(current);
}

// Single source of truth for changing context: updates the chip state,
// then notifies subscribers so the board re-renders.
export function setContext(id) {
  current = id;
  const bar = document.getElementById('context-bar');
  if (bar) {
    bar.querySelectorAll('.contextchip').forEach((el) => {
      const on = el.dataset.context === id;
      el.classList.toggle('active', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  emit(id);
}
