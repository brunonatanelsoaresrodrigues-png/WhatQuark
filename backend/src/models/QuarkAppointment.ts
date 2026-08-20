import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  Default,
  Unique,
  AllowNull
} from "sequelize-typescript";

@Table({ tableName: "QuarkAppointments" })
class QuarkAppointment extends Model<QuarkAppointment> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Unique
  @Column(DataType.STRING(64))
  appointmentId: string;

  @AllowNull
  @Column(DataType.STRING(64))
  patientId: string | null;

  @AllowNull
  @Column(DataType.STRING(32))
  phone: string | null;

  @Column(DataType.STRING)
  patientName: string;

  @Column(DataType.STRING(64))
  status: string;

  @AllowNull
  @Column(DataType.DATE)
  scheduledAt: Date | null;

  @Column(DataType.STRING(64))
  scheduleFingerprint: string;

  @Column(DataType.STRING(64))
  snapshotFingerprint: string;

  @Column(DataType.TEXT)
  snapshot: string;

  @Default(false)
  @Column
  awaitingConfirmation: boolean;

  @AllowNull
  @Column(DataType.DATE)
  confirmationRequestedAt: Date | null;

  @Column(DataType.DATE)
  lastSeenAt: Date;

  @Column(DataType.DATE)
  firstSeenAt: Date;

  @Column(DataType.DATE)
  lastChangedAt: Date;

  @Default(false)
  @Column
  baselineImported: boolean;

  @Default(1)
  @Column
  fingerprintVersion: number;

  @CreatedAt
  @Column(DataType.DATE)
  createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  updatedAt: Date;
}

export default QuarkAppointment;
