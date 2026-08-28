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
