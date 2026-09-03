import WppKey from "../../../models/WppKey";
import StoreWppSessionKeys from "../../../services/WppKeyServices/StoreWppSessionKeys";
import { logger } from "../../../utils/logger";

jest.mock("../../../models/WppKey", () => ({
  __esModule: true,
  default: { upsert: jest.fn() }
}));
jest.mock("../../../libs/redisStore", () => ({ setInRedis: jest.fn() }));
jest.mock("../../../utils/logger", () => ({
  logger: { error: jest.fn() }
}));

describe("StoreWppSessionKeys", () => {
  beforeEach(() => jest.resetAllMocks());

  it("retries a transient database deadlock", async () => {
    (WppKey.upsert as jest.Mock)
      .mockRejectedValueOnce({ original: { code: "ER_LOCK_DEADLOCK" } })
      .mockResolvedValueOnce([{}, true]);

    await StoreWppSessionKeys({
      connectionId: 1,
      deviceId: 1,
      type: "pre-key",
      id: "1024",
      value: { keyPair: true }
    });

    expect(WppKey.upsert).toHaveBeenCalledTimes(2);
  });

  it("stores sync state larger than the previous TEXT limit without truncating it", async () => {
    (WppKey.upsert as jest.Mock).mockResolvedValue([{}, true]);
    const value = { state: "x".repeat(100000) };
    await StoreWppSessionKeys({
      connectionId: 1,
      deviceId: 1,
      type: "app-state-sync-version",
      id: "regular",
      value
    });
    expect(WppKey.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ value: JSON.stringify(value) })
    );
  });

  it("reports failure without exposing private keys or pretending persistence succeeded", async () => {
    (WppKey.upsert as jest.Mock).mockRejectedValue({
      original: { code: "ER_DATA_TOO_LONG", parameters: ["PRIVATE_SIGNAL_KEY"] }
    });
    await expect(
      StoreWppSessionKeys({
        connectionId: 1,
        deviceId: 1,
        type: "app-state-sync-version",
        id: "regular",
        value: "PRIVATE_SIGNAL_KEY"
      })
    ).rejects.toThrow("ERR_WHATSAPP_KEY_STORAGE");
    expect(WppKey.upsert).toHaveBeenCalledTimes(1);
    expect(
      JSON.stringify((logger.error as jest.Mock).mock.calls)
    ).not.toContain("PRIVATE_SIGNAL_KEY");
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "ER_DATA_TOO_LONG" })
    );
  });

  it("bounds deadlock retries and reports an exhausted save", async () => {
    (WppKey.upsert as jest.Mock).mockRejectedValue({
      code: "ER_LOCK_DEADLOCK"
    });
    await expect(
      StoreWppSessionKeys({
        connectionId: 1,
        deviceId: 1,
        type: "pre-key",
        id: "1",
        value: {}
      })
    ).rejects.toThrow("ERR_WHATSAPP_KEY_STORAGE");
    expect(WppKey.upsert).toHaveBeenCalledTimes(3);
  });
});
