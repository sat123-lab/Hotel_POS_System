/* ------------------------------------------------------------------ */
/*  Bell-sound utility for the Kitchen Display + Customer Order page.  */
/*                                                                     */
/*  - Synthesises a pleasant 2-tone "bell" via the Web Audio API so we */
/*    don't need to ship any audio assets and it works offline.        */
/*  - Respects browser autoplay restrictions: a bell scheduled before  */
/*    the user has interacted with the page is queued and fires on the */
/*    first click/tap/keypress instead.                                */
/*  - Persists a per-page on/off + volume preference in localStorage   */
/*    so each kitchen station / mobile session can opt in or out.      */
/* ------------------------------------------------------------------ */

const SETTING_KEY = 'notificationSoundSettings_v1';

const DEFAULTS = {
  enabled: true,
  volume: 0.7, // 0..1
};

const loadSettings = () => {
  try {
    const raw = localStorage.getItem(SETTING_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
};

export const getSoundSettings = () => loadSettings();

export const setSoundEnabled = (enabled) => {
  const next = { ...loadSettings(), enabled: !!enabled };
  try {
    localStorage.setItem(SETTING_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
  return next;
};

export const setSoundVolume = (volume) => {
  const v = Math.max(0, Math.min(1, Number(volume) || 0));
  const next = { ...loadSettings(), volume: v };
  try {
    localStorage.setItem(SETTING_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
  return next;
};

/* ------------------------------------------------------------------ */
/*  Audio context — created lazily on first user interaction          */
/* ------------------------------------------------------------------ */

let audioCtx = null;
let unlocked = false;
let pendingPlays = [];

const getAudioCtx = () => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    } catch {
      return null;
    }
  }
  return audioCtx;
};

const unlockAudio = () => {
  if (unlocked) return;
  unlocked = true;
  const ctx = getAudioCtx();
  if (!ctx) return;
  // Some browsers start the context in "suspended" until a user gesture.
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  // Drain anything queued before unlock.
  const queued = pendingPlays.splice(0);
  queued.forEach((fn) => {
    try {
      fn();
    } catch {
      /* noop */
    }
  });
};

if (typeof window !== 'undefined') {
  const handler = () => unlockAudio();
  window.addEventListener('click', handler, { once: false, passive: true });
  window.addEventListener('touchstart', handler, { once: false, passive: true });
  window.addEventListener('keydown', handler, { once: false, passive: true });
}

/* ------------------------------------------------------------------ */
/*  Synthesised tones                                                  */
/* ------------------------------------------------------------------ */

/**
 * Play a 2-note bell tone. Each tone is a quick sine wave that decays
 * exponentially — feels like a tap on a service bell.
 */
const playTones = (notes, settings) => {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const masterGain = ctx.createGain();
  masterGain.gain.value = settings.volume;
  masterGain.connect(ctx.destination);

  const now = ctx.currentTime;
  notes.forEach(({ freq, start, duration, peak = 1 }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(masterGain);
    const t0 = now + start;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  });
};

const NEW_ORDER_NOTES = [
  { freq: 880, start: 0.0, duration: 0.45, peak: 0.9 },
  { freq: 1318.5, start: 0.18, duration: 0.55, peak: 0.85 },
];

const ORDER_READY_NOTES = [
  { freq: 659.25, start: 0.0, duration: 0.35, peak: 0.8 },
  { freq: 987.77, start: 0.16, duration: 0.4, peak: 0.85 },
  { freq: 1318.5, start: 0.32, duration: 0.6, peak: 0.9 },
];

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

const schedule = (fn) => {
  if (!unlocked) {
    pendingPlays.push(fn);
    return;
  }
  fn();
};

/** Ring the "new order arrived" bell (used by KDS). */
export const playNewOrderBell = () => {
  const settings = loadSettings();
  if (!settings.enabled) return;
  schedule(() => playTones(NEW_ORDER_NOTES, settings));
};

/** Ring the "your order is ready" bell (used by customer order tracker). */
export const playOrderReadyBell = () => {
  const settings = loadSettings();
  if (!settings.enabled) return;
  schedule(() => playTones(ORDER_READY_NOTES, settings));
};

/**
 * Explicit "prime audio" call you can wire to a user-visible button
 * (e.g. after a customer taps "Place order") so subsequent
 * server-pushed bells fire without an autoplay block.
 */
export const primeAudio = () => unlockAudio();
