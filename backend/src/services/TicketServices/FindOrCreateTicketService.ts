import { subHours } from "date-fns";
import { Op } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import TicketInactivityEvent from "../../models/TicketInactivityEvent";
import User from "../../models/User";
import UserQueue from "../../models/UserQueue";
import { emitTicketInactivityUpdate } from "../TicketInactivityServices/ticketEvents";
import ShowTicketService from "./ShowTicketService";
import RecordTicketEventService from "./RecordTicketEventService";
import { withLease, writeState } from "../MessagingServices/state";

const reusablePreviousUserId = async (
  ticket: Ticket
): Promise<number | null> => {
  const previousUserId = ticket.inactivityPreviousUserId || ticket.userId;
  if (!previousUserId) return null;

  const user = await User.findByPk(previousUserId);
  if (!user) return null;
  if (!ticket.queueId) return user.id;

  const belongsToQueue = await UserQueue.count({
    where: { userId: user.id, queueId: ticket.queueId }
  });
  return belongsToQueue > 0 ? user.id : null;
};

const FindOrCreateTicketService = async (
  contact: Contact,
  whatsappId: number,
  unreadMessages: number,
  groupContact?: Contact,
  requestedTicketType?: "PATIENT" | "INTERNAL_REPORT",
  reactivateIntake = false
): Promise<Ticket> => {
  const incomingUnread = (current = 0): number =>
    reactivateIntake
      ? Math.max(Number(current || 0) + 1, Number(unreadMessages || 0), 1)
      : Number(unreadMessages || 0);
  const ticketType =
    requestedTicketType || (contact.isInternal ? "INTERNAL_REPORT" : "PATIENT");
  const ticketContactId = groupContact ? groupContact.id : contact.id;
  return withLease(
    `attendance-ticket:${whatsappId}:${ticketContactId}:${ticketType}`,
    async () => {
  let ticket = await Ticket.findOne({
    where: {
      status: {
        [Op.or]: ["open", "pending"]
      },
      contactId: groupContact ? groupContact.id : contact.id,
      whatsappId: whatsappId,
      ticketType
    }
  });

  if (ticket) {
    await ticket.update({ unreadMessages: incomingUnread(ticket.unreadMessages) });
  }

  let reopenedAfterInactivity = false;
  if (!ticket && !groupContact) {
    ticket = await Ticket.findOne({
      where: {
        status: "closed",
        closedByInactivity: true,
        contactId: contact.id,
        whatsappId,
        ticketType
      },
      order: [["updatedAt", "DESC"]]
    });

    if (ticket) {
      const recordedPreviousUserId =
        ticket.inactivityPreviousUserId || ticket.userId || null;
      const previousUserId = await reusablePreviousUserId(ticket);
      await ticket.update({
        status: previousUserId ? "open" : "pending",
        userId: previousUserId,
        unreadMessages: incomingUnread(),
        awaitingPatientSince: null,
        inactivityClosingAt: null,
        inactivityNoticeSentAt: null,
        inactivityNoticeMessageId: null,
        closedByInactivity: false,
        inactivityPreviousUserId: null
      });
      await TicketInactivityEvent.create({
        ticketId: ticket.id,
        eventType: "REOPENED",
        reason: previousUserId
          ? "Paciente retornou; conversa devolvida ao atendente anterior"
          : "Paciente retornou; conversa devolvida à fila",
        userId: previousUserId,
        messageId: null,
        occurredAt: new Date()
      });
      await RecordTicketEventService({
        ticketId: ticket.id,
        eventType: "REOPENED",
        performedByUserId: null,
        previousUserId: recordedPreviousUserId,
        newUserId: previousUserId,
        newQueueId: ticket.queueId || null,
        metadata: { source: "PATIENT_MESSAGE", afterInactivity: true }
      });
      reopenedAfterInactivity = true;
    }
  }

  if (!ticket && groupContact) {
    ticket = await Ticket.findOne({
      where: {
        contactId: groupContact.id,
        whatsappId: whatsappId,
        ticketType
      },
      order: [["updatedAt", "DESC"]]
    });

    if (ticket) {
      await ticket.update({
        status: "pending",
        userId: null,
        unreadMessages: incomingUnread()
      });
    }
  }

  if (!ticket && !groupContact) {
    ticket = await Ticket.findOne({
      where: {
        updatedAt: {
          [Op.between]: [+subHours(new Date(), 2), +new Date()]
        },
        contactId: contact.id,
        whatsappId: whatsappId,
        ticketType
      },
      order: [["updatedAt", "DESC"]]
    });

    if (ticket) {
      const previousQueueId = ticket.queueId || null;
      await ticket.update({
        status: "pending",
        userId: null,
        queueId: reactivateIntake ? null : ticket.queueId,
        unreadMessages: incomingUnread(),
        ...(reactivateIntake
          ? {
              intakeStatus: null,
              intakeReason: null,
              intakeStartedAt: null,
              intakeCompletedAt: null,
              intakePausedAt: null,
              intakeContext: null,
              intakeContextExpiresAt: null
            }
          : {})
      });
      if (reactivateIntake) {
        await Promise.all([
          writeState(`bot-pause:${ticket.id}`, false),
          writeState(`bot-review:${ticket.id}`, null),
          writeState(`menu:${ticket.id}`, { shown: false, attempts: 0 }),
          writeState(`intake-attempts:${ticket.id}`, {
            status: null,
            count: 0
          })
        ]);
        await RecordTicketEventService({
          ticketId: ticket.id,
          eventType: "INTAKE_RESTARTED",
          previousQueueId,
          newQueueId: null,
          metadata: { source: "PATIENT_MESSAGE", afterManualResolution: true }
        });
      }
    }
  }

  if (!ticket) {
    ticket = await Ticket.create({
      contactId: groupContact ? groupContact.id : contact.id,
      status: "pending",
      isGroup: !!groupContact,
      unreadMessages: incomingUnread(),
      whatsappId,
      ticketType
    });
    await RecordTicketEventService({
      ticketId: ticket.id,
      eventType: "CREATED",
      newQueueId: ticket.queueId || null,
      metadata: {
        source: ticketType === "INTERNAL_REPORT" ? "DAILY_REPORT" : "WHATSAPP",
        status: "pending"
      }
    });
  }

  ticket = await ShowTicketService(ticket.id);

  if (reopenedAfterInactivity) {
    await emitTicketInactivityUpdate(ticket.id, "closed");
  }

      return ticket;
    }
  );
};

export default FindOrCreateTicketService;
