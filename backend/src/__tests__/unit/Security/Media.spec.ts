import { show } from "../../../controllers/MediaController";
import Message from "../../../models/Message";
import AssertTicketAccess from "../../../services/TicketServices/AssertTicketAccess";
import { promises as fs } from "fs";
import path from "path";
import upload from "../../../config/upload";
import { safeMediaFilename } from "../../../helpers/SafeMediaFilename";

jest.mock("../../../models/Message", () => ({ findOne: jest.fn() }));
jest.mock("../../../services/TicketServices/AssertTicketAccess", () =>
  jest.fn()
);

describe("protected media", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Message.findOne as jest.Mock).mockResolvedValue({ ticketId: 9 });
    (AssertTicketAccess as jest.Mock).mockResolvedValue({ id: 9 });
    jest.spyOn(fs, "realpath").mockImplementation(async value => String(value));
  });
  afterEach(() => jest.restoreAllMocks());
  const req = (filename = "report.pdf") =>
    ({ params: { filename }, user: { id: "2" } } as any);
  const res = () =>
    ({
      setHeader: jest.fn(),
      attachment: jest.fn(),
      sendFile: jest.fn((_file, _options, callback) => callback())
    } as any);

  it("checks ticket permission before serving a private file", async () => {
    const response = res();
    await show(req(), response);
    expect(AssertTicketAccess).toHaveBeenCalledWith(9, "2");
    expect(response.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "private, no-store"
    );
    expect(response.sendFile).toHaveBeenCalledWith(
      path.join(upload.directory, "report.pdf"),
      { cacheControl: false },
      expect.any(Function)
    );
  });
  it("does not serve a file when ticket access is denied", async () => {
    (AssertTicketAccess as jest.Mock).mockRejectedValue(new Error("denied"));
    const response = res();
    await expect(show(req(), response)).rejects.toThrow("denied");
    expect(response.sendFile).not.toHaveBeenCalled();
  });
  it.each(["../secret", "..\\secret", ".env", "bad\0name"])(
    "rejects unsafe path %s",
    async filename => {
      await expect(show(req(filename), res())).rejects.toMatchObject({
        statusCode: 404
      });
      expect(Message.findOne).not.toHaveBeenCalled();
    }
  );
  it("rejects a symlink outside the media directory", async () => {
    (fs.realpath as jest.Mock)
      .mockResolvedValueOnce(upload.directory)
      .mockResolvedValueOnce(path.resolve(upload.directory, "../secret.txt"));
    await expect(show(req(), res())).rejects.toMatchObject({ statusCode: 404 });
  });
  it("generates unique names without trusting the original path", () => {
    const names = Array.from({ length: 50 }, () =>
      safeMediaFilename("../../secret.pdf")
    );
    expect(new Set(names).size).toBe(50);
    expect(names.every(name => /^[a-f0-9-]+\.pdf$/.test(name))).toBe(true);
  });
});
