import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, ForeignKey, BelongsTo, CreatedAt, UpdatedAt } from "sequelize-typescript";
import Contact from "./Contact";
import User from "./User";

@Table({ tableName: "ContactQuarkLinks" })
class ContactQuarkLink extends Model<ContactQuarkLink> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @ForeignKey(() => Contact) @Column contactId: number;
  @BelongsTo(() => Contact) contact: Contact;
  @Column(DataType.STRING(64)) quarkPatientId: string;
  @Column(DataType.STRING(16)) status: string;
  @Column(DataType.STRING(32)) matchMethod: string;
  @Column confidence: number;
  @ForeignKey(() => User) @Column(DataType.INTEGER) confirmedByUserId: number | null;
  @BelongsTo(() => User, "confirmedByUserId") confirmedBy: User;
  @Column(DataType.DATE) confirmedAt: Date | null;
  @Column(DataType.DATE) rejectedAt: Date | null;
  @CreatedAt @Column(DataType.DATE) createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) updatedAt: Date;
}

export default ContactQuarkLink;
