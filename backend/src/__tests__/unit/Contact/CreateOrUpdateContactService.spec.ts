import Contact from "../../../models/Contact";
import Ticket from "../../../models/Ticket";
import Message from "../../../models/Message";
import ContactCustomField from "../../../models/ContactCustomField";
import { getIO } from "../../../libs/socket";
import CreateOrUpdateContactService from "../../../services/ContactServices/CreateOrUpdateContactService";

jest.mock("../../../database", () => ({
  __esModule: true,
  default: { transaction: jest.fn((action: any) => action({})) }
}));
jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { update: jest.fn() }
}));
jest.mock("../../../models/ContactCustomField", () => ({
  __esModule: true,
  default: { update: jest.fn() }
}));

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
  jest.clearAllMocks();
  (Contact.findOne as jest.Mock).mockReset();
  (getIO as jest.Mock).mockReturnValue({ emit: jest.fn() });
  update.mockReset().mockResolvedValue(undefined);
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

  expect(update.mock.calls[0][0]).toEqual({
    name: "Paciente",
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

  expect(update.mock.calls[0][0]).toEqual({
    name: "Paciente",
    lid: null,
    profilePicUrl: "https://pictures.test/fresh",
    isInternal: false
  });
  expect(Ticket.update).not.toHaveBeenCalled();
});

it("replaces a technical LID name with the real phone fallback", async () => {
  const technical = {
    ...existing,
    name: "214533650018337",
    lid: "214533650018337@lid"
  };
  (Contact.findOne as jest.Mock).mockReset();
  (Contact.findOne as jest.Mock)
    .mockResolvedValueOnce(technical)
    .mockResolvedValueOnce(technical);

  await CreateOrUpdateContactService({
    name: technical.name,
    number: technical.number,
    lid: technical.lid,
    isGroup: false
  });

  expect(update.mock.calls[0][0]).toEqual(
    expect.objectContaining({ name: technical.number })
  );
});

it("preserves a real name instead of overwriting it with provider metadata", async () => {
  await CreateOrUpdateContactService({
    name: "Outro nome",
    number: existing.number,
    isGroup: false
  });

  expect(update.mock.calls[0][0]).toEqual(
    expect.objectContaining({ name: "Paciente" })
  );
});

it("moves all history and patient data before deleting a duplicate LID contact", async () => {
  const primaryUpdate = jest.fn().mockResolvedValue(undefined);
  const duplicateDestroy = jest.fn().mockResolvedValue(undefined);
  const primary: any = {
    id: 10,
    name: "Paciente",
    number: "5585999990000",
    lid: null,
    email: "",
    cpf: null,
    profilePicUrl: "",
    isInternal: false,
    update: primaryUpdate
  };
  const duplicate: any = {
    id: 11,
    name: "Contato WhatsApp",
    number: "214533650018337",
    lid: "214533650018337@lid",
    email: "paciente@example.test",
    cpf: "12345678901",
    profilePicUrl: "https://pictures.test/lid",
    isInternal: false,
    destroy: duplicateDestroy
  };
  (Contact.findOne as jest.Mock).mockReset();
  (Contact.findOne as jest.Mock)
    .mockResolvedValueOnce(primary)
    .mockResolvedValueOnce(duplicate);

  await CreateOrUpdateContactService({
    name: "Paciente",
    number: primary.number,
    lid: duplicate.lid,
    isGroup: false
  });

  expect(Ticket.update).toHaveBeenCalledWith(
    { contactId: primary.id },
    expect.objectContaining({ where: { contactId: duplicate.id } })
  );
  expect(Message.update).toHaveBeenCalledWith(
    { contactId: primary.id },
    expect.objectContaining({ where: { contactId: duplicate.id } })
  );
  expect(ContactCustomField.update).toHaveBeenCalledWith(
    { contactId: primary.id },
    expect.objectContaining({ where: { contactId: duplicate.id } })
  );
  expect(primaryUpdate.mock.calls[0][0]).toEqual(
    expect.objectContaining({
      lid: duplicate.lid,
      email: duplicate.email,
      cpf: duplicate.cpf
    })
  );
  expect(duplicateDestroy).toHaveBeenCalled();
});
