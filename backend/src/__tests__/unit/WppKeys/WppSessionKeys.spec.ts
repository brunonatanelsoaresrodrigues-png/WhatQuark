import WppKey from "../../../models/WppKey";
import {
  deleteFromRedis,
  getFromRedis,
  getRedisClient,
  setInRedis
} from "../../../libs/redisStore";
import GetWppSessionKeys from "../../../services/WppKeyServices/GetWppSessionKeys";
import StoreWppSessionKeys from "../../../services/WppKeyServices/StoreWppSessionKeys";

jest.mock("../../../models/WppKey", () => ({
  __esModule: true,
  default: { upsert: jest.fn(), findOne: jest.fn(), destroy: jest.fn() }
}));

jest.mock("../../../libs/redisStore", () => ({
  getRedisClient: jest.fn(),
  getFromRedis: jest.fn(),
  setInRedis: jest.fn(),
  deleteFromRedis: jest.fn()
}));

const mockedWppKey = WppKey as unknown as {
  upsert: jest.Mock;
  findOne: jest.Mock;
  destroy: jest.Mock;
};

const withRedis = (available: boolean) => {
  (getRedisClient as jest.Mock).mockReturnValue(available ? {} : null);
};

describe("WhatsApp session keys", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("caches sender keys in redis under the category Baileys actually emits", async () => {
    withRedis(true);

    await StoreWppSessionKeys({
      connectionId: 1,
      deviceId: 0,
      type: "sender-key",
      id: "abc",
      value: { some: "key" }
    });

    expect(setInRedis).toHaveBeenCalledWith(
      "wpp:1:0:sender-key:abc",
      JSON.stringify({ some: "key" })
    );
    expect(mockedWppKey.upsert).not.toHaveBeenCalled();
  });

  it("falls back to the database when redis is not configured", async () => {
    withRedis(false);

    await StoreWppSessionKeys({
      connectionId: 1,
      deviceId: 0,
      type: "session",
      id: "5511999999999@s.whatsapp.net.0",
      value: { some: "key" }
    });

    expect(setInRedis).not.toHaveBeenCalled();
    expect(mockedWppKey.upsert).toHaveBeenCalledWith({
      connectionId: 1,
      type: "session",
      keyId: "5511999999999@s.whatsapp.net.0",
      value: JSON.stringify({ some: "key" })
    });
  });

  it("always keeps pre-keys in the database", async () => {
    withRedis(true);

    await StoreWppSessionKeys({
      connectionId: 2,
      deviceId: 0,
      type: "pre-key",
      id: "31",
      value: { some: "key" }
    });

    expect(setInRedis).not.toHaveBeenCalled();
    expect(mockedWppKey.upsert).toHaveBeenCalled();
  });

  it("removes a key instead of storing a null value", async () => {
    withRedis(false);

    await StoreWppSessionKeys({
      connectionId: 2,
      deviceId: 0,
      type: "pre-key",
      id: "31",
      value: null
    });

    expect(mockedWppKey.upsert).not.toHaveBeenCalled();
    expect(mockedWppKey.destroy).toHaveBeenCalledWith({
      where: { connectionId: 2, type: "pre-key", keyId: "31" }
    });
  });

  it("removes a cached key instead of storing a null value", async () => {
    withRedis(true);

    await StoreWppSessionKeys({
      connectionId: 2,
      deviceId: 0,
      type: "session",
      id: "abc",
      value: null
    });

    expect(setInRedis).not.toHaveBeenCalled();
    expect(deleteFromRedis).toHaveBeenCalledWith("wpp:2:0:session:abc");
  });

  it("reads the newest stored value for a database key", async () => {
    withRedis(true);
    mockedWppKey.findOne.mockResolvedValue({
      value: JSON.stringify({ some: "key" })
    });

    const data = await GetWppSessionKeys({
      connectionId: 2,
      deviceId: 0,
      type: "pre-key",
      ids: ["31"]
    });

    expect(mockedWppKey.findOne).toHaveBeenCalledWith({
      where: { connectionId: 2, type: "pre-key", keyId: "31" },
      order: [["id", "DESC"]]
    });
    expect(data).toEqual({ "31": { some: "key" } });
  });

  it("reads cached keys back from redis", async () => {
    withRedis(true);
    (getFromRedis as jest.Mock).mockResolvedValue(
      JSON.stringify({ some: "key" })
    );

    const data = await GetWppSessionKeys({
      connectionId: 1,
      deviceId: 0,
      type: "sender-key",
      ids: ["abc"]
    });

    expect(getFromRedis).toHaveBeenCalledWith("wpp:1:0:sender-key:abc");
    expect(mockedWppKey.findOne).not.toHaveBeenCalled();
    expect(data).toEqual({ abc: { some: "key" } });
  });
});
