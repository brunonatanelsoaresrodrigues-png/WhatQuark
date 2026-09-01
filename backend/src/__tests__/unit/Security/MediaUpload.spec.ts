import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { v4 as uuid } from "uuid";
import { validateMediaUpload } from "../../../helpers/ValidateMediaUpload";

const createFile = async (
  name: string,
  mimetype: string,
  contents: Buffer
): Promise<Express.Multer.File> => {
  const filePath = path.join(os.tmpdir(), `whatquark-${uuid()}`);
  await fs.writeFile(filePath, contents);
  return {
    fieldname: "medias",
    originalname: name,
    encoding: "7bit",
    mimetype,
    destination: os.tmpdir(),
    filename: path.basename(filePath),
    path: filePath,
    size: contents.length,
    stream: undefined as any,
    buffer: Buffer.alloc(0)
  };
};

describe("media upload validation", () => {
  const files: string[] = [];
  afterEach(async () => {
    await Promise.all(files.splice(0).map(file => fs.unlink(file).catch(() => undefined)));
  });

  it("accepts a real webp signature", async () => {
    const file = await createFile(
      "figurinha.webp",
      "image/webp",
      Buffer.from("RIFF1234WEBPVP8 ", "ascii")
    );
    files.push(file.path);
    await expect(validateMediaUpload(file)).resolves.toBeUndefined();
  });

  it("rejects content that does not match its declared image type", async () => {
    const file = await createFile("foto.png", "image/png", Buffer.from("not-a-png"));
    files.push(file.path);
    await expect(validateMediaUpload(file)).rejects.toMatchObject({
      message: "ERR_INVALID_MEDIA_CONTENT",
      statusCode: 400
    });
  });

  it("rejects executable extensions", async () => {
    const file = await createFile("arquivo.exe", "application/octet-stream", Buffer.from("MZ"));
    files.push(file.path);
    await expect(validateMediaUpload(file)).rejects.toMatchObject({
      message: "ERR_MEDIA_TYPE_NOT_ALLOWED",
      statusCode: 400
    });
  });
});
