// Sound only: every effect is synthesised with WebAudio, so the game ships no audio files
// and makes no network request. The context is created on the first user gesture (browsers
// refuse audio before one) and every call before that is a silent no-op. M toggles mute.

export function createAudio() {
  let context = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  // A quiet two-note pad that drifts under the game: root, fifth, octave, fifth, one note a
  // bar, so it never fights the effects. Only ever started after a gesture.
  const MUSIC_NOTES = [110, 164.81, 220, 164.81, 130.81, 196, 246.94, 196];
  const MUSIC_BAR = 0.9;

  function ensure() {
    if (context === null) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return null;
        context = new AudioContext();
      } catch {
        return null;
      }
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  }

  function tone(freq, dur, type, gain, slideTo) {
    const ctx = ensure();
    if (ctx === null || muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function noise(dur, gain, lowpass) {
    const ctx = ensure();
    if (ctx === null || muted) return;
    const now = ctx.currentTime;
    const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    source.connect(filter).connect(amp).connect(ctx.destination);
    source.start(now);
  }

  function startMusic() {
    if (musicTimer !== null) return;
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const note = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
      musicStep += 1;
      tone(note, MUSIC_BAR * 1.8, 'sine', 0.035);
      tone(note * 2, MUSIC_BAR * 1.2, 'triangle', 0.012);
    }, MUSIC_BAR * 1000);
  }

  return {
    /** Call from any user gesture: unlocks audio and starts the quiet music. */
    unlock() {
      ensure();
      startMusic();
    },
    shoot() {
      tone(720, 0.08, 'square', 0.05, 340);
    },
    foeShoot() {
      tone(300, 0.12, 'sawtooth', 0.03, 180);
    },
    hit() {
      noise(0.12, 0.12, 1800);
      tone(190, 0.1, 'triangle', 0.08, 90);
    },
    die() {
      noise(0.2, 0.16, 1200);
      tone(320, 0.22, 'sawtooth', 0.06, 60);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.09);
      window.setTimeout(() => tone(990, 0.14, 'sine', 0.09), 70);
    },
    shield() {
      [880, 1174, 1568].forEach((freq, i) => window.setTimeout(() => tone(freq, 0.22, 'sine', 0.08), i * 70));
    },
    surge() {
      tone(98, 0.5, 'sawtooth', 0.09, 196);
      window.setTimeout(() => tone(98, 0.4, 'sawtooth', 0.07, 196), 260);
    },
    nova() {
      noise(0.5, 0.2, 900);
      tone(180, 0.5, 'sine', 0.1, 720);
    },
    emberHit() {
      tone(140, 0.25, 'sawtooth', 0.12, 70);
      noise(0.15, 0.1, 600);
    },
    wave() {
      tone(220, 0.35, 'sawtooth', 0.06, 440);
      window.setTimeout(() => tone(330, 0.35, 'sawtooth', 0.05, 440), 160);
    },
    victory() {
      [523, 659, 784, 1047].forEach((freq, i) => window.setTimeout(() => tone(freq, 0.4, 'triangle', 0.1), i * 130));
    },
    defeat() {
      [330, 262, 196, 131].forEach((freq, i) => window.setTimeout(() => tone(freq, 0.5, 'sawtooth', 0.07), i * 180));
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
