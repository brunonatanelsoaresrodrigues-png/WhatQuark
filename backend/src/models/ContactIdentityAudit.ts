import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, ForeignKey, BelongsTo, CreatedAt, UpdatedAt } from "sequelize-typescript";
import Contact from "./Contact";
import User from "./User";

@Table({ tableName: "ContactIdentityAudits" })
class ContactIdentityAudit extends Model<ContactIdentityAudit> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @ForeignKey(() => Contact) @Column(DataType.INTEGER) contactId: number | null;
  @BelongsTo(() => Contact) contact: Contact;
  @ForeignKey(() => User) @Column(DataType.INTEGER) userId: number | null;
  @BelongsTo(() => User) user: User;
  @Column(DataType.STRING(48)) action: string;
  @Column(DataType.STRING(24)) source: string;
  @Column(DataType.STRING(64)) previousValueHash: string | null;
  @Column(DataType.STRING(64)) newValueHash: string | null;
  @Column(DataType.TEXT({ length: "long" })) metadata: string | null;
  @CreatedAt @Column(DataType.DATE) createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) updatedAt: Date;
}

export default ContactIdentityAudit;
