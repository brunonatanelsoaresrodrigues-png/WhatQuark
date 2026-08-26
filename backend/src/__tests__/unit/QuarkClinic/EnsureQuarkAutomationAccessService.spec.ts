import AppError from "../../../errors/AppError";
import User from "../../../models/User";
import EnsureQuarkAutomationAccessService from "../../../services/QuarkClinicServices/EnsureQuarkAutomationAccessService";

jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

describe("EnsureQuarkAutomationAccessService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("allows administrators without querying the permission flag", async () => {
    await expect(
      EnsureQuarkAutomationAccessService({ userId: 1, profile: "admin" })
    ).resolves.toBeUndefined();
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it("allows a regular user granted Quark Clinic access", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      canAccessQuarkClinic: true
    });

    await expect(
      EnsureQuarkAutomationAccessService({ userId: 2, profile: "user" })
    ).resolves.toBeUndefined();
  });

  it("denies a regular user without the permission", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      canAccessQuarkClinic: false
    });

    await expect(
      EnsureQuarkAutomationAccessService({ userId: 3, profile: "user" })
    ).rejects.toEqual(expect.any(AppError));
  });
});
