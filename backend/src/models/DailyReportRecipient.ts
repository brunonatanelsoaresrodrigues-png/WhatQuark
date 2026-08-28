import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  Unique,
  Default,
  AllowNull,
  CreatedAt,
  UpdatedAt,
  HasMany
} from "sequelize-typescript";
import DailyReportDelivery from "./DailyReportDelivery";

@Table({ tableName: "DailyReportRecipients" })
class DailyReportRecipient extends Model<DailyReportRecipient> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @Column(DataType.STRING(120)) name: string;
  @Unique @Column(DataType.STRING(15)) phone: string;
  @Default(true) @Column active: boolean;
  @AllowNull @Column(DataType.DATE) verifiedAt: Date | null;
  @CreatedAt @Column(DataType.DATE) createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) updatedAt: Date;

  @HasMany(() => DailyReportDelivery)
  deliveries: DailyReportDelivery[];
}

export default DailyReportRecipient;
