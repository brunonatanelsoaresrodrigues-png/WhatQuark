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

@Table({ tableName: "QuarkAppointmentEvents" })
class QuarkAppointmentEvent extends Model<QuarkAppointmentEvent> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column(DataType.STRING(64))
  appointmentId: string;

  @Column(DataType.STRING(32))
  eventType: string;

  @AllowNull @Column(DataType.STRING(64)) previousStatus: string | null;
  @AllowNull @Column(DataType.STRING(64)) newStatus: string | null;
  @AllowNull @Column(DataType.DATE) previousScheduledAt: Date | null;
  @AllowNull @Column(DataType.DATE) newScheduledAt: Date | null;
  @AllowNull @Column(DataType.STRING(64)) previousProfessionalId: string | null;
  @AllowNull @Column(DataType.STRING(64)) newProfessionalId: string | null;
  @AllowNull @Column(DataType.STRING(64)) previousProcedureId: string | null;
  @AllowNull @Column(DataType.STRING(64)) newProcedureId: string | null;

  @Column(DataType.STRING(32))
  source: string;

  @AllowNull
  @Column(DataType.TEXT)
  metadata: string | null;

  @Column(DataType.DATE)
  occurredAt: Date;

  @CreatedAt @Column(DataType.DATE) createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) updatedAt: Date;
}

export default QuarkAppointmentEvent;
