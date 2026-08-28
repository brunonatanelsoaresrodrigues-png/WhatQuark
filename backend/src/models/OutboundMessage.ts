import {
  Table,
  Column,
  Model,
  PrimaryKey,
  DataType,
  CreatedAt,
  UpdatedAt
} from "sequelize-typescript";

@Table({ tableName: "OutboundMessages" })
class OutboundMessage extends Model<OutboundMessage> {
  @PrimaryKey @Column(DataType.STRING(64)) id: string;
  @Column whatsappId: number;
  @Column(DataType.STRING(64)) recipient: string;
  @Column(DataType.STRING(16)) kind: "text" | "media";
  @Column(DataType.TEXT({ length: "long" })) payload: string;
  @Column(DataType.STRING(16)) status:
    | "PENDING"
    | "PROCESSING"
    | "SENT"
    | "UNKNOWN"
    | "BLOCKED"
    | "FAILED";
  @Column priority: number;
  @Column(DataType.DATE) dueAt: Date;
  @Column(DataType.DATE) attemptedAt: Date | null;
  @Column(DataType.DATE) finishedAt: Date | null;
  @Column(DataType.STRING(128)) messageId: string | null;
  @Column(DataType.TEXT) result: string | null;
  @Column(DataType.STRING(128)) errorCode: string | null;
  @CreatedAt createdAt: Date;
  @UpdatedAt updatedAt: Date;
}
export default OutboundMessage;
