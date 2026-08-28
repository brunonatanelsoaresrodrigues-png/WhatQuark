import User from "../../../models/User";
import EnsureTicketDeletionPermissionService from "../../../services/TicketServices/EnsureTicketDeletionPermissionService";

jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

describe("EnsureTicketDeletionPermissionService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("allows the current administrator profile", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({ profile: "admin" });

    await expect(
      EnsureTicketDeletionPermissionService(1)
    ).resolves.toBeUndefined();
    expect(User.findByPk).toHaveBeenCalledWith(1, {
      attributes: ["profile"]
    });
  });

  it("denies a regular user", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({ profile: "user" });

    await expect(EnsureTicketDeletionPermissionService(2)).rejects.toEqual(
      expect.objectContaining({
        message: "ERR_NO_PERMISSION",
        statusCode: 403
      })
    );
  });

  it("denies a token whose user no longer exists", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue(null);

    await expect(EnsureTicketDeletionPermissionService(3)).rejects.toEqual(
      expect.objectContaining({ statusCode: 403 })
    );
  });
});
