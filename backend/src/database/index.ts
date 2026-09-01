import { Sequelize } from "sequelize-typescript";
import User from "../models/User";
import AutomationState from "../models/AutomationState";
import OutboundMessage from "../models/OutboundMessage";
import Setting from "../models/Setting";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import ContactCustomField from "../models/ContactCustomField";
import Message from "../models/Message";
import Queue from "../models/Queue";
import WhatsappQueue from "../models/WhatsappQueue";
import UserQueue from "../models/UserQueue";
import QuickAnswer from "../models/QuickAnswer";
import WppKey from "../models/WppKey";
import QuarkAppointment from "../models/QuarkAppointment";
import QuarkAppointmentNotification from "../models/QuarkAppointmentNotification";
import QuarkSyncState from "../models/QuarkSyncState";
import QuarkAppointmentResponse from "../models/QuarkAppointmentResponse";
import TicketInactivityEvent from "../models/TicketInactivityEvent";
import MessageAttribution from "../models/MessageAttribution";
import TicketEvent from "../models/TicketEvent";
import QuarkAppointmentEvent from "../models/QuarkAppointmentEvent";
import DailyReportRecipient from "../models/DailyReportRecipient";
import DailyReportRun from "../models/DailyReportRun";
import DailyReportDelivery from "../models/DailyReportDelivery";
import DailyReportRecipientEvent from "../models/DailyReportRecipientEvent";
import QuarkAppointmentRecipient from "../models/QuarkAppointmentRecipient";
import PatientIntakeBooking from "../models/PatientIntakeBooking";
import SavedSticker from "../models/SavedSticker";
import ContactIdentityIssue from "../models/ContactIdentityIssue";
import ContactQuarkLink from "../models/ContactQuarkLink";
import ContactIdentityAudit from "../models/ContactIdentityAudit";
import OperationalIncident from "../models/OperationalIncident";
import AiSuggestion from "../models/AiSuggestion";
import ServiceRating from "../models/ServiceRating";

// eslint-disable-next-line
const dbConfig = require("../config/database");
// import dbConfig from "../config/database";

const sequelize = new Sequelize(dbConfig);

const models = [
  AutomationState,
  OutboundMessage,
  User,
  Contact,
  Ticket,
  Message,
  Whatsapp,
  ContactCustomField,
  Setting,
  Queue,
  WhatsappQueue,
  UserQueue,
  QuickAnswer,
  WppKey,
  QuarkAppointment,
  QuarkAppointmentNotification,
  QuarkAppointmentResponse,
  QuarkSyncState,
  TicketInactivityEvent,
  MessageAttribution,
  TicketEvent,
  QuarkAppointmentEvent,
  DailyReportRecipient,
  DailyReportRun,
  DailyReportDelivery,
  DailyReportRecipientEvent,
  QuarkAppointmentRecipient,
  PatientIntakeBooking,
  SavedSticker,
  ContactIdentityIssue,
  ContactQuarkLink,
  ContactIdentityAudit,
  OperationalIncident,
  AiSuggestion,
  ServiceRating
];

sequelize.addModels(models);

export default sequelize;
