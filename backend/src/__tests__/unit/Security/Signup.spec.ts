import { signup, store } from "../../../controllers/UserController";
import CreateUserService from "../../../services/UserServices/CreateUserService";
import CheckSettings from "../../../helpers/CheckSettings";

jest.mock("../../../services/UserServices/CreateUserService", () => jest.fn());
jest.mock("../../../services/UserServices/UpdateUserService", () => jest.fn());
jest.mock("../../../services/UserServices/ListUsersService", () => jest.fn());
jest.mock("../../../services/UserServices/ShowUserService", () => jest.fn());
jest.mock("../../../services/UserServices/DeleteUserService", () => jest.fn());
jest.mock("../../../helpers/CheckSettings", () => jest.fn());
jest.mock("../../../libs/socket", () => ({
  getIO: () => ({ to: () => ({ emit: jest.fn() }) })
}));

describe("public signup", () => {
  const response = () =>
    ({ status: jest.fn().mockReturnThis(), json: jest.fn() } as any);
  beforeEach(() => {
    jest.clearAllMocks();
    (CheckSettings as jest.Mock).mockResolvedValue("enabled");
    (CreateUserService as jest.Mock).mockResolvedValue({ id: 7 });
  });
  it("ignores every privileged field submitted by a public client", async () => {
    await signup(
      {
        body: {
          name: "User",
          email: "u@example.test",
          password: "password",
          profile: "admin",
          queueIds: [99],
          whatsappId: 1,
          canAccessQuarkClinic: true
        },
        url: "/signup?x=1"
      } as any,
      response()
    );
    expect(CreateUserService).toHaveBeenCalledWith({
      name: "User",
      email: "u@example.test",
      password: "password",
      profile: "user",
      queueIds: [],
      canAccessQuarkClinic: false
    });
  });
  it("rejects disabled or missing signup settings", async () => {
    (CheckSettings as jest.Mock).mockResolvedValue("disabled");
    await expect(signup({ body: {} } as any, response())).rejects.toMatchObject(
      { statusCode: 403 }
    );
    expect(CreateUserService).not.toHaveBeenCalled();
  });
  it("does not allow ordinary users to use the admin creation route", async () => {
    await expect(
      store({ user: { profile: "user" }, body: {} } as any, response())
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(CreateUserService).not.toHaveBeenCalled();
  });
});
