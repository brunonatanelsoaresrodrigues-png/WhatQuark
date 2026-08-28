import {
  Table,
  Column,
  Model,
  PrimaryKey,
  DataType,
  CreatedAt,
  UpdatedAt
} from "sequelize-typescript";

@Table({ tableName: "AutomationStates" })
class AutomationState extends Model<AutomationState> {
  @PrimaryKey @Column(DataType.STRING(191)) id: string;
  @Column(DataType.TEXT) data: string;
  @Column(DataType.STRING(64)) lockOwner: string | null;
  @Column(DataType.DATE) lockedUntil: Date | null;
  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}
export default AutomationState;
