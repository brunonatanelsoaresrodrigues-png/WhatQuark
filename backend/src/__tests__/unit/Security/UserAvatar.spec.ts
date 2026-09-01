import {
  canManageUserAvatar,
  validateUserAvatar
} from "../../../services/UserServices/UserAvatarService";

const file = (mimetype: string, buffer: Buffer): Express.Multer.File =>
  ({ mimetype, buffer } as Express.Multer.File);

describe("user avatar security", () => {
  it("allows a user to manage only their own avatar", () => {
    expect(canManageUserAvatar({ id: "7", profile: "user" }, 7)).toBe(true);
    expect(canManageUserAvatar({ id: "7", profile: "user" }, 8)).toBe(false);
    expect(canManageUserAvatar({ id: "7", profile: "admin" }, 8)).toBe(true);
  });

  it("accepts supported images only when the signature matches", () => {
    expect(
      validateUserAvatar(
        file("image/png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
    ).toEqual({ extension: ".png" });
    expect(() =>
      validateUserAvatar(file("image/png", Buffer.from("not an image")))
    ).toThrow("ERR_INVALID_USER_AVATAR");
    expect(() =>
      validateUserAvatar(file("image/svg+xml", Buffer.from("<svg/>")))
    ).toThrow("ERR_INVALID_USER_AVATAR");
  });
});
