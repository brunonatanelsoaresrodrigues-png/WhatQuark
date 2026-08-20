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
  Default
} from "sequelize-typescript";

@Table({ tableName: "QuarkAppointmentResponses" })
class QuarkAppointmentResponse extends Model<QuarkAppointmentResponse> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column(DataType.STRING(64))
  appointmentId: string;

  @AllowNull
  @Column
  notificationId: number | null;

  @Column(DataType.STRING(16))
  decision: "CONFIRMED" | "CANCELLED";

  @Default("WHATSAPP")
  @Column(DataType.STRING(16))
  source: "WHATSAPP";

  @Column(DataType.STRING(16))
  status: "PROCESSING" | "SUCCESS" | "FAILED";

  @AllowNull
  @Column(DataType.STRING(64))
  previousQuarkStatus: string | null;

  @AllowNull
  @Column(DataType.STRING(64))
  newQuarkStatus: string | null;

  @Column(DataType.DATE)
  receivedAt: Date;

  @AllowNull
  @Column(DataType.DATE)
  appliedAt: Date | null;

  @AllowNull
  @Column
  responseTimeSeconds: number | null;

  @AllowNull
  @Column(DataType.STRING(512))
  errorCode: string | null;

  @CreatedAt
  @Column(DataType.DATE)
  createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  updatedAt: Date;
}

export default QuarkAppointmentResponse;
