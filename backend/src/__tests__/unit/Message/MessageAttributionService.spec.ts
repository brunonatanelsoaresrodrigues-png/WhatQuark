import Message from "../../../models/Message";
import MessageAttribution from "../../../models/MessageAttribution";
import {
  registerMessageAttribution,
  resolveMessageAttribution
} from "../../../services/MessageServices/MessageAttributionService";

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { update: jest.fn() }
}));
jest.mock("../../../models/MessageAttribution", () => ({
  __esModule: true,
  default: { upsert: jest.fn(), findByPk: jest.fn() }
}));

describe("MessageAttributionService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("persists human authorship by provider message id", async () => {
    await registerMessageAttribution("message-1", {
      sentByUserId: 7,
      origin: "HUMAN"
    });

    expect(MessageAttribution.upsert).toHaveBeenCalledWith({
      messageId: "message-1",
      sentByUserId: 7,
      origin: "HUMAN"
    });
    expect(Message.update).toHaveBeenCalledWith(
      { sentByUserId: 7, origin: "HUMAN" },
      { where: { id: "message-1" } }
    );
  });

  it("classifies every incoming message as patient activity", async () => {
    await expect(resolveMessageAttribution("incoming", false)).resolves.toEqual(
      {
        sentByUserId: null,
        origin: "PATIENT"
      }
    );
  });

  it("uses persisted automation origin for outgoing echoes", async () => {
    (MessageAttribution.findByPk as jest.Mock).mockResolvedValue({
      sentByUserId: null,
      origin: "QUARK"
    });
    await expect(resolveMessageAttribution("outgoing", true)).resolves.toEqual({
      sentByUserId: null,
      origin: "QUARK"
    });
  });
});
