import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt
} from "sequelize-typescript";
import Ticket from "./Ticket";

export type TicketEventType =
  | "CREATED"
  | "ASSIGNED"
  | "ACCEPTED"
  | "TRANSFERRED"
  | "WAITING_PATIENT"
  | "WAITING_CANCELLED"
  | "CLOSED_BY_USER"
  | "CLOSED_BY_INACTIVITY"
  | "REOPENED"
  | "RETURNED_TO_QUEUE"
  | "INTAKE_STARTED"
  | "INTAKE_COMPLETED"
  | "INTAKE_PAUSED"
  | "INTAKE_RESTARTED";

@Table({ tableName: "TicketEvents" })
class TicketEvent extends Model<TicketEvent> {
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
  eventType: TicketEventType;

  @AllowNull
  @Column(DataType.INTEGER)
  performedByUserId: number | null;

  @AllowNull
  @Column(DataType.INTEGER)
  previousUserId: number | null;

  @AllowNull
  @Column(DataType.INTEGER)
  newUserId: number | null;

  @AllowNull
  @Column(DataType.INTEGER)
  previousQueueId: number | null;

  @AllowNull
  @Column(DataType.INTEGER)
  newQueueId: number | null;

  @AllowNull
  @Column(DataType.TEXT)
  metadata: string | null;

  @Column(DataType.DATE)
  occurredAt: Date;

  @CreatedAt
  @Column(DataType.DATE)
  createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  updatedAt: Date;
}

export default TicketEvent;
