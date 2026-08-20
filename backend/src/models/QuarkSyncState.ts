import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  AllowNull,
  Default
} from "sequelize-typescript";

@Table({ tableName: "QuarkSyncStates" })
class QuarkSyncState extends Model<QuarkSyncState> {
  @PrimaryKey
  @Column(DataType.STRING(64))
  key: string;

  @Column(DataType.STRING(32))
  status: "BASELINING" | "ACTIVE";

  @AllowNull
  @Column(DataType.DATE)
  baselineStartedAt: Date | null;

  @AllowNull
  @Column(DataType.DATE)
  baselineCompletedAt: Date | null;

  @AllowNull
  @Column(DataType.DATE)
  lastSuccessfulSyncAt: Date | null;

  @AllowNull
  @Column(DataType.DATE)
  syncLockUntil: Date | null;

  @AllowNull
  @Column(DataType.STRING(64))
  syncWorkerId: string | null;

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

export default QuarkSyncState;
