const showTicket = jest.fn();
const findRating = jest.fn();
const createRating = jest.fn();
const findUser = jest.fn();
const sendMessage = jest.fn();

jest.mock("../../../models/ServiceRating", () => ({
  findOne: (...args: any[]) => findRating(...args),
  create: (...args: any[]) => createRating(...args)
}));
jest.mock("../../../models/User", () => ({
  findByPk: (...args: any[]) => findUser(...args)
}));
jest.mock("../../../libs/socket", () => ({
  getIO: () => ({ to: () => ({ emit: jest.fn() }) })
}));
jest.mock(
  "../../../services/TicketServices/ShowTicketService",
  () => (...args: any[]) => showTicket(...args)
);
jest.mock(
  "../../../services/WbotServices/SendWhatsAppMessage",
  () => (...args: any[]) => sendMessage(...args)
);
jest.mock("../../../services/MessagingServices/state", () => ({
  withLease: (_key: string, work: () => unknown) => work()
}));
jest.mock("../../../services/ServiceRatingServices/config", () => ({
  getServiceRatingConfig: () =>
    Promise.resolve({
      enabled: true,
      expiryHours: 48,
      cooldownHours: 12,
      message: "Avalie de 0 a 5",
      thankYouMessage: "Obrigado"
    })
}));

import RequestServiceRatingService from "../../../services/ServiceRatingServices/RequestServiceRatingService";

describe("service rating request", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findRating.mockResolvedValue(null);
  });

  it("does not create a survey for a group", async () => {
    showTicket.mockResolvedValue({
      id: 10,
      userId: 2,
      ticketType: "PATIENT",
      isGroup: true,
      contactId: 3,
      whatsappId: 1
    });

    await expect(
      RequestServiceRatingService({
        ticket: 10,
        trigger: "MANUAL_RESOLUTION"
      })
    ).resolves.toBeNull();
    expect(createRating).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("creates one survey with the attendant snapshot", async () => {
    showTicket.mockResolvedValue({
      id: 11,
      userId: 2,
      ticketType: "PATIENT",
      isGroup: false,
      contactId: 3,
      whatsappId: 1,
      queueId: 4,
      queue: { name: "Recepção" }
    });
    findUser.mockResolvedValue({ id: 2, name: "Ana" });
    const update = jest.fn().mockResolvedValue(undefined);
    createRating.mockResolvedValue({
      id: 5,
      expiresAt: new Date(Date.now() + 3600000),
      update
    });
    sendMessage.mockResolvedValue({ id: "message-1" });

    await RequestServiceRatingService({
      ticket: 11,
      trigger: "MANUAL_RESOLUTION"
    });

    expect(createRating).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 11,
        ratedUserId: 2,
        ratedUserName: "Ana",
        queueName: "Recepção"
      })
    );
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      status: "SENT",
      requestMessageId: "message-1"
    });
  });
});
