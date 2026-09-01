import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt
} from "sequelize-typescript";
import Contact from "./Contact";
import Queue from "./Queue";
import Ticket from "./Ticket";
import User from "./User";
import Whatsapp from "./Whatsapp";

export type ServiceRatingStatus =
  | "PENDING"
  | "SENT"
  | "ANSWERED"
  | "EXPIRED"
  | "CANCELLED"
  | "FAILED";
export type ServiceRatingTrigger = "MANUAL_RESOLUTION" | "INACTIVITY";

@Table({ tableName: "ServiceRatings" })
class ServiceRating extends Model<ServiceRating> {
  @PrimaryKey @AutoIncrement @Column id: number;
  @ForeignKey(() => Ticket) @Column ticketId: number;
  @BelongsTo(() => Ticket) ticket: Ticket;
  @ForeignKey(() => Contact) @AllowNull @Column(DataType.INTEGER) contactId: number | null;
  @BelongsTo(() => Contact) contact: Contact;
  @ForeignKey(() => User) @AllowNull @Column(DataType.INTEGER) ratedUserId: number | null;
  @BelongsTo(() => User, "ratedUserId") ratedUser: User;
  @ForeignKey(() => Queue) @AllowNull @Column(DataType.INTEGER) queueId: number | null;
  @BelongsTo(() => Queue) queue: Queue;
  @ForeignKey(() => Whatsapp) @Column whatsappId: number;
  @BelongsTo(() => Whatsapp) whatsapp: Whatsapp;
  @Column(DataType.STRING(120)) ratedUserName: string;
  @AllowNull @Column(DataType.STRING(120)) queueName: string | null;
  @Column(DataType.STRING(24)) trigger: ServiceRatingTrigger;
  @Column(DataType.STRING(16)) status: ServiceRatingStatus;
  @AllowNull
  @Column({
    type: DataType.INTEGER,
    validate: { min: 0, max: 5 }
  })
  score: number | null;
  @AllowNull @Column(DataType.STRING) requestMessageId: string | null;
  @AllowNull @Column(DataType.STRING) responseMessageId: string | null;
  @AllowNull @Column(DataType.DATE) requestedAt: Date | null;
  @AllowNull @Column(DataType.DATE) answeredAt: Date | null;
  @Column(DataType.DATE) expiresAt: Date;
  @AllowNull @Column(DataType.STRING(64)) failureCode: string | null;
  @CreatedAt @Column(DataType.DATE) createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) updatedAt: Date;
}

export default ServiceRating;
