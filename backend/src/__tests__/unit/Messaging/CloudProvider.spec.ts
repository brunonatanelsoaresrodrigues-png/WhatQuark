import axios from "axios";
import { CloudWhatsAppProvider } from "../../../providers/WhatsApp/Implementations/cloud";
jest.mock("axios", () => ({ __esModule: true, default: jest.fn() }));
const env = { ...process.env };
beforeEach(() => {
  jest.resetAllMocks();
  process.env.CLOUD_WHATSAPP_ID = "1";
  process.env.CLOUD_PHONE_NUMBER_ID = "12345";
  process.env.CLOUD_API_VERSION = "v99.0";
  process.env.CLOUD_ACCESS_TOKEN = "fixture-only-token";
  (axios as unknown as jest.Mock).mockResolvedValue({
    data: { messages: [{ id: "wamid.fixture" }] }
  });
});
afterAll(() => {
  process.env = env;
});
it("uses the configured Graph version and correlated message id without retry", async () => {
  const result = await CloudWhatsAppProvider.sendMessage(
    1,
    "5511999990000@c.us",
    "Teste",
    { policy: { outboundId: "outbound-1" } }
  );
  expect(result.id).toBe("wamid.fixture");
  expect(axios).toHaveBeenCalledWith(
    expect.objectContaining({
      url: "https://graph.facebook.com/v99.0/12345/messages",
      timeout: 30000,
      maxRedirects: 0,
      data: expect.objectContaining({
        messaging_product: "whatsapp",
        to: "5511999990000",
        type: "text",
        biz_opaque_callback_data: "outbound-1"
      })
    })
  );
});
it("serializes only the explicitly configured approved template", async () => {
  await CloudWhatsAppProvider.sendMessage(1, "5511999990000", "Text", {
    policy: {
      template: {
        name: "appointment_fixture",
        language: "pt_BR",
        parameters: ["10/09/2026", "10:00", "Clínica", "AB12CD34"]
      }
    }
  });
  const request = (axios as unknown as jest.Mock).mock.calls[0][0];
  expect(request.data.type).toBe("template");
  expect(request.data.template.name).toBe("appointment_fixture");
  expect(request.data.template.components[0].parameters).toHaveLength(4);
});
it("does not leak credentials or auto-retry a transport exception", async () => {
  (axios as unknown as jest.Mock).mockRejectedValue({
    config: { headers: { Authorization: "secret" } }
  });
  await expect(
    CloudWhatsAppProvider.sendMessage(1, "5511999990000", "Test")
  ).rejects.toThrow("ERR_CLOUD_REQUEST_FAILED");
  expect(axios).toHaveBeenCalledTimes(1);
});
it("rejects the wrong channel and unsupported operations", async () => {
  await expect(
    CloudWhatsAppProvider.sendMessage(2, "5511999990000", "Test")
  ).rejects.toThrow("ERR_CLOUD_CHANNEL_MISMATCH");
  await expect(CloudWhatsAppProvider.getContacts(1)).rejects.toThrow(
    "ERR_CLOUD_FEATURE_UNSUPPORTED"
  );
  expect(axios).not.toHaveBeenCalled();
});
