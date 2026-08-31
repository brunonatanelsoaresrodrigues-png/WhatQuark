const makeError = code => Object.assign(new Error(code), {
  code
});
export function audioErrorMessage(error) {
  if (["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(error?.name)) return "Permita o microfone nas configurações deste site e tente gravar novamente.";
  if (["NotFoundError", "DevicesNotFoundError"].includes(error?.name)) return "Nenhum microfone foi encontrado. Conecte ou selecione um microfone no navegador.";
  if (["NotReadableError", "TrackStartError", "AbortError"].includes(error?.name)) return "O navegador não conseguiu abrir o microfone. Confira o dispositivo e se outro aplicativo está usando-o.";
  if (error?.code === "AUDIO_UNSUPPORTED") return "A gravação precisa de HTTPS e de um navegador com acesso ao microfone. Você também pode anexar um arquivo de áudio.";
  if (error?.code === "AUDIO_TOO_SHORT") return "O áudio ficou muito curto. Grave por pelo menos um segundo.";
  if (error?.code === "AUDIO_TOO_LARGE") return "A gravação ultrapassou 20 MB. Grave um áudio menor.";
  if (/fetch|dynamically imported|loading chunk/i.test(error?.message || "")) return "Não foi possível carregar o gravador. Atualize a página para carregar a versão atual.";
  return "Não foi possível gravar o áudio. Confira o microfone ou anexe um arquivo de áudio pelo botão de anexos.";
}
export function prepareRecordedAudio(blob, now = Date.now()) {
  if (!blob || blob.size < 10000) throw makeError("AUDIO_TOO_SHORT");
  if (blob.size > 20 * 1024 * 1024) throw makeError("AUDIO_TOO_LARGE");
  // The encoder returns audio/mp3; send the same normalized File used by the preview.
  return new File([blob], `${now}.mp3`, {
    type: "audio/mpeg",
    lastModified: now
  });
}
export function createAudioRecorder({
  loadRecorder = async () => (await import("mic-recorder-to-mp3")).default,
  supported = () => typeof window !== "undefined" && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia && !!(window.AudioContext || window.webkitAudioContext)
} = {}) {
  let recorder;
  let generation = 0;
  let starting = false;
  let recording = false;
  const release = instance => {
    if (!instance) return;
    try {
      instance.stop();
    } catch (_) {/* Still release a partially initialized recorder. */}
    instance.activeStream?.getTracks().forEach(track => {
      try {
        track.stop();
      } catch (_) {/* Continue releasing the remaining tracks. */}
    });
    if (instance.context && instance.context.state !== "closed") {
      try {
        Promise.resolve(instance.context.close()).catch(() => undefined);
      } catch (_) {/* Already closed by the recorder. */}
    }
  };
  return {
    async start() {
      if (starting || recording) throw makeError("AUDIO_BUSY");
      if (!supported()) throw makeError("AUDIO_UNSUPPORTED");
      const attempt = ++generation;
      starting = true;
      let instance;
      try {
        const Recorder = await loadRecorder();
        if (attempt !== generation) throw makeError("AUDIO_CANCELLED");
        instance = new Recorder({
          bitRate: 128
        });
        recorder = instance;
        // start() requests getUserMedia itself. Opening another stream first can lock the device.
        await instance.start();
        if (attempt !== generation) throw makeError("AUDIO_CANCELLED");
        recording = true;
      } catch (error) {
        release(instance);
        if (recorder === instance) recorder = undefined;
        throw error;
      } finally {
        if (attempt === generation) starting = false;
      }
    },
    async finish() {
      if (!recorder || !recording) throw makeError("AUDIO_NOT_RECORDING");
      const instance = recorder;
      recorder = undefined;
      recording = false;
      try {
        const [, blob] = await instance.stop().getMp3();
        return prepareRecordedAudio(blob);
      } finally {
        release(instance);
      }
    },
    cancel() {
      generation += 1;
      starting = false;
      recording = false;
      const instance = recorder;
      recorder = undefined;
      release(instance);
    }
  };
}
