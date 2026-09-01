import { readFile } from "node:fs/promises";

// mic-recorder-to-mp3 2.2.2 assigns its encoder aliases without declarations.
// Those implicit globals throw as soon as Vite loads the bundle in strict ESM mode.
// Declare only the known alias block inside the existing UMD factory, never on window.
export function repairMp3Encoder(source) {
  if (!/^Lame = Lame_1;/m.test(source)) return source;
  if (!source.includes("function Lame$1()")) {
    throw new Error("Unrecognized MP3 encoder bundle: review the compatibility patch.");
  }
  return source.replace(/^([A-Z][A-Za-z0-9]+) = ([A-Za-z0-9]+_1);$/gm, "var $1 = $2;");
}
const encoderPath = /[\\/]mic-recorder-to-mp3[\\/]dist[\\/]index\.js$/;
export const mp3EncoderVitePlugin = () => ({
  name: "mp3-encoder-module-scope",
  enforce: "pre",
  transform(source, id) {
    if (encoderPath.test(id.split("?")[0])) return {
      code: repairMp3Encoder(source),
      map: null
    };
    return null;
  }
});
export const mp3EncoderEsbuildPlugin = () => ({
  name: "mp3-encoder-module-scope",
  setup(build) {
    build.onLoad({
      filter: encoderPath
    }, async ({
      path
    }) => ({
      contents: repairMp3Encoder(await readFile(path, "utf8")),
      loader: "js"
    }));
  }
});
