// Procedural WebAudio. The context is created on the first gesture; every
// method is a no-op until then and when the browser has no AudioContext.
export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let brownBuffer = null;
  let plantAt = 0;
  let enabled = true;

  const noise = (duration, cutoff, gain, type = 'lowpass') => {
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = cutoff;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    src.connect(filter).connect(amp).connect(master);
    src.start();
    src.stop(ctx.currentTime + duration);
  };

  const tone = (freq, duration, gain, type = 'sine', endFreq = freq, delay = 0) => {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const start = ctx.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + duration);
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp).connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  };

  const start = () => {
    if (ctx || !enabled) return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) {
      enabled = false;
      return;
    }
    try {
      ctx = new Ctor();
    } catch {
      enabled = false;
      return;
    }
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    brownBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const brown = brownBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < brown.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      brown[i] = last * 3.2;
    }
    const amb = ctx.createBufferSource();
    amb.buffer = brownBuffer;
    amb.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    const amp = ctx.createGain();
    amp.gain.value = 0.03;
    amb.connect(filter).connect(amp).connect(master);
    amb.start();
    tone(60, 8, 0.01, 'sine', 60);
  };

  const resume = () => {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  };

  const shot = (id) => {
    if (!ctx) return;
    resume();
    const profile = { pistol: [0.3, 0.9, 1600], smg: [0.2, 1.25, 2100], rifle: [0.3, 0.8, 1500], shotgun: [0.42, 0.55, 900] }[id] || [0.28, 1, 1800];
    noise(0.09, profile[2], profile[0]);
    tone(110 * profile[1], 0.1, profile[0] * 0.8, 'sine', 50);
  };

  return {
    get ready() {
      return !!ctx;
    },
    start,
    resume,
    shot,
    botShot(dist) {
      noise(0.07, 1400, Math.max(0.02, 0.16 - dist * 0.003));
      tone(90, 0.08, 0.08, 'sine', 45);
    },
    dry() {
      tone(220, 0.035, 0.08, 'square', 180);
    },
    reload() {
      tone(1200, 0.03, 0.05, 'square', 1000);
      tone(800, 0.03, 0.05, 'square', 700, 0.12);
    },
    step(side) {
      noise(0.05, side ? 180 : 150, 0.055);
    },
    hit() {
      tone(1600, 0.02, 0.05, 'square', 1600);
    },
    hurt() {
      noise(0.14, 300, 0.1);
      tone(80, 0.12, 0.1, 'sine', 50);
    },
    death() {
      tone(180, 0.5, 0.09, 'sawtooth', 40);
      noise(0.4, 500, 0.08);
    },
    beep(progress) {
      tone(880, 0.04, 0.055, 'sine', 880);
      if (progress > 0.75) tone(880, 0.04, 0.03, 'sine', 880, 0.06);
    },
    plantTick(progress) {
      if (!ctx) return;
      if (ctx.currentTime - plantAt < 0.4) return;
      plantAt = ctx.currentTime;
      tone(500, 0.035, 0.04, 'square', 500);
      if (progress > 0.98) tone(760, 0.1, 0.07, 'sine', 900);
    },
    plantDone() {
      tone(500, 0.1, 0.08, 'square', 500);
      tone(760, 0.16, 0.06, 'sine', 900, 0.1);
    },
    explosion(scale = 1) {
      tone(60, 1.2, 0.32 * scale, 'sine', 24);
      noise(0.8, 600, 0.3 * scale);
    },
    flashRing() {
      tone(2400, 0.4, 0.08, 'sine', 1800);
    },
    callout() {
      tone(600, 0.09, 0.035, 'square', 600);
      tone(900, 0.11, 0.035, 'square', 900, 0.1);
    },
    buy() {
      tone(700, 0.06, 0.04, 'square', 900);
    },
    roundStart() {
      tone(320, 0.18, 0.035, 'sine', 440);
    },
    win() {
      tone(440, 0.2, 0.05, 'triangle', 440);
      tone(660, 0.25, 0.05, 'triangle', 660, 0.16);
      tone(880, 0.35, 0.05, 'triangle', 880, 0.32);
    },
    lose() {
      tone(220, 0.35, 0.05, 'triangle', 160);
      tone(140, 0.5, 0.05, 'triangle', 90, 0.24);
    },
    matchEnd(won) {
      if (won) {
        tone(523, 0.25, 0.05, 'triangle', 523);
        tone(659, 0.25, 0.05, 'triangle', 659, 0.2);
        tone(784, 0.5, 0.05, 'triangle', 784, 0.4);
      } else {
        tone(196, 0.5, 0.05, 'sine', 130);
        tone(98, 0.8, 0.05, 'sine', 70, 0.35);
      }
    },
    jump() {
      noise(0.05, 900, 0.03);
    },
    throw() {
      noise(0.18, 700, 0.05, 'bandpass');
    },
    botDown() {
      tone(160, 0.22, 0.04, 'sawtooth', 70);
    },
  };
}
