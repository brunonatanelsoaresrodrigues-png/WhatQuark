import {
  AutoIncrement,
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";

@Table({ tableName: "SavedStickers" })
class SavedSticker extends Model<SavedSticker> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column(DataType.STRING(80))
  name: string | null;

  @Column(DataType.STRING(191))
  storageKey: string;

  @Column(DataType.STRING(64))
  sha256: string;

  @Column(DataType.STRING(80))
  mimeType: string;

  @Column(DataType.STRING(191))
  sourceMessageId: string | null;

  @Column(DataType.INTEGER)
  createdByUserId: number | null;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default SavedSticker;
