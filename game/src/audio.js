// Procedural sound only: every effect is a WebAudio oscillator or a burst of
// filtered noise, so the game ships no audio files. The context starts on the
// first user gesture (browsers block sound before that) and M mutes everything.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let sirenOsc = null;
  let sirenGain = null;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function unlock() {
    if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (!ensure() || muted) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, context.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), context.currentTime + duration);
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + duration + 0.02);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noise(duration, volume, filterFreq) {
    if (!ensure() || muted) return;
    try {
      const length = Math.max(1, Math.floor(context.sampleRate * duration));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = context.createGain();
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    } catch {
      // Sound is garnish.
    }
  }

  return {
    unlock,
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      noise(0.12, 0.5, 1800);
      tone(160, 0.08, 'square', 0.18, 60);
    },
    punch() {
      noise(0.09, 0.4, 500);
      tone(90, 0.09, 'sine', 0.3, 45);
    },
    hit() {
      tone(220, 0.1, 'sawtooth', 0.2, 110);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.25, 990);
    },
    cash() {
      tone(880, 0.08, 'sine', 0.22);
      setTimeout(() => tone(1320, 0.12, 'sine', 0.22), 80);
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((freq, i) => setTimeout(() => tone(freq, 0.16, 'triangle', 0.25), i * 110));
    },
    wantedUp() {
      tone(392, 0.14, 'square', 0.16, 311);
      setTimeout(() => tone(311, 0.2, 'square', 0.16, 233), 130);
    },
    busted() {
      [330, 262, 196].forEach((freq, i) => setTimeout(() => tone(freq, 0.22, 'sawtooth', 0.18), i * 160));
    },
    click() {
      tone(700, 0.05, 'sine', 0.15);
    },
    /** Continuous engine hum while driving; call every frame with speed 0..1. */
    engine(speed) {
      if (!ensure() || muted) {
        if (engineGain) engineGain.gain.value = 0;
        return;
      }
      try {
        if (!engineOsc) {
          engineOsc = context.createOscillator();
          engineOsc.type = 'sawtooth';
          engineOsc.frequency.value = 60;
          engineGain = context.createGain();
          engineGain.gain.value = 0;
          const filter = context.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 500;
          engineOsc.connect(filter);
          filter.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        }
        engineOsc.frequency.setTargetAtTime(55 + speed * 140, context.currentTime, 0.08);
        engineGain.gain.setTargetAtTime(speed > 0.02 ? 0.05 + speed * 0.05 : 0, context.currentTime, 0.1);
      } catch {
        // Sound is garnish.
      }
    },
    /** Two-tone siren while police are near; call every frame with true/false. */
    siren(active, dt) {
      if (!ensure() || muted || !active) {
        if (sirenGain) sirenGain.gain.value = 0;
        return;
      }
      try {
        if (!sirenOsc) {
          sirenOsc = context.createOscillator();
          sirenOsc.type = 'triangle';
          sirenOsc.frequency.value = 700;
          sirenGain = context.createGain();
          sirenGain.gain.value = 0;
          sirenOsc.connect(sirenGain);
          sirenGain.connect(master);
          sirenOsc.start();
        }
        sirenTimer -= dt;
        if (sirenTimer <= 0) {
          sirenTimer = 0.42;
          sirenHigh = !sirenHigh;
          sirenOsc.frequency.setValueAtTime(sirenHigh ? 920 : 660, context.currentTime);
        }
        sirenGain.gain.setTargetAtTime(0.045, context.currentTime, 0.1);
      } catch {
        // Sound is garnish.
      }
    },
  };
}
