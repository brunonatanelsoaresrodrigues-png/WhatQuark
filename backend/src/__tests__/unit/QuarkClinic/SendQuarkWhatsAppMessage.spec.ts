import Whatsapp from "../../../models/Whatsapp";
import { whatsappProvider } from "../../../providers/WhatsApp";
import CreateOrUpdateContactService from "../../../services/ContactServices/CreateOrUpdateContactService";
import { assertExecution } from "../../../services/MessagingServices/policy";
import SendQuarkWhatsAppMessage from "../../../services/QuarkClinicServices/SendQuarkWhatsAppMessage";
import FindNotificationTicket from "../../../services/TicketServices/FindNotificationTicket";
import SendWhatsAppMessage from "../../../services/WbotServices/SendWhatsAppMessage";
import { QuarkConfig } from "../../../services/QuarkClinicServices/config";

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));
jest.mock("../../../providers/WhatsApp", () => ({
  whatsappProvider: { checkNumber: jest.fn() }
}));
jest.mock(
  "../../../services/ContactServices/CreateOrUpdateContactService",
  () => ({ __esModule: true, default: jest.fn() })
);
jest.mock("../../../services/TicketServices/FindNotificationTicket", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../../services/WbotServices/SendWhatsAppMessage", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../../services/MessagingServices/policy", () => ({
  assertExecution: jest.fn()
}));

describe("SendQuarkWhatsAppMessage Brazilian phone variants", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (assertExecution as jest.Mock).mockResolvedValue(undefined);
    (Whatsapp.findByPk as jest.Mock).mockResolvedValue({
      id: 1,
      status: "CONNECTED"
    });
    (CreateOrUpdateContactService as jest.Mock).mockResolvedValue({ id: 9 });
    (FindNotificationTicket as jest.Mock).mockResolvedValue({ id: 10 });
    (SendWhatsAppMessage as jest.Mock).mockResolvedValue({ id: "message-1" });
  });

  it("tries the deterministic legacy mobile variant before giving up", async () => {
    (whatsappProvider.checkNumber as jest.Mock)
      .mockRejectedValueOnce(new Error("ERR_NUMBER_NOT_ON_WHATSAPP"))
      .mockResolvedValueOnce("558598883221@s.whatsapp.net");

    await expect(
      SendQuarkWhatsAppMessage(
        {
          whatsappId: 1,
          defaultCountryCode: "55"
        } as unknown as QuarkConfig,
        "5585998883221",
        "Paciente",
        "Aviso",
        { appointmentId: "42", allowAppointmentPhoneVariants: true }
      )
    ).resolves.toEqual({ messageId: "message-1", ticketId: 10 });

    expect(whatsappProvider.checkNumber).toHaveBeenNthCalledWith(
      1,
      1,
      "5585998883221"
    );
    expect(whatsappProvider.checkNumber).toHaveBeenNthCalledWith(
      2,
      1,
      "558598883221"
    );
    expect(CreateOrUpdateContactService).toHaveBeenCalledWith(
      expect.objectContaining({ number: "558598883221" })
    );
  });
});
