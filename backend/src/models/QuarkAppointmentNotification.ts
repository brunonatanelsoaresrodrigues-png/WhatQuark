import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull
} from "sequelize-typescript";

@Table({ tableName: "QuarkAppointmentNotifications" })
class QuarkAppointmentNotification extends Model<QuarkAppointmentNotification> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column(DataType.STRING(64))
  appointmentId: string;

  @Column(DataType.STRING(128))
  notificationKey: string;

  @Column(DataType.STRING(32))
  eventType: string;

  @Column(DataType.TEXT)
  payload: string;

  @Column(DataType.STRING(32))
  status:
    | "PENDING"
    | "PROCESSING"
    | "SENT"
    | "FAILED_RETRY"
    | "DEAD_LETTER"
    | "SUPPRESSED";

  @Column
  attempts: number;

  @Column(DataType.DATE)
  nextAttemptAt: Date;

  @AllowNull
  @Column(DataType.DATE)
  processingStartedAt: Date | null;

  @AllowNull
  @Column(DataType.STRING(64))
  workerId: string | null;

  @AllowNull
  @Column(DataType.DATE)
  sentAt: Date | null;

  @AllowNull
  @Column(DataType.STRING(512))
  lastError: string | null;

  @AllowNull
  @Column(DataType.STRING)
  messageId: string | null;

  @AllowNull
  @Column
  ticketId: number | null;

  @AllowNull
  @Column(DataType.DATE)
  deliveredAt: Date | null;

  @AllowNull
  @Column(DataType.DATE)
  readAt: Date | null;

  @CreatedAt
  @Column(DataType.DATE)
  createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  updatedAt: Date;
}

export default QuarkAppointmentNotification;
