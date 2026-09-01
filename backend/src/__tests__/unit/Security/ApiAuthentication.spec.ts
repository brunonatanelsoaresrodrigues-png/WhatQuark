import isAuthApi from "../../../middleware/isAuthApi";
import Setting from "../../../models/Setting";

jest.mock("../../../models/Setting", () => ({ findOne: jest.fn() }));
const request = (authorization?: string) =>
  ({ headers: { authorization } } as any);

describe("API authentication", () => {
  beforeEach(() => jest.clearAllMocks());
  it("looks up only the dedicated API token setting", async () => {
    (Setting.findOne as jest.Mock).mockImplementation(({ where }) =>
      where.key === "userApiToken" && where.value === "secret-token"
        ? { key: "userApiToken", value: "secret-token" }
        : null
    );
    const next = jest.fn();
    await isAuthApi(request("Bearer secret-token"), {} as any, next);
    expect(Setting.findOne).toHaveBeenCalledWith({
      where: { key: "userApiToken", value: "secret-token" }
    });
    expect(next).toHaveBeenCalledTimes(1);
    await expect(
      isAuthApi(request("Bearer enabled"), {} as any, next)
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(next).toHaveBeenCalledTimes(1);
  });
  it.each([undefined, "Basic value", "Bearer", "Bearer ", "Bearer a b"])(
    "rejects malformed credentials: %s",
    async value => {
      const next = jest.fn();
      await expect(
        isAuthApi(request(value), {} as any, next)
      ).rejects.toMatchObject({ statusCode: 401 });
      expect(next).not.toHaveBeenCalled();
      expect(Setting.findOne).not.toHaveBeenCalled();
    }
  );
});
