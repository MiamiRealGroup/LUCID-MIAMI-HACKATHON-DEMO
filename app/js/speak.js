// The critical path: tap -> cached audio -> play.
// This module MUST NOT make any network call. Speech always works offline
// for any phrase that has been cached. If audio is missing, fall back to
// the browser's local speech synthesis so the person is never left silent.
//
// One AudioContext per page, lazily created on first user gesture.

let ctx = null;
let current = null; // active AudioBufferSourceNode, so "Stop" can cancel it

function audioContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

async function playBuffer(url) {
  const ac = audioContext();
  if (!ac) return false;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`audio ${res.status}`);
  const buf = await res.arrayBuffer();
  const decoded = await ac.decodeAudioData(buf);
  current = ac.createBufferSource();
  current.buffer = decoded;
  current.connect(ac.destination);
  current.start();
  return true;
}

// Local fallback: uses the device's own voice, works fully offline, but
// sounds system-default rather than the personalized ElevenLabs voice.
function speakLocal(text) {
  if (!('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1;
  window.speechSynthesis.speak(u);
  return true;
}

export function stop() {
  if (current) {
    try { current.stop(); } catch {}
    current = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

// primary: prefer cached clip; fall back to local voice. Returns the mode used.
export async function speak(phrase) {
  stop();
  // phrase.url is the server-resolved path ("/audio/core/stop.mp3").
  // phrase.audio is only the relative cache key ("core/stop.mp3").
  const url = phrase.url || (phrase.audio ? `/audio/${phrase.audio}` : null);
  if (url && phrase.status === 'cached') {
    try {
      await playBuffer(url);
      return 'cached';
    } catch {
      // fall through to local voice
    }
  }
  if (speakLocal(phrase.text)) return 'local';
  return 'none';
}
