import { storedMediaType } from "../../../helpers/StoredMediaType";

describe("stored media type", () => {
  it("preserves stickers instead of flattening webp into generic images", () => {
    expect(storedMediaType("sticker", "image/webp")).toBe("sticker");
  });

  it.each([
    ["audio", "audio/mpeg", "audio"],
    ["image", "image/jpeg", "image"],
    ["document", "application/pdf", "application"]
  ] as const)("stores %s media using its MIME family", (type, mime, expected) => {
    expect(storedMediaType(type, mime)).toBe(expected);
  });
});
