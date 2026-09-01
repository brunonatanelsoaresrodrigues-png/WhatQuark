import User from "../../../models/User";
import ListTicketAssigneesService from "../../../services/UserServices/ListTicketAssigneesService";

jest.mock("../../../models/User", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn(),
    findAll: jest.fn()
  }
}));

describe("ListTicketAssigneesService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns all users with only id and name for an authorized requester", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 1,
      profile: "admin",
      canViewOtherAgentsTickets: true
    });
    (User.findAll as jest.Mock).mockResolvedValue([
      { id: 2, name: "Ana" },
      { id: 3, name: "Bruno" }
    ]);

    await expect(ListTicketAssigneesService(1)).resolves.toEqual([
      { id: 2, name: "Ana" },
      { id: 3, name: "Bruno" }
    ]);
    expect(User.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: undefined,
        attributes: ["id", "name"]
      })
    );
  });

  it("limits a regular requester without permission to themselves", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      id: 7,
      profile: "user",
      canViewOtherAgentsTickets: false
    });
    (User.findAll as jest.Mock).mockResolvedValue([{ id: 7, name: "Carlos" }]);

    await ListTicketAssigneesService(7);

    expect(User.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 7 } })
    );
  });
});
