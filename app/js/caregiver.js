// Caregiver panel: the only place settings are managed. Reached via a
// deliberate long-press on the footer, never surfaced to the child by
// accident. Behind the panel the child view is untouched.

import { setPhrases } from './board.js';
import { contexts, setContext } from './context.js';

let phrases = [];

export function initCaregiver() {
  const panel = document.getElementById('caregiver');

  // Long-press (2s) on the footer opens the panel. A short tap does nothing.
  let pressTimer = null;
  const footer = document.querySelector('.actions');
  footer.addEventListener('pointerdown', () => {
    pressTimer = setTimeout(open, 2000);
  });
  footer.addEventListener('pointerup', () => clearTimeout(pressTimer));
  footer.addEventListener('pointerleave', () => clearTimeout(pressTimer));
  footer.addEventListener('pointercancel', () => clearTimeout(pressTimer));

  // Escape closes it, but only when open.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) close();
  });
}

export function setCaregiverPhrases(list) {
  phrases = list;
}

async function open() {
  const panel = document.getElementById('caregiver');
  panel.hidden = false;
  await render();
}

function close() {
  document.getElementById('caregiver').hidden = true;
}

async function render() {
  const panel = document.getElementById('caregiver');
  const profile = await fetchJson('/api/profile');

  panel.innerHTML = `
    <h1>Caregiver settings</h1>
    <p class="lead">Everything here is hidden from the person using LUCID.</p>

    <fieldset>
      <legend>Voice</legend>
      <label for="voice-select">ElevenLabs voice</label>
      <select id="voice-select"></select>
      <p class="statusline" id="voice-status"></p>
    </fieldset>

    <fieldset>
      <legend>Phrases</legend>
      <div class="row">
        <input type="text" id="new-phrase-text" placeholder="New phrase" />
        <select id="new-phrase-context">
          ${contexts.map((c) => `<option value="${c.id}">${c.label}</option>`).join('')}
        </select>
        <button class="primary" id="new-phrase-add">Add</button>
      </div>
      <div id="phrase-list"></div>
      <p class="statusline" id="phrase-status"></p>
      <button class="primary" id="prepare-all" style="width:100%; margin-top:12px;">
        Generate all audio for offline use
      </button>
    </fieldset>

    <fieldset>
      <legend>Display</legend>
      <label><input type="checkbox" id="opt-contrast" /> High contrast</label>
      <label><input type="checkbox" id="opt-haptics" checked /> Vibrate on tap (if available)</label>
    </fieldset>

    <button class="btn-close" id="caregiver-close">Close</button>
  `;

  await renderVoices(profile);
  renderPhraseList();

  panel.querySelector('#new-phrase-add').addEventListener('click', addPhrase);
  panel.querySelector('#prepare-all').addEventListener('click', prepareAll);
  panel.querySelector('#caregiver-close').addEventListener('click', close);
  panel.querySelector('#opt-contrast').addEventListener('change', (e) => {
    document.body.classList.toggle('high-contrast', e.target.checked);
  });
  panel.querySelector('#opt-haptics').addEventListener('change', (e) => {
    localStorage.setItem('lucid-haptics', e.target.checked ? '1' : '0');
  });

  const savedHaptics = localStorage.getItem('lucid-haptics') !== '0';
  panel.querySelector('#opt-haptics').checked = savedHaptics;
}

async function renderVoices(profile) {
  const select = document.querySelector('#voice-select');
  const status = document.querySelector('#voice-status');
  try {
    const voices = await fetchJson('/api/voices');
    select.innerHTML = voices.map((v) =>
      `<option value="${v.id}" ${v.id === profile.voice?.id ? 'selected' : ''}>${v.name}</option>`
    ).join('');
    if (!voices.length) status.textContent = 'No voices returned.';
    select.addEventListener('change', async () => {
      await fetchJson('/api/profile', { method: 'POST', body: { voice: { id: select.value } } });
      status.textContent = 'Voice saved.';
    });
  } catch (err) {
    select.innerHTML = `<option>Unavailable (${err.message})</option>`;
    status.textContent = 'Set ELEVENLABS_API_KEY to list voices.';
  }
}

function renderPhraseList() {
  const list = document.querySelector('#phrase-list');
  list.replaceChildren();
  for (const p of phrases) {
    const row = document.createElement('div');
    row.className = 'phrase-row';
    const badge = p.status === 'cached' ? 'cached' : 'pending';
    row.innerHTML = `
      <span>${escapeHtml(p.text)} <span class="ctx">${p.context}</span></span>
      <span class="badge ${badge}">${badge}</span>
    `;
    if (p.context !== 'core') {
      const del = document.createElement('button');
      del.textContent = 'Remove';
      del.addEventListener('click', async () => {
        await fetchJson(`/api/phrase/${p.id}`, { method: 'DELETE' });
        await refreshPhrases();
      });
      row.appendChild(del);
    }
    list.appendChild(row);
  }
}

async function addPhrase() {
  const text = document.querySelector('#new-phrase-text').value.trim();
  const context = document.querySelector('#new-phrase-context').value;
  if (!text) return;
  await fetchJson('/api/phrases', { method: 'POST', body: { text, context } });
  document.querySelector('#new-phrase-text').value = '';
  await refreshPhrases();
}

async function prepareAll() {
  const status = document.querySelector('#phrase-status');
  status.textContent = 'Generating…';
  const res = await fetchJson('/api/prepare', { method: 'POST' });
  const ok = res.results.filter((r) => r.status === 'cached').length;
  status.textContent = `${ok}/${res.results.length} phrases cached.`;
  await refreshPhrases();
}

async function refreshPhrases() {
  const manifest = await fetchJson('/api/phrases');
  phrases = manifest.phrases;
  setCaregiverPhrases(phrases);
  setPhrases(phrases);
  renderPhraseList();
}

async function fetchJson(url, opts = {}) {
  const init = { headers: { 'content-type': 'application/json' }, ...opts };
  if (init.body && typeof init.body === 'object') init.body = JSON.stringify(init.body);
  const res = await fetch(url, init);
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export { refreshPhrases, fetchJson };
