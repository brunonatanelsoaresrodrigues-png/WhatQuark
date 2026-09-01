import WppKey from "../../../models/WppKey";
import StoreWppSessionKeys from "../../../services/WppKeyServices/StoreWppSessionKeys";

jest.mock("../../../models/WppKey", () => ({
  __esModule: true,
  default: { upsert: jest.fn() }
}));
jest.mock("../../../libs/redisStore", () => ({ setInRedis: jest.fn() }));
jest.mock("../../../utils/logger", () => ({
  logger: { error: jest.fn() }
}));

describe("StoreWppSessionKeys", () => {
  beforeEach(() => jest.clearAllMocks());

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
});
