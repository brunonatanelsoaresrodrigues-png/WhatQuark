import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  Default
} from "sequelize-typescript";

@Table({ tableName: "QuarkAppointmentRecipients" })
class QuarkAppointmentRecipient extends Model<QuarkAppointmentRecipient> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column(DataType.STRING(64))
  appointmentId: string;

  @Column(DataType.STRING(32))
  phone: string;

  @Column(DataType.STRING(32))
  source: string;

  @Default(false)
  @Column
  isPrimary: boolean;

  @Default(true)
  @Column
  active: boolean;

  @CreatedAt
  @Column(DataType.DATE)
  createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  updatedAt: Date;
}

export default QuarkAppointmentRecipient;
