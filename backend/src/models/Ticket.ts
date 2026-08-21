import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  HasMany,
  AutoIncrement,
  Default,
  DataType
} from "sequelize-typescript";

import Contact from "./Contact";
import Message from "./Message";
import Queue from "./Queue";
import User from "./User";
import Whatsapp from "./Whatsapp";

@Table
class Ticket extends Model<Ticket> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column({ defaultValue: "pending" })
  status: string;

  @Column
  unreadMessages: number;

  @Column
  lastMessage: string;

  @Column(DataType.DATE)
  awaitingPatientSince: Date | null;

  @Column(DataType.DATE)
  inactivityClosingAt: Date | null;

  @Column(DataType.DATE)
  inactivityNoticeSentAt: Date | null;

  @Column(DataType.STRING)
  inactivityNoticeMessageId: string | null;

  @Default(false)
  @Column
  closedByInactivity: boolean;

  @Column(DataType.INTEGER)
  inactivityPreviousUserId: number | null;

  @Default(false)
  @Column
  isGroup: boolean;

  @Default("PATIENT")
  @Column(DataType.STRING(32))
  ticketType: "PATIENT" | "INTERNAL_REPORT";

  @Column(DataType.STRING(40))
  intakeStatus: string | null;

  @Column(DataType.STRING(32))
  intakeReason: string | null;

  @Column(DataType.DATE)
  intakeStartedAt: Date | null;

  @Column(DataType.DATE)
  intakeCompletedAt: Date | null;

  @Column(DataType.DATE)
  intakePausedAt: Date | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

  @HasMany(() => Message)
  messages: Message[];
}

export default Ticket;
