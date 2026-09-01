import { QueryInterface, DataTypes, Op } from "sequelize";

const settingKeys = [
  "serviceRatingEnabled",
  "serviceRatingExpiryHours",
  "serviceRatingCooldownHours",
  "serviceRatingMessage",
  "serviceRatingThankYouMessage"
];

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.createTable("ServiceRatings", {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "Tickets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      contactId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      ratedUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      queueId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Queues", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      ratedUserName: { type: DataTypes.STRING(120), allowNull: false },
      queueName: { type: DataTypes.STRING(120), allowNull: true },
      trigger: { type: DataTypes.STRING(24), allowNull: false },
      status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "PENDING"
      },
      score: { type: DataTypes.INTEGER, allowNull: true },
      requestMessageId: { type: DataTypes.STRING, allowNull: true },
      responseMessageId: { type: DataTypes.STRING, allowNull: true, unique: true },
      requestedAt: { type: DataTypes.DATE, allowNull: true },
      answeredAt: { type: DataTypes.DATE, allowNull: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      failureCode: { type: DataTypes.STRING(64), allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await queryInterface.addIndex("ServiceRatings", ["ratedUserId", "requestedAt"]);
    await queryInterface.addIndex("ServiceRatings", ["status", "expiresAt"]);
    await queryInterface.addIndex("ServiceRatings", ["contactId", "whatsappId", "status"]);

    const now = new Date();
    await queryInterface.bulkInsert("Settings", [
      { key: settingKeys[0], value: "enabled", createdAt: now, updatedAt: now },
      { key: settingKeys[1], value: "48", createdAt: now, updatedAt: now },
      { key: settingKeys[2], value: "12", createdAt: now, updatedAt: now },
      {
        key: settingKeys[3],
        value:
          "Como você avalia este atendimento? ⭐\n\nResponda somente com uma nota de 0 a 5, onde 0 é muito ruim e 5 é excelente.",
        createdAt: now,
        updatedAt: now
      },
      {
        key: settingKeys[4],
        value: "Obrigado pela sua avaliação! Sua opinião nos ajuda a melhorar. 💚",
        createdAt: now,
        updatedAt: now
      }
    ]);
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.bulkDelete("Settings", { key: { [Op.in]: settingKeys } });
    await queryInterface.dropTable("ServiceRatings");
  }
};
