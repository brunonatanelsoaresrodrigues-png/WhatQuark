import { sign } from "jsonwebtoken";
import { AuthenticateUser } from "../../../services/AuthServices/AuthenticateUser";
import auth from "../../../config/auth";
import User from "../../../models/User";

jest.mock("../../../models/User", () => ({ findByPk: jest.fn() }));

describe("access tokens", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 1,
      profile: "user",
      tokenVersion: 2
    });
  });
  it("uses the current database profile", async () => {
    const token = sign(
      { id: 1, profile: "admin", tokenVersion: 2 },
      auth.secret,
      { expiresIn: "15m" }
    );
    expect(await AuthenticateUser(token)).toMatchObject({ profile: "user" });
  });
  it.each([
    { id: 1, tokenVersion: 1 },
    { id: 1 },
    { id: "invalid", tokenVersion: 2 }
  ])("rejects revoked or incomplete claims %j", async claims => {
    const token = sign(claims, auth.secret, { expiresIn: "15m" });
    await expect(AuthenticateUser(token)).rejects.toMatchObject({
      statusCode: 401
    });
  });
  it("rejects deleted users", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue(null);
    const token = sign({ id: 1, tokenVersion: 2 }, auth.secret, {
      expiresIn: "15m"
    });
    await expect(AuthenticateUser(token)).rejects.toMatchObject({
      statusCode: 401
    });
  });
  it("rejects expired tokens", async () => {
    const token = sign({ id: 1, tokenVersion: 2 }, auth.secret, {
      expiresIn: -1
    });
    await expect(AuthenticateUser(token)).rejects.toMatchObject({
      statusCode: 401
    });
  });
});
