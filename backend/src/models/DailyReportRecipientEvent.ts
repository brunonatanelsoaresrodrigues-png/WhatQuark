import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  CreatedAt,
  UpdatedAt
} from "sequelize-typescript";

@Table({ tableName: "DailyReportRecipientEvents" })
class DailyReportRecipientEvent extends Model<DailyReportRecipientEvent> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull
  @Column(DataType.INTEGER)
  recipientId: number | null;

  @AllowNull
  @Column(DataType.INTEGER)
  performedByUserId: number | null;

  @Column(DataType.STRING(24))
  eventType: string;

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

export default DailyReportRecipientEvent;
