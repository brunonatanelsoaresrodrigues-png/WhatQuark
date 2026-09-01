import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  DataType,
  Unique,
  AllowNull
} from "sequelize-typescript";

@Table({ tableName: "PatientIntakeBookings" })
class PatientIntakeBooking extends Model<PatientIntakeBooking> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  ticketId: number;

  @Unique
  @Column(DataType.STRING(64))
  requestKey: string;

  @Column(DataType.STRING(24))
  status: "PROCESSING" | "SUCCESS" | "FAILED" | "SLOT_UNAVAILABLE" | "UNKNOWN";

  @Column(DataType.STRING(64))
  agendaId: string;

  @Column(DataType.DATE)
  scheduledAt: Date;

  @AllowNull
  @Column(DataType.STRING(64))
  quarkAppointmentId: string | null;

  @AllowNull
  @Column(DataType.STRING(500))
  lastError: string | null;

  @CreatedAt
  @Column(DataType.DATE)
  createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  updatedAt: Date;
}

export default PatientIntakeBooking;
