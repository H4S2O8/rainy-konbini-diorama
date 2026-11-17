// Procedural Web Audio rainy-night konbini ambience (unlocks on first canvas interaction, zero UI)

export interface NightAmbienceController {
  notifyDoorOpen: () => void;
  setInsideKonbini: (inside: boolean) => void;
}

export function setupNightAmbience(canvas: HTMLElement): NightAmbienceController {
  let ctx: AudioContext | null = null;
  let started = false;
  let lastChimeTime = -999;
  let rainLowpass: BiquadFilterNode | null = null;
  let rainMasterGain: GainNode | null = null;
  let insideKonbini = false;

  function initAudio() {
    if (started) return;
    started = true;

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // 1. Soft stereo rain patter buffer (4 seconds seamless pink-filtered noise)
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 4;
    const buffer = ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.950 * b2 + white * 0.048;
        b3 = 0.850 * b3 + white * 0.065;
        // Occasional tiny soft droplet tick
        const drop = Math.random() < 0.0008 ? (Math.random() - 0.5) * 0.28 : 0;
        data[i] = (b0 + b1 + b2 + b3 + white * 0.018 + drop) * 0.55;
      }
    }

    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = buffer;
    rainSrc.loop = true;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = insideKonbini ? 460 : 1650;
    rainLowpass = lowpass;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 180;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(insideKonbini ? 0.026 : 0.055, ctx.currentTime + 2.2);
    rainMasterGain = masterGain;

    rainSrc.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(masterGain);
    masterGain.connect(ctx.destination);
    rainSrc.start();
  }

  const unlockEvents = ['pointerdown', 'wheel', 'touchstart'];
  for (const ev of unlockEvents) {
    canvas.addEventListener(ev, initAudio, { passive: true });
  }

  // Muffled, nostalgic Japanese konbini doorway chime (heard softly through the rain)
  function notifyDoorOpen() {
    if (!ctx || ctx.state !== 'running') return;
    if (ctx.currentTime - lastChimeTime < 8) return;
    lastChimeTime = ctx.currentTime;

    // Classic gentle warm konbini-esque major-add9 interval phrase (muffled lowpass)
    const notes = [659.25, 523.25, 392.0, 523.25, 587.33, 783.99];
    const times = [0.0, 0.24, 0.48, 0.72, 0.98, 1.26];
    const durs = [0.45, 0.45, 0.45, 0.45, 0.45, 1.15];

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = insideKonbini ? 3200 : 1350; // Crisp chime indoors, muffled outdoors
    filter.connect(ctx.destination);

    notes.forEach((freq, idx) => {
      if (!ctx) return;
      const t0 = ctx.currentTime + times[idx];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t0);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.014, t0 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durs[idx]);

      osc.connect(gain);
      gain.connect(filter);
      osc.start(t0);
      osc.stop(t0 + durs[idx] + 0.05);
    });
  }

  function setInsideKonbini(inside: boolean) {
    if (inside === insideKonbini) return;
    insideKonbini = inside;
    if (!ctx || !rainLowpass || !rainMasterGain) return;
    const t = ctx.currentTime;
    rainLowpass.frequency.setTargetAtTime(inside ? 460 : 1650, t, 0.28);
    rainMasterGain.gain.setTargetAtTime(inside ? 0.026 : 0.055, t, 0.28);
  }

  return { notifyDoorOpen, setInsideKonbini };
}
