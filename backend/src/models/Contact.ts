import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Unique,
  Default,
  HasMany,
  DataType
} from "sequelize-typescript";
import ContactCustomField from "./ContactCustomField";
import Ticket from "./Ticket";

@Table
class Contact extends Model<Contact> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @Unique
  @Column
  number: string;

  @Unique
  @Column
  lid: string;

  @AllowNull(false)
  @Default("")
  @Column
  email: string;

  @AllowNull
  @Column(DataType.STRING(11))
  cpf: string | null;

  @Column
  profilePicUrl: string;

  @Default(false)
  @Column
  isGroup: boolean;

  @Default(false)
  @Column
  isInternal: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @HasMany(() => ContactCustomField)
  extraInfo: ContactCustomField[];
}

export default Contact;
