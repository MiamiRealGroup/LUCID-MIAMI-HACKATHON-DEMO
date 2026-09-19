import { setActiveContext } from './board.js';

export const contexts = [
  { id: 'core', label: 'Core', always: true },
  { id: 'home', label: 'Home' },
  { id: 'school', label: 'School' },
  { id: 'store', label: 'Store' },
  { id: 'restroom', label: 'Restroom' },
];

let current = 'core';

export function currentContext() {
  return current;
}

export function initContextBar() {
  const bar = document.getElementById('context-bar');
  bar.replaceChildren();
  for (const c of contexts) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'contextchip' + (c.id === current ? ' active' : '');
    chip.textContent = c.label;
    chip.setAttribute('aria-pressed', String(c.id === current));
    chip.addEventListener('click', () => {
      current = c.id;
      bar.querySelectorAll('.contextchip').forEach((el) => {
        el.classList.toggle('active', el.textContent === c.label);
        el.setAttribute('aria-pressed', el.textContent === c.label ? 'true' : 'false');
      });
      setActiveContext(c.id);
    });
    bar.appendChild(chip);
  }
}

// Set the visible context (used by caregiver panel to restore state).
export function setContext(id) {
  current = id;
  initContextBar();
  setActiveContext(id);
}
