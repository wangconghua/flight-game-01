// Synthesised sound, no audio files: an engine hum that follows the
// throttle, wind that follows the speed, and short cues for rings,
// touchdowns and crashes. Created lazily on the first user gesture.
export function createAudio() {
  const api = {
    muted: false,
    ctx: null,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    windGain: null,
    windFilter: null,
  };

  function ensure() {
    if (api.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      api.ctx = new AC();
      api.engineGain = api.ctx.createGain();
      api.engineGain.gain.value = 0;
      api.engineGain.connect(api.ctx.destination);
      api.engineOsc = api.ctx.createOscillator();
      api.engineOsc.type = 'sawtooth';
      api.engineOsc.frequency.value = 55;
      api.engineOsc2 = api.ctx.createOscillator();
      api.engineOsc2.type = 'square';
      api.engineOsc2.frequency.value = 110;
      const g2 = api.ctx.createGain();
      g2.gain.value = 0.4;
      api.engineOsc.connect(api.engineGain);
      api.engineOsc2.connect(g2);
      g2.connect(api.engineGain);
      api.engineOsc.start();
      api.engineOsc2.start();
      // Wind: looped noise through a band-pass filter.
      const len = api.ctx.sampleRate * 2;
      const buf = api.ctx.createBuffer(1, len, api.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const noise = api.ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      api.windFilter = api.ctx.createBiquadFilter();
      api.windFilter.type = 'bandpass';
      api.windFilter.frequency.value = 500;
      api.windGain = api.ctx.createGain();
      api.windGain.gain.value = 0;
      noise.connect(api.windFilter);
      api.windFilter.connect(api.windGain);
      api.windGain.connect(api.ctx.destination);
      noise.start();
      return true;
    } catch (e) {
      return false;
    }
  }

  api.unlock = function () {
    if (ensure() && api.ctx.state === 'suspended') api.ctx.resume();
  };

  api.setMuted = function (m) {
    api.muted = m;
    if (api.ctx) api.ctx.suspend();
    if (!m && api.ctx) api.ctx.resume();
  };

  // Called every frame while flying.
  api.engine = function (throttle, speed, onGround) {
    if (!ensure() || api.muted) return;
    const t = api.ctx.currentTime;
    api.engineOsc.frequency.setTargetAtTime(52 + throttle * 72, t, 0.1);
    api.engineOsc2.frequency.setTargetAtTime(104 + throttle * 144, t, 0.1);
    const vol = onGround ? 0.02 + throttle * 0.05 : 0.03 + throttle * 0.06;
    api.engineGain.gain.setTargetAtTime(vol, t, 0.1);
    api.windFilter.frequency.setTargetAtTime(300 + speed * 22, t, 0.2);
    api.windGain.gain.setTargetAtTime(Math.min(0.09, speed * 0.0016), t, 0.2);
  };

  function blip(freq, at, dur, vol) {
    const o = api.ctx.createOscillator();
    const g = api.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g);
    g.connect(api.ctx.destination);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  api.ring = function () {
    if (!ensure() || api.muted) return;
    const t = api.ctx.currentTime;
    blip(880, t, 0.18, 0.22);
    blip(1318, t + 0.09, 0.28, 0.22);
  };

  api.thud = function () {
    if (!ensure() || api.muted) return;
    const t = api.ctx.currentTime;
    const o = api.ctx.createOscillator();
    const g = api.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g);
    g.connect(api.ctx.destination);
    o.start(t);
    o.stop(t + 0.35);
  };

  api.success = function () {
    if (!ensure() || api.muted) return;
    const t = api.ctx.currentTime;
    blip(523, t, 0.2, 0.2);
    blip(659, t + 0.12, 0.2, 0.2);
    blip(784, t + 0.24, 0.35, 0.22);
  };

  api.crash = function () {
    if (!ensure() || api.muted) return;
    const t = api.ctx.currentTime;
    const len = api.ctx.sampleRate * 0.6;
    const buf = api.ctx.createBuffer(1, len, api.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = api.ctx.createBufferSource();
    src.buffer = buf;
    const f = api.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = api.ctx.createGain();
    g.gain.value = 0.5;
    src.connect(f);
    f.connect(g);
    g.connect(api.ctx.destination);
    src.start(t);
  };

  return api;
}
