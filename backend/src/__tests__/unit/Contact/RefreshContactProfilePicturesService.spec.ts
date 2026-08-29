import Contact from "../../../models/Contact";
import Ticket from "../../../models/Ticket";
import GetDefaultWhatsApp from "../../../helpers/GetDefaultWhatsApp";
import { getIO } from "../../../libs/socket";
import { whatsappProvider } from "../../../providers/WhatsApp";
import {
  readState,
  writeState
} from "../../../services/MessagingServices/state";
import RefreshContactProfilePicturesService from "../../../services/ContactServices/RefreshContactProfilePicturesService";

jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));
jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock("../../../helpers/GetDefaultWhatsApp", () => jest.fn());
jest.mock("../../../libs/socket", () => ({ getIO: jest.fn() }));
jest.mock("../../../providers/WhatsApp", () => ({
  whatsappProvider: { getProfilePicUrl: jest.fn() }
}));
jest.mock("../../../services/MessagingServices/state", () => ({
  withLease: (_: string, action: () => unknown) => action(),
  readState: jest.fn(),
  writeState: jest.fn()
}));

const emit = jest.fn();
const update = jest.fn();
const contact = (profilePicUrl = "") => ({
  id: 7,
  number: "5585999990000",
  profilePicUrl,
  isInternal: false,
  update
});

beforeEach(() => {
  jest.resetAllMocks();
  (getIO as jest.Mock).mockReturnValue({ emit });
  (Ticket.findOne as jest.Mock).mockResolvedValue({ whatsappId: 2 });
  (GetDefaultWhatsApp as jest.Mock).mockResolvedValue({ id: 1 });
  (readState as jest.Mock).mockResolvedValue({});
  (writeState as jest.Mock).mockResolvedValue(undefined);
  update.mockResolvedValue(undefined);
});

it("refreshes a missing picture through the ticket WhatsApp session", async () => {
  (Contact.findAll as jest.Mock).mockResolvedValue([contact()]);
  (whatsappProvider.getProfilePicUrl as jest.Mock).mockResolvedValue(
    "https://pictures.test/contact-7"
  );

  await expect(
    RefreshContactProfilePicturesService({
      contacts: [{ id: 7 }],
      userId: 4
    })
  ).resolves.toEqual([
    {
      id: 7,
      profilePicUrl: "https://pictures.test/contact-7",
      refreshed: true
    }
  ]);
  expect(whatsappProvider.getProfilePicUrl).toHaveBeenCalledWith(
    2,
    "5585999990000"
  );
  expect(update).toHaveBeenCalledWith({
    profilePicUrl: "https://pictures.test/contact-7"
  });
  expect(emit).toHaveBeenCalledWith(
    "contact",
    expect.objectContaining({ action: "update" })
  );
});

it("keeps a valid picture without querying the provider", async () => {
  (Contact.findAll as jest.Mock).mockResolvedValue([
    contact("https://pictures.test/current")
  ]);

  await RefreshContactProfilePicturesService({
    contacts: [{ id: 7 }],
    userId: 4
  });

  expect(whatsappProvider.getProfilePicUrl).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});

it("respects the cooldown after WhatsApp exposes no picture", async () => {
  (Contact.findAll as jest.Mock).mockResolvedValue([contact()]);
  (readState as jest.Mock).mockResolvedValue({
    checkedAt: new Date().toISOString(),
    sourceUrl: "",
    found: false
  });

  await RefreshContactProfilePicturesService({
    contacts: [{ id: 7 }],
    userId: 4
  });

  expect(whatsappProvider.getProfilePicUrl).not.toHaveBeenCalled();
  expect(writeState).not.toHaveBeenCalled();
});
