import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AllowNull,
  CreatedAt,
  UpdatedAt
} from "sequelize-typescript";

export type MessageOrigin =
  | "HUMAN"
  | "BOT"
  | "QUARK"
  | "INACTIVITY"
  | "DAILY_REPORT"
  | "SURVEY"
  | "SYSTEM"
  | "PATIENT"
  | "UNKNOWN";

@Table({ tableName: "MessageAttributions" })
class MessageAttribution extends Model<MessageAttribution> {
  @PrimaryKey
  @Column(DataType.STRING)
  messageId: string;

  @AllowNull
  @Column(DataType.INTEGER)
  sentByUserId: number | null;

  @Column(DataType.STRING(24))
  origin: MessageOrigin;

  @CreatedAt
  @Column(DataType.DATE)
  createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  updatedAt: Date;
}

export default MessageAttribution;
