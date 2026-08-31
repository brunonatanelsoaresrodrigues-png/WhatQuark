import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, ForeignKey, BelongsTo, CreatedAt, UpdatedAt } from "sequelize-typescript";
import Contact from "./Contact";
import User from "./User";

@Table({ tableName: "ContactIdentityIssues" })
class ContactIdentityIssue extends Model<ContactIdentityIssue> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @ForeignKey(() => Contact) @Column contactId: number;
  @BelongsTo(() => Contact) contact: Contact;
  @Column(DataType.STRING(40)) type: string;
  @Column(DataType.STRING(16)) status: string;
  @Column(DataType.STRING(16)) severity: string;
  @Column(DataType.STRING(128)) fingerprint: string;
  @Column(DataType.TEXT({ length: "long" })) evidence: string | null;
  @Column(DataType.STRING(32)) resolution: string | null;
  @ForeignKey(() => User) @Column(DataType.INTEGER) resolvedByUserId: number | null;
  @BelongsTo(() => User, "resolvedByUserId") resolvedBy: User;
  @Column(DataType.DATE) detectedAt: Date;
  @Column(DataType.DATE) lastSeenAt: Date;
  @Column(DataType.DATE) resolvedAt: Date | null;
  @CreatedAt @Column(DataType.DATE) createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) updatedAt: Date;
}

export default ContactIdentityIssue;
