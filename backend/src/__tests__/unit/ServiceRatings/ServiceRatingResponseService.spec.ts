jest.mock("../../../database", () => ({
  transaction: jest.fn()
}));
jest.mock("../../../models/ServiceRating", () => ({
  findOne: jest.fn(),
  findByPk: jest.fn(),
  update: jest.fn()
}));
jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn()
}));
jest.mock(
  "../../../services/TicketServices/ShowTicketService",
  () => jest.fn()
);
jest.mock(
  "../../../services/WbotServices/SendWhatsAppMessage",
  () => jest.fn()
);
jest.mock("../../../services/MessagingServices/state", () => ({
  withLease: jest.fn((_key, work) => work())
}));
jest.mock("../../../services/ServiceRatingServices/config", () => ({
  getServiceRatingConfig: jest.fn()
}));

import { ratingScoreFrom } from "../../../services/ServiceRatingServices/ServiceRatingResponseService";

describe("service rating response", () => {
  it.each([
    ["0", 0],
    [" 3 ", 3],
    ["5", 5]
  ])("accepts an isolated score %s", (body, score) => {
    expect(ratingScoreFrom(body)).toBe(score);
  });

  it.each(["", "6", "-1", "nota 5", "5 estrelas", "55", "4.5"])(
    "does not treat a support message as a score: %s",
    body => {
      expect(ratingScoreFrom(body)).toBeNull();
    }
  );
});
