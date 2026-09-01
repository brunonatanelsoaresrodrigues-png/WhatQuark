import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, ForeignKey, BelongsTo, CreatedAt, UpdatedAt } from "sequelize-typescript";
import User from "./User";

@Table({ tableName: "OperationalIncidents" })
class OperationalIncident extends Model<OperationalIncident> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @Column(DataType.STRING(96)) incidentKey: string;
  @Column(DataType.STRING(16)) status: string;
  @Column(DataType.STRING(16)) severity: string;
  @Column(DataType.STRING(160)) title: string;
  @Column(DataType.TEXT) detail: string | null;
  @Column(DataType.DATE) startedAt: Date;
  @Column(DataType.DATE) lastSeenAt: Date;
  @Column(DataType.DATE) acknowledgedAt: Date | null;
  @ForeignKey(() => User) @Column(DataType.INTEGER) acknowledgedByUserId: number | null;
  @BelongsTo(() => User, "acknowledgedByUserId") acknowledgedBy: User;
  @Column(DataType.DATE) resolvedAt: Date | null;
  @CreatedAt @Column(DataType.DATE) createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) updatedAt: Date;
}

export default OperationalIncident;
