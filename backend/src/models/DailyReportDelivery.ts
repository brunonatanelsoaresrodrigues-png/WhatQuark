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
import DailyReportRecipient from "./DailyReportRecipient";
import DailyReportRun from "./DailyReportRun";
import Whatsapp from "./Whatsapp";

@Table({ tableName: "DailyReportDeliveries" })
class DailyReportDelivery extends Model<DailyReportDelivery> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @ForeignKey(() => DailyReportRun) @Column reportRunId: number;
  @BelongsTo(() => DailyReportRun) reportRun: DailyReportRun;
  @ForeignKey(() => DailyReportRecipient) @Column recipientId: number;
  @BelongsTo(() => DailyReportRecipient) recipient: DailyReportRecipient;
  @ForeignKey(() => Whatsapp) @Column whatsappId: number;
  @BelongsTo(() => Whatsapp) whatsapp: Whatsapp;
  @AllowNull @Column(DataType.INTEGER) ticketId: number | null;
  @Column(DataType.STRING(24)) status: string;
  @Column attempts: number;
  @Column(DataType.DATE) nextAttemptAt: Date;
  @AllowNull @Column(DataType.DATE) processingStartedAt: Date | null;
  @AllowNull @Column(DataType.STRING(64)) workerId: string | null;
  @AllowNull @Column(DataType.STRING) messageId: string | null;
  @AllowNull @Column(DataType.DATE) sentAt: Date | null;
  @AllowNull @Column(DataType.DATE) deliveredAt: Date | null;
  @AllowNull @Column(DataType.DATE) readAt: Date | null;
  @AllowNull @Column(DataType.STRING(512)) lastError: string | null;
  @CreatedAt @Column(DataType.DATE) createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) updatedAt: Date;
}

export default DailyReportDelivery;
