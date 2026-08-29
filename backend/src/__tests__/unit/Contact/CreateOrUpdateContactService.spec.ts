import Contact from "../../../models/Contact";
import Ticket from "../../../models/Ticket";
import { getIO } from "../../../libs/socket";
import CreateOrUpdateContactService from "../../../services/ContactServices/CreateOrUpdateContactService";

jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), create: jest.fn() }
}));
jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { update: jest.fn() }
}));
jest.mock("../../../libs/socket", () => ({ getIO: jest.fn() }));

const update = jest.fn();
const existing = {
  id: 3,
  name: "Paciente",
  number: "5585999990000",
  lid: null,
  profilePicUrl: "https://pictures.test/current",
  isInternal: false,
  update
};

beforeEach(() => {
  jest.resetAllMocks();
  (getIO as jest.Mock).mockReturnValue({ emit: jest.fn() });
  update.mockResolvedValue(undefined);
  (Contact.findOne as jest.Mock)
    .mockResolvedValueOnce(existing)
    .mockResolvedValueOnce(null);
});

it("preserves the stored picture when a provider lookup is inconclusive", async () => {
  await CreateOrUpdateContactService({
    name: "Paciente",
    number: existing.number,
    profilePicUrl: undefined,
    isGroup: false
  });

  expect(update).toHaveBeenCalledWith({
    lid: null,
    isInternal: false
  });
});

it("replaces the picture when the provider returns a fresh URL", async () => {
  await CreateOrUpdateContactService({
    name: "Paciente",
    number: existing.number,
    profilePicUrl: "https://pictures.test/fresh",
    isGroup: false
  });

  expect(update).toHaveBeenCalledWith({
    lid: null,
    profilePicUrl: "https://pictures.test/fresh",
    isInternal: false
  });
  expect(Ticket.update).not.toHaveBeenCalled();
});
