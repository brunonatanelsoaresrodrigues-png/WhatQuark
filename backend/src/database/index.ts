import { Sequelize } from "sequelize-typescript";
import User from "../models/User";
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

// eslint-disable-next-line
const dbConfig = require("../config/database");
// import dbConfig from "../config/database";

const sequelize = new Sequelize(dbConfig);

const models = [
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
  QuarkSyncState
];

sequelize.addModels(models);

export default sequelize;
