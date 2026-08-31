import Contact from "../../models/Contact";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";

const DeleteContactService = async (id: string): Promise<void> => {
  const contact = await Contact.findOne({
    where: { id }
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  const [ticketCount, messageCount] = await Promise.all([
    Ticket.count({ where: { contactId: contact.id } }),
    Message.count({ where: { contactId: contact.id } })
  ]);
  if (ticketCount > 0 || messageCount > 0) {
    throw new AppError("ERR_CONTACT_HAS_HISTORY", 409);
  }

  await contact.destroy();
};

export default DeleteContactService;
