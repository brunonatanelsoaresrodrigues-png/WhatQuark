const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { buildSync } = require("esbuild");

const source = buildSync({
  entryPoints: [path.join(__dirname, "../src/services/mediaComposer.js")],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs"
}).outputFiles[0].text;
const loaded = new Module(__filename, module);
loaded._compile(source, __filename);
const media = loaded.exports;

const availabilitySource = buildSync({
  entryPoints: [path.join(__dirname, "../src/services/composerAvailability.js")],
  bundle: true, write: false, platform: "node", format: "cjs"
}).outputFiles[0].text;
const availabilityModule = new Module(__filename, module);
availabilityModule._compile(availabilitySource, __filename);
const { getComposerAvailability } = availabilityModule.exports;

test("context validation blocks sending without disabling emoji, typing or audio capture", () => {
  assert.deepEqual(getComposerAvailability({
    loading: false,
    recording: false,
    hasRecordedAudio: false,
    ticketStatus: "open",
    sendBlocked: true
  }), {
    composeDisabled: false,
    sendDisabled: true
  });
});

test("closed or busy conversations disable composing and sending", () => {
  assert.deepEqual(getComposerAvailability({
    loading: false,
    recording: false,
    hasRecordedAudio: false,
    ticketStatus: "closed",
    sendBlocked: false
  }), {
    composeDisabled: true,
    sendDisabled: true
  });
  assert.equal(getComposerAvailability({
    loading: false,
    recording: true,
    hasRecordedAudio: false,
    ticketStatus: "open",
    sendBlocked: false
  }).composeDisabled, true);
});

const file = (name, size = 1024, lastModified = 1) => ({
  name,
  size,
  lastModified
});

test("appends dropped files without duplicating the same attachment", () => {
  const first = file("exame.pdf");
  const result = media.selectMediaFiles([first], [first, file("foto.jpg")]);
  assert.deepEqual(result.accepted.map(item => item.name), ["exame.pdf", "foto.jpg"]);
  assert.equal(result.rejected.length, 0);
});

test("blocks dangerous, oversized and excess files before upload", () => {
  const current = Array.from({ length: 9 }, (_, index) => file(`${index}.pdf`, 100, index));
  const result = media.selectMediaFiles(current, [
    file("script.js"),
    file("grande.pdf", media.MAX_MEDIA_FILE_BYTES + 1),
    file("permitido.pdf", 100, 30),
    file("excedente.pdf", 100, 31)
  ]);
  assert.equal(result.accepted.length, 10);
  assert.equal(result.rejected.length, 3);
});

test("recognizes new and legacy webp stickers", () => {
  assert.equal(media.isStickerMessage({ mediaType: "sticker" }), true);
  assert.equal(media.isStickerMessage({ mediaType: "image", mediaUrl: "/public/a.webp" }), true);
  assert.equal(media.isStickerMessage({ mediaType: "image", mediaUrl: "/public/a.png" }), false);
});

test("hides generated image filenames but preserves real captions", () => {
  assert.equal(media.shouldRenderMessageBody({
    mediaType: "image",
    body: "f03e7889-c0df-43c0-916e-d2f607b7035b.jpeg"
  }), false);
  assert.equal(media.shouldRenderMessageBody({
    mediaType: "image",
    body: "Receita atualizada do paciente"
  }), true);
  assert.equal(media.shouldRenderMessageBody({
    mediaType: "document",
    body: "receita.pdf"
  }), true);
});

const audioSource = buildSync({
  entryPoints: [path.join(__dirname, "../src/services/audioRecorder.js")],
  bundle: true, write: false, platform: "node", format: "cjs",
  external: ["mic-recorder-to-mp3"]
}).outputFiles[0].text;
const audioModule = new Module(__filename, module);
audioModule.paths = Module._nodeModulePaths(__dirname);
audioModule._compile(audioSource, __filename);
const { createAudioRecorder, prepareRecordedAudio, audioErrorMessage } = audioModule.exports;

test("recorded MP3 is previewed and uploaded as the same audio/mpeg file", async () => {
  const blob = new Blob([new Uint8Array(12000)], { type: "audio/mp3" });
  const recording = prepareRecordedAudio(blob, 1234);
  const payload = new FormData();
  payload.append("medias", recording);
  assert.equal(payload.get("medias").type, "audio/mpeg");
  assert.equal(payload.get("medias").name, "1234.mp3");
  assert.deepEqual(await recording.arrayBuffer(), await blob.arrayBuffer());
  assert.throws(() => prepareRecordedAudio(new Blob(["short"])), { code: "AUDIO_TOO_SHORT" });
  assert.throws(() => prepareRecordedAudio(new Blob([new Uint8Array(20 * 1024 * 1024 + 1)])), { code: "AUDIO_TOO_LARGE" });
});

