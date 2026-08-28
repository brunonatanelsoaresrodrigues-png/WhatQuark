import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  CreatedAt,
  UpdatedAt,
  HasMany
} from "sequelize-typescript";
import DailyReportDelivery from "./DailyReportDelivery";

@Table({ tableName: "DailyReportRuns" })
class DailyReportRun extends Model<DailyReportRun> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @Column(DataType.DATEONLY) reportDate: string;
  @Column(DataType.STRING(16)) runType: "DAILY" | "TEST";
  @Column(DataType.DATE) periodStart: Date;
  @Column(DataType.DATE) periodEnd: Date;
  @Column(DataType.STRING(64)) timezone: string;
  @Column(DataType.STRING(24)) status: string;
  @AllowNull @Column(DataType.TEXT) snapshot: string | null;
  @AllowNull @Column(DataType.TEXT) renderedBody: string | null;
  @AllowNull @Column(DataType.DATE) dataFreshness: Date | null;
  @AllowNull @Column(DataType.DATE) generatedAt: Date | null;
  @AllowNull @Column(DataType.DATE) completedAt: Date | null;
  @AllowNull @Column(DataType.STRING(512)) lastError: string | null;
  @CreatedAt @Column(DataType.DATE) createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) updatedAt: Date;

  @HasMany(() => DailyReportDelivery)
  deliveries: DailyReportDelivery[];
}

export default DailyReportRun;
