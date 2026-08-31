import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, ForeignKey, BelongsTo, CreatedAt, UpdatedAt } from "sequelize-typescript";
import Ticket from "./Ticket";
import User from "./User";

@Table({ tableName: "AiSuggestions" })
class AiSuggestion extends Model<AiSuggestion> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @ForeignKey(() => Ticket) @Column ticketId: number;
  @BelongsTo(() => Ticket) ticket: Ticket;
  @ForeignKey(() => User) @Column generatedByUserId: number;
  @BelongsTo(() => User, "generatedByUserId") generatedBy: User;
  @Column(DataType.STRING(64)) model: string;
  @Column(DataType.STRING(32)) promptVersion: string;
  @Column(DataType.STRING(64)) inputHash: string;
  @Column(DataType.TEXT({ length: "long" })) output: string;
  @Column(DataType.STRING(24)) status: string;
  @ForeignKey(() => User) @Column(DataType.INTEGER) reviewedByUserId: number | null;
  @BelongsTo(() => User, "reviewedByUserId") reviewedBy: User;
  @Column(DataType.STRING(64)) reviewedOutputHash: string | null;
  @Column(DataType.DATE) copiedAt: Date | null;
  @Column(DataType.DATE) discardedAt: Date | null;
  @CreatedAt @Column(DataType.DATE) createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) updatedAt: Date;
}

export default AiSuggestion;
