// Soft synthesized sounds (no audio files). Each form has its own voice.
(() => {
  let ctx = null, master = null;
  const VOICES = {
    chime:  { type: 'sine', base: 660, len: 0.5 },
    pixel:  { type: 'square', base: 520, len: 0.12, gain: 0.3 },
    pencil: { type: 'triangle', base: 700, len: 0.1, gain: 0.25, noise: 3200 },
    paper:  { type: 'triangle', base: 560, len: 0.16, gain: 0.3, noise: 1500 },
    glass:  { type: 'sine', base: 1180, len: 0.9, shimmer: 2.01 },
    key:    { type: 'triangle', base: 440, len: 0.09, gain: 0.5, noise: 5200 },
    block:  { type: 'square', base: 260, len: 0.14, gain: 0.26 },
    moon:   { type: 'sine', base: 392, len: 1.1, shimmer: 1.5 },
  };
  // note ratios relative to the voice's base pitch
  const SEQ = {
    need: [1, 1.335], done: [1, 1.26, 1.5, 2], pop: [1.5], pet: [2, 2.25], morph: [0.75, 1, 1.5],
    catch: [2], miss: [0.6], fail: [0.75, 0.6], hello: [1, 1.5], eat: [0.8, 0.9, 0.8], land: [0.5], unlock: [1, 1.26, 1.5, 2, 2.52],
  };
  let noiseBuf = null;
  function noise(t0, len, freq, vol) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + len);
    src.connect(bp).connect(g).connect(master); src.start(t0); src.stop(t0 + len + 0.02);
  }
  function tone(t0, freq, v) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = v.type; o.frequency.value = freq;
    const peak = 0.22 * (v.gain || 1);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + v.len);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + v.len + 0.03);
    if (v.shimmer) {
      const o2 = ctx.createOscillator(), g2 = ctx.createGain();
      o2.type = 'sine'; o2.frequency.value = freq * v.shimmer;
      g2.gain.setValueAtTime(0, t0); g2.gain.linearRampToValueAtTime(peak * 0.35, t0 + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.0008, t0 + v.len * 0.8);
      o2.connect(g2).connect(master); o2.start(t0); o2.stop(t0 + v.len);
    }
    if (v.noise) noise(t0, Math.min(0.09, v.len), v.noise, peak * 0.9);
  }
  BB.sfx = {
    on: true, volume: 0.4, voice: 'chime',
    play(name) {
      if (!this.on || this.volume <= 0 || !SEQ[name]) return;
      try {
        if (!ctx) { ctx = new AudioContext(); master = ctx.createGain(); master.connect(ctx.destination); }
        if (ctx.state === 'suspended') ctx.resume();
        master.gain.value = this.volume * 0.5;
        const v = VOICES[this.voice] || VOICES.chime;
        const step = Math.max(0.07, Math.min(0.14, v.len * 0.9));
        SEQ[name].forEach((r, i) => tone(ctx.currentTime + 0.01 + i * step, v.base * r, v));
      } catch {}
    },
  };
})();
