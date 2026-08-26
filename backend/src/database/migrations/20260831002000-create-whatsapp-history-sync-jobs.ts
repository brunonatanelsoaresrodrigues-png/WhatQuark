import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.createTable("WhatsappHistorySyncJobs", {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "idle"
      },
      totalChats: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      processedChats: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      importedMessages: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      duplicateMessages: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      failedMessages: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      failedChats: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      limitedChats: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      startedAt: { type: DataTypes.DATE, allowNull: true },
      finishedAt: { type: DataTypes.DATE, allowNull: true },
      error: { type: DataTypes.STRING(512), allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.dropTable("WhatsappHistorySyncJobs");
  }
};
