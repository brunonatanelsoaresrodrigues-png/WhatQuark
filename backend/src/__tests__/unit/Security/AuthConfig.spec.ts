describe("authentication configuration", () => {
  const access = process.env.JWT_SECRET;
  const refresh = process.env.JWT_REFRESH_SECRET;
  afterEach(() => {
    process.env.JWT_SECRET = access;
    process.env.JWT_REFRESH_SECRET = refresh;
  });
  it.each(["", "mysecret", "3123123213123"])(
    "rejects missing or weak secrets: %s",
    value => {
      process.env.JWT_SECRET = value;
      expect(() =>
        jest.isolateModules(() => require("../../../config/auth"))
      ).toThrow("JWT_SECRET");
    }
  );
  it("rejects reusing the access key as the refresh key", () => {
    process.env.JWT_REFRESH_SECRET = access;
    expect(() =>
      jest.isolateModules(() => require("../../../config/auth"))
    ).toThrow("must be different");
  });
});
