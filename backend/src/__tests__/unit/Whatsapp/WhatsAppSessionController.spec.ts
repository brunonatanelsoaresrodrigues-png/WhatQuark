import controller from "../../../controllers/WhatsAppSessionController";
import UpdateWhatsAppService from "../../../services/WhatsappService/UpdateWhatsAppService";
import ShowWhatsAppService from "../../../services/WhatsappService/ShowWhatsAppService";
import { whatsappProvider } from "../../../providers/WhatsApp";
import { getIO } from "../../../libs/socket";

jest.mock("../../../services/WhatsappService/UpdateWhatsAppService", () =>
  jest.fn()
);
jest.mock("../../../services/WhatsappService/ShowWhatsAppService", () =>
  jest.fn()
);
jest.mock("../../../providers/WhatsApp", () => ({
  whatsappProvider: { init: jest.fn(), logout: jest.fn() }
}));
jest.mock("../../../libs/socket", () => ({ getIO: jest.fn() }));

afterEach(() => {
  delete process.env.WHATSAPP_CONNECTIONS_ENABLED;
  delete process.env.WHATSAPP_AUTO_START;
  jest.resetAllMocks();
});

it("does not clear saved credentials when a new QR is requested while paused", async () => {
  process.env.WHATSAPP_CONNECTIONS_ENABLED = "false";
  await expect(
    controller.update({ params: { whatsappId: "1" } } as any, {} as any)
  ).rejects.toThrow("ERR_WHATSAPP_CONNECTIONS_PAUSED");
  expect(UpdateWhatsAppService).not.toHaveBeenCalled();
  expect(whatsappProvider.init).not.toHaveBeenCalled();
});

it("allows manual connection without clearing credentials when autostart is disabled", async () => {
  process.env.WHATSAPP_CONNECTIONS_ENABLED = "true";
  process.env.WHATSAPP_AUTO_START = "false";
  const whatsapp = { id: 1, session: "saved-session", update: jest.fn() };
  (ShowWhatsAppService as jest.Mock).mockResolvedValue(whatsapp);
  (getIO as jest.Mock).mockReturnValue({
    to: jest.fn(() => ({ emit: jest.fn() }))
  });
  const response = { status: jest.fn(), json: jest.fn() };
  response.status.mockReturnValue(response);
  await controller.store(
    { params: { whatsappId: "1" } } as any,
    response as any
  );
  expect(UpdateWhatsAppService).not.toHaveBeenCalled();
  expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
  expect(whatsappProvider.init).toHaveBeenCalledWith(whatsapp);
  expect(response.status).toHaveBeenCalledWith(200);
});
