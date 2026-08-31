import Ticket from "../../../models/Ticket";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";

jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));

describe("ShowTicketService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("loads the contact CPF and email for the ticket details drawer", async () => {
    const ticket = { id: 10 };
    (Ticket.findByPk as jest.Mock).mockResolvedValue(ticket);

    await expect(ShowTicketService("10")).resolves.toBe(ticket);

    const options = (Ticket.findByPk as jest.Mock).mock.calls[0][1];
    const contactInclude = options.include.find(
      (item: { as?: string }) => item.as === "contact"
    );
    expect(contactInclude.attributes).toEqual(
      expect.arrayContaining(["email", "cpf"])
    );
  });
});