test("recorder opens capture once, releases resources and can record again", async () => {
  let starts = 0;
  let tracksStopped = 0;
  class Recorder {
    activeStream = { getTracks: () => [{ stop: () => { tracksStopped += 1; } }] };
    context = { state: "running", close: async () => { this.context.state = "closed"; } };
    async start() { starts += 1; }
    stop() { return this; }
    async getMp3() { return [[], new Blob([new Uint8Array(12000)], { type: "audio/mp3" })]; }
  }
  const recorder = createAudioRecorder({ loadRecorder: async () => Recorder, supported: () => true });
  await recorder.start();
  await assert.rejects(() => recorder.start(), { code: "AUDIO_BUSY" });
  const result = await recorder.finish();
  assert.equal(starts, 1);
  assert.equal(result.type, "audio/mpeg");
  assert.equal(tracksStopped, 1);
  await recorder.start();
  recorder.cancel();
  assert.equal(starts, 2);
  assert.equal(tracksStopped, 2);
});

test("leaving the conversation during microphone permission cannot start an orphan recording", async () => {
  let resolveCapture;
  let stopped = 0;
  class Recorder {
    activeStream = { getTracks: () => [{ stop: () => { stopped += 1; } }] };
    start() { return new Promise(resolve => { resolveCapture = resolve; }); }
    stop() { return this; }
  }
  const recorder = createAudioRecorder({ loadRecorder: async () => Recorder, supported: () => true });
  const start = recorder.start();
  await Promise.resolve();
  recorder.cancel();
  resolveCapture();
  await assert.rejects(start, { code: "AUDIO_CANCELLED" });
  assert.ok(stopped > 0);
  await assert.rejects(() => recorder.finish(), { code: "AUDIO_NOT_RECORDING" });
});

test("recording errors distinguish permission, missing and busy devices", () => {
  assert.match(audioErrorMessage({ name: "NotAllowedError" }), /Permita o microfone/);
  assert.match(audioErrorMessage({ name: "NotFoundError" }), /Nenhum microfone/);
  assert.match(audioErrorMessage({ name: "NotReadableError" }), /outro aplicativo/);
  assert.match(audioErrorMessage({ code: "AUDIO_UNSUPPORTED" }), /HTTPS/);
});

test("the bundled MP3 encoder processes PCM without an unbound Lame global", async () => {
  const fs = require("node:fs");
  const vm = require("node:vm");
  const { pathToFileURL } = require("node:url");
  const { repairMp3Encoder } = await import(pathToFileURL(path.join(__dirname, "../tooling/mp3EncoderCompat.mjs")));
  const raw = fs.readFileSync(require.resolve("mic-recorder-to-mp3"), "utf8");
  const module = { exports: {} };
  let processor;
  const stream = { getAudioTracks: () => [{ stop() {} }] };
  class AudioContext {
    sampleRate = 44100;
    state = "running";
    destination = {};
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createScriptProcessor() {
      processor = { connect() {}, disconnect() {} };
      return processor;
    }
    close() { this.state = "closed"; return Promise.resolve(); }
  }
  const sandbox = {
    module, exports: module.exports, window: { AudioContext },
    navigator: { mediaDevices: { getUserMedia: async () => stream } },
    setTimeout, clearTimeout, Blob, console
  };
  const repaired = repairMp3Encoder(raw);
  assert.doesNotMatch(repaired, /^Lame = Lame_1;/m);
  assert.match(repaired, /^var Lame = Lame_1;/m);
  vm.runInNewContext('"use strict";\n' + repaired, sandbox);
  const recorder = new module.exports({ bitRate: 128, startRecordingAt: 0 });
  await recorder.start();
  await new Promise(resolve => setTimeout(resolve, 5));
  const samples = Float32Array.from({ length: 4096 }, (_, index) => Math.sin(index / 16) * 0.05);
  for (let index = 0; index < 24; index += 1) {
    processor.onaudioprocess({ inputBuffer: { getChannelData: () => samples } });
  }
  const [, blob] = await recorder.stop().getMp3();
  assert.ok(blob.size > 10000, "PCM must produce a nonempty MP3 recording");
  assert.equal(prepareRecordedAudio(blob).type, "audio/mpeg");
  assert.equal(Object.hasOwn(sandbox, "Lame"), false, "encoder aliases must not leak into globals");
});
