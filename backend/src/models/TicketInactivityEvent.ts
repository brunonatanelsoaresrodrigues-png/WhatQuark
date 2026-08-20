import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  AllowNull
} from "sequelize-typescript";

import Ticket from "./Ticket";

export type TicketInactivityEventType =
  | "WAITING_STARTED"
  | "WAITING_CANCELLED"
  | "CLOSED"
  | "REOPENED";

@Table({ tableName: "TicketInactivityEvents" })
class TicketInactivityEvent extends Model<TicketInactivityEvent> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @Column(DataType.STRING(32))
  eventType: TicketInactivityEventType;

  @Column(DataType.STRING(128))
  reason: string;

  @AllowNull
  @Column(DataType.INTEGER)
  userId: number | null;

  @AllowNull
  @Column(DataType.STRING)
  messageId: string | null;

  @Column(DataType.DATE)
  occurredAt: Date;

  @CreatedAt
  @Column(DataType.DATE)
  createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  updatedAt: Date;
}

export default TicketInactivityEvent;
