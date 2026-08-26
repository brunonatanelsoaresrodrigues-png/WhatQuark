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
  Unique,
  ForeignKey
} from "sequelize-typescript";
import Whatsapp from "./Whatsapp";

@Table({ tableName: "WhatsappHistorySyncJobs" })
class WhatsappHistorySyncJob extends Model<WhatsappHistorySyncJob> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Unique
  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @Column(DataType.STRING(16))
  status: "idle" | "running" | "completed" | "failed";

  @Column totalChats: number;
  @Column processedChats: number;
  @Column importedMessages: number;
  @Column duplicateMessages: number;
  @Column failedMessages: number;
  @Column failedChats: number;
  @Column limitedChats: number;

  @AllowNull
  @Column(DataType.DATE)
  startedAt: Date | null;

  @AllowNull
  @Column(DataType.DATE)
  finishedAt: Date | null;

  @AllowNull
  @Column(DataType.STRING(512))
  error: string | null;

  @CreatedAt
  @Column(DataType.DATE)
  createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  updatedAt: Date;
}

export default WhatsappHistorySyncJob;
