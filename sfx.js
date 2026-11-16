// Tiny synthesized sound-effects engine (Web Audio). No audio files needed.
window.SFX = (() => {
  let ctx = null;
  let master = null;
  let muted = false;

  function unlock() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, start, dur, { type = 'sine', vol = 0.5, to = null, attack = 0.005 } = {}) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + start;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise(start, dur, vol = 0.5, filterFreq = 800) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + start;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(master);
    src.start(t);
  }

  const gavelHit = (s) => {
    noise(s, 0.18, 0.9, 1200);
    tone(140, s, 0.25, { type: 'triangle', vol: 0.8, to: 60 });
  };

  let lastJoin = 0;
  const sounds = {
    join() {
      const now = performance.now();
      if (now - lastJoin < 120) return; // don't machine-gun when lots join at once
      lastJoin = now;
      tone(660, 0, 0.09, { type: 'square', vol: 0.18 });
      tone(990, 0.07, 0.14, { type: 'square', vol: 0.18 });
    },
    lock() {
      tone(1046, 0, 0.18, { type: 'triangle', vol: 0.6 });
      tone(1568, 0.1, 0.35, { type: 'triangle', vol: 0.6 });
      tone(2093, 0.2, 0.4, { type: 'sine', vol: 0.3 });
    },
    raise() {
      tone(300, 0, 0.25, { type: 'sawtooth', vol: 0.18, to: 900 });
      tone(450, 0.04, 0.25, { type: 'triangle', vol: 0.25, to: 1300 });
    },
    roundStart() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.22, { type: 'square', vol: 0.2 }));
    },
    gameStart() {
      [392, 523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, i * 0.11, 0.25, { type: 'square', vol: 0.2 }));
    },
    tick() {
      tone(880, 0, 0.13, { type: 'square', vol: 0.35 });
    },
    finalTick() {
      tone(1320, 0, 0.18, { type: 'square', vol: 0.45 });
    },
    buzzer() {
      tone(110, 0, 0.9, { type: 'sawtooth', vol: 0.5 });
      tone(116, 0, 0.9, { type: 'sawtooth', vol: 0.4 });
    },
    sold() {
      gavelHit(0);
      gavelHit(0.35);
      gavelHit(0.7);
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, 1.0 + i * 0.1, 0.5, { type: 'triangle', vol: 0.35 }));
      tone(1568, 1.4, 0.9, { type: 'sine', vol: 0.3 });
    },
    nobids() {
      [392, 370, 349, 262].forEach((f, i) => tone(f, i * 0.28, 0.32, { type: 'triangle', vol: 0.4, to: f * 0.97 }));
    },
    cancel() {
      tone(500, 0, 0.3, { type: 'triangle', vol: 0.3, to: 200 });
    },
    timeAdded() {
      tone(700, 0, 0.1, { type: 'sine', vol: 0.3 });
      tone(1050, 0.08, 0.15, { type: 'sine', vol: 0.3 });
    },
    money() {
      [1318, 1568, 2093].forEach((f, i) => tone(f, i * 0.06, 0.2, { type: 'sine', vol: 0.25 }));
    },
    gameEnd() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * 0.15, 0.4, { type: 'triangle', vol: 0.35 }));
      tone(1046, 0.8, 1.2, { type: 'triangle', vol: 0.3 });
      tone(1318, 0.8, 1.2, { type: 'triangle', vol: 0.25 });
      tone(1568, 0.8, 1.2, { type: 'triangle', vol: 0.25 });
    },
  };

  return {
    unlock,
    play(name) {
      if (sounds[name]) sounds[name]();
    },
    setMuted(m) {
      muted = m;
    },
    isMuted: () => muted,
    get ready() {
      return !!ctx && ctx.state === 'running';
    },
  };
})();
