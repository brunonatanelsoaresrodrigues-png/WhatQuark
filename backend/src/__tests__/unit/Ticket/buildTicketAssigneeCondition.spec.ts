import { Op } from "sequelize";
import { buildTicketAssigneeCondition } from "../../../services/TicketServices/ListTicketsService";

describe("buildTicketAssigneeCondition", () => {
  it("does not add an assignee restriction in all mode", () => {
    expect(buildTicketAssigneeCondition({ mode: "all" }, 1)).toBeUndefined();
  });

  it("builds filters for one user and for unassigned tickets", () => {
    expect(
      buildTicketAssigneeCondition({ mode: "user", userId: 9 }, 1)
    ).toEqual({ userId: 9 });
    expect(
      buildTicketAssigneeCondition({ mode: "unassigned" }, 1)
    ).toEqual({ userId: null });
  });

  it("preserves the legacy default scope of own or pending tickets", () => {
    expect(buildTicketAssigneeCondition({ mode: "default" }, 5)).toEqual({
      [Op.or]: [{ userId: 5 }, { status: "pending" }]
    });
  });
});
