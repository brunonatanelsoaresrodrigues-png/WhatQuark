import { whatsappProvider } from "../../../providers/WhatsApp";
import { getIO } from "../../../libs/socket";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";

jest.mock("../../../providers/WhatsApp", () => ({
  whatsappProvider: { init: jest.fn() }
}));
jest.mock("../../../libs/socket", () => ({ getIO: jest.fn() }));

afterEach(() => {
  delete process.env.WHATSAPP_CONNECTIONS_ENABLED;
  delete process.env.WHATSAPP_AUTO_START;
  jest.resetAllMocks();
});

it("does not start or mutate a WhatsApp session while connections are paused", async () => {
  process.env.WHATSAPP_CONNECTIONS_ENABLED = "false";
  const whatsapp = { update: jest.fn() } as any;

  await expect(StartWhatsAppSession(whatsapp)).rejects.toThrow(
    "ERR_WHATSAPP_CONNECTIONS_PAUSED"
  );
  expect(whatsapp.update).not.toHaveBeenCalled();
  expect(whatsappProvider.init).not.toHaveBeenCalled();
  expect(getIO).not.toHaveBeenCalled();
});

it("starts normally when connections are enabled", async () => {
  process.env.WHATSAPP_CONNECTIONS_ENABLED = "true";
  process.env.WHATSAPP_AUTO_START = "false";
  const emit = jest.fn();
  (getIO as jest.Mock).mockReturnValue({
    to: jest.fn(() => ({ emit }))
  });
  const whatsapp = { update: jest.fn() } as any;

  await StartWhatsAppSession(whatsapp);

  expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
  expect(whatsappProvider.init).toHaveBeenCalledWith(whatsapp);
});
