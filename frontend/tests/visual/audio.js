// Isolated QA only. No physical microphone is accessed, and the API adapter never sends messages.
export function installSyntheticAudio() {
  const mode = new URLSearchParams(window.location.search).get("audio");
  if (!["synthetic", "blocked"].includes(mode)) return;
  const devices = navigator.mediaDevices;
  const original = Object.getOwnPropertyDescriptor(devices, "getUserMedia");
  const contexts = new Set();
  let captures = 0;
  Object.defineProperty(devices, "getUserMedia", {
    configurable: true,
    value: async () => {
      if (mode === "blocked") throw new DOMException("Synthetic permission rejection", "NotAllowedError");
      const context = new AudioContext();
      contexts.add(context);
      await context.resume();
      const destination = context.createMediaStreamDestination();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      gain.gain.value = 0.04;
      oscillator.frequency.value = 440;
      oscillator.connect(gain).connect(destination);
      oscillator.start();
      captures += 1;
      console.info(`[qa-audio] synthetic capture ${captures}; no physical microphone`);
      for (const track of destination.stream.getTracks()) {
        const stop = track.stop.bind(track);
        track.stop = () => {
          stop();
          if (contexts.has(context)) {
            contexts.delete(context);
            oscillator.stop();
            context.close();
          }
        };
      }
      return destination.stream;
    }
  });
  window.addEventListener("beforeunload", () => {
    contexts.forEach(context => context.close());
    if (original) Object.defineProperty(devices, "getUserMedia", original);else delete devices.getUserMedia;
  }, {
    once: true
  });
}
