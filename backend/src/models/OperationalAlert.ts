import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Default,
  Unique
} from "sequelize-typescript";

export type OperationalAlertSeverity = "INFO" | "WARNING" | "CRITICAL";
export type OperationalAlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

@Table({ tableName: "OperationalAlerts" })
class OperationalAlert extends Model<OperationalAlert> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Unique
  @Column(DataType.STRING(128))
  alertKey: string;

  @Column(DataType.STRING(32))
  category: string;

  @Column(DataType.STRING(16))
  severity: OperationalAlertSeverity;

  @Default("OPEN")
  @Column(DataType.STRING(16))
  status: OperationalAlertStatus;

  @Column(DataType.STRING(160))
  title: string;

  @Column(DataType.STRING(512))
  message: string;

  @AllowNull
  @Column(DataType.TEXT)
  details: string | null;

  @Column(DataType.DATE)
  firstDetectedAt: Date;

  @Column(DataType.DATE)
  lastDetectedAt: Date;

  @AllowNull
  @Column(DataType.DATE)
  acknowledgedAt: Date | null;

  @AllowNull
  @Column(DataType.INTEGER)
  acknowledgedByUserId: number | null;

  @AllowNull
  @Column(DataType.DATE)
  resolvedAt: Date | null;

  @CreatedAt
  @Column(DataType.DATE)
  createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  updatedAt: Date;
}

export default OperationalAlert;
