import { getIO } from "../../../libs/socket";
import Message from "../../../models/Message";
import CreateMessageService from "../../../services/MessageServices/CreateMessageService";
import { resolveMessageAttribution } from "../../../services/MessageServices/MessageAttributionService";

jest.mock("../../../libs/socket", () => ({ getIO: jest.fn() }));
jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { findByPk: jest.fn(), upsert: jest.fn() }
}));
jest.mock(
  "../../../services/MessageServices/MessageAttributionService",
  () => ({
    resolveMessageAttribution: jest.fn()
  })
);

const storedMessage = {
  id: "incoming-message",
  ticketId: 42,
  ticket: { status: "open", contact: {} }
};

const configureSocket = (): void => {
  const emitter = {
    to: jest.fn(),
    emit: jest.fn()
  };
  emitter.to.mockReturnValue(emitter);
  (getIO as jest.Mock).mockReturnValue(emitter);
};

describe("CreateMessageService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configureSocket();
    (resolveMessageAttribution as jest.Mock).mockResolvedValue({
      sentByUserId: null,
      origin: "PATIENT"
    });
  });

  it("stores the message without a quote when the quoted message is absent", async () => {
    (Message.findByPk as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(storedMessage);

    await CreateMessageService({
      messageData: {
        id: "incoming-message",
        ticketId: 42,
        body: "Resposta importante",
        quotedMsgId: "missing-quoted-message"
      }
    });

    expect(Message.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "incoming-message",
        quotedMsgId: null
      })
    );
  });

  it("keeps the quote when the quoted message exists", async () => {
    (Message.findByPk as jest.Mock)
      .mockResolvedValueOnce({ id: "existing-quoted-message" })
      .mockResolvedValueOnce(storedMessage);

    await CreateMessageService({
      messageData: {
        id: "incoming-message",
        ticketId: 42,
        body: "Resposta importante",
        quotedMsgId: "existing-quoted-message"
      }
    });

    expect(Message.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ quotedMsgId: "existing-quoted-message" })
    );
  });

  it("does not broadcast messages imported by history synchronization", async () => {
    (Message.findByPk as jest.Mock).mockResolvedValue(storedMessage);

    await CreateMessageService({
      messageData: {
        id: "incoming-message",
        ticketId: 42,
        body: "Mensagem histórica",
        origin: "PATIENT"
      },
      emitEvent: false
    });

    expect(getIO).not.toHaveBeenCalled();
  });
});
