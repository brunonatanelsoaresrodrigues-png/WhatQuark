import ListWhatsAppsService from "../../../services/WhatsappService/ListWhatsAppsService";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartAllWhatsAppsSessions } from "../../../services/WbotServices/StartAllWhatsAppsSessions";

jest.mock("../../../services/WhatsappService/ListWhatsAppsService", () =>
  jest.fn()
);
jest.mock("../../../services/WbotServices/StartWhatsAppSession", () => ({
  StartWhatsAppSession: jest.fn()
}));

afterEach(() => {
  delete process.env.WHATSAPP_CONNECTIONS_ENABLED;
  delete process.env.WHATSAPP_AUTO_START;
  delete process.env.WHATSAPP_PROVIDER;
  delete process.env.CLOUD_WHATSAPP_ID;
  jest.resetAllMocks();
});

it.each(["WHATSAPP_CONNECTIONS_ENABLED", "WHATSAPP_AUTO_START"])(
  "does not load or start sessions when %s is false",
  async setting => {
    process.env[setting] = "false";
    await StartAllWhatsAppsSessions();
    expect(ListWhatsAppsService).not.toHaveBeenCalled();
    expect(StartWhatsAppSession).not.toHaveBeenCalled();
  }
);

it("preserves automatic startup by default", async () => {
  const whatsapp = { id: 1 };
  (ListWhatsAppsService as jest.Mock).mockResolvedValue([whatsapp]);
  await StartAllWhatsAppsSessions();
  expect(StartWhatsAppSession).toHaveBeenCalledWith(whatsapp);
});

it("only starts the configured cloud channel", async () => {
  process.env.WHATSAPP_PROVIDER = "cloud";
  process.env.CLOUD_WHATSAPP_ID = "2";
  (ListWhatsAppsService as jest.Mock).mockResolvedValue([{ id: 1 }, { id: 2 }]);
  await StartAllWhatsAppsSessions();
  expect(StartWhatsAppSession).toHaveBeenCalledTimes(1);
  expect(StartWhatsAppSession).toHaveBeenCalledWith({ id: 2 });
});
