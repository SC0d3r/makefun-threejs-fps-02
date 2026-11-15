// Procedural WebAudio. The context is only created from a real user gesture,
// so a cold screenshot load stays silent and never trips autoplay warnings.
export function createAudio() {
  let ctx = null;
  let master = null;
  let noise = null;
  let brown = null;

  function enable() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    noise = buffer(false);
    brown = buffer(true);
    const ambience = ctx.createBufferSource();
    ambience.buffer = brown;
    ambience.loop = true;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 400;
    const gain = ctx.createGain();
    gain.gain.value = 0.03;
    ambience.connect(lowpass).connect(gain).connect(master);
    ambience.start();
    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 60;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.01;
    hum.connect(humGain).connect(master);
    hum.start();
    if (ctx.state === 'suspended') ctx.resume();
  }

  function buffer(isBrown) {
    const length = ctx.sampleRate * 2;
    const audioBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = audioBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (isBrown) {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      } else {
        data[i] = white;
      }
    }
    return audioBuffer;
  }

  function tone(freq, duration, type, gain, toFreq = 0, delay = 0) {
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (toFreq > 0) osc.frequency.exponentialRampToValueAtTime(toFreq, now + duration);
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp).connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function burst(duration, gain, frequency, delay = 0) {
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(amp).connect(master);
    source.start(now);
    source.stop(now + duration + 0.01);
  }

  function shot(scale = 1) {
    if (!ctx) return;
    burst(0.09, 0.32, 1800 * scale);
    tone(110, 0.16, 'sine', 0.26, 48);
  }
  function botShot(volume = 0.6) {
    if (!ctx) return;
    burst(0.08, 0.16 * volume, 1300);
    tone(95, 0.12, 'sine', 0.12 * volume, 45);
  }
  function dry() { tone(1400, 0.03, 'square', 0.05); }
  function reload() {
    tone(1200, 0.035, 'square', 0.06);
    tone(800, 0.04, 'square', 0.06, 0, 0.13);
  }
  function footstep(volume = 1) { burst(0.05, 0.05 * volume, 380); }
  function hit(kill) {
    tone(kill ? 1900 : 1600, 0.03, 'sine', kill ? 0.12 : 0.08);
    if (kill) tone(2400, 0.04, 'sine', 0.07, 0, 0.04);
  }
  function toss() { burst(0.06, 0.05, 900); }
  function beep() { tone(880, 0.04, 'sine', 0.1); }
  function plant() { tone(500, 0.07, 'square', 0.09); tone(760, 0.08, 'square', 0.08, 0, 0.12); }
  function plantTick() { tone(500, 0.02, 'square', 0.04); }
  function explosion() {
    tone(60, 1.2, 'sine', 0.5, 28);
    burst(0.8, 0.4, 700);
  }
  function flash() {
    tone(2400, 0.4, 'sine', 0.2, 900);
    burst(0.2, 0.14, 3000);
  }
  function callout() { tone(600, 0.08, 'square', 0.06); tone(900, 0.09, 'square', 0.055, 0, 0.1); }
  function buy() { tone(760, 0.05, 'square', 0.06); tone(1140, 0.07, 'square', 0.05, 0, 0.06); }
  function roundEnd(win) {
    if (win) { tone(520, 0.2, 'triangle', 0.1); tone(780, 0.28, 'triangle', 0.09, 0, 0.18); }
    else { tone(320, 0.24, 'triangle', 0.1); tone(190, 0.32, 'triangle', 0.09, 0, 0.2); }
  }

  return { enable, shot, botShot, dry, reload, footstep, hit, toss, beep, plant, plantTick, explosion, flash, callout, buy, roundEnd };
}
