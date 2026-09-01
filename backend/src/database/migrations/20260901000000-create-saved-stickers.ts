import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.createTable("SavedStickers", {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: { type: DataTypes.STRING(80), allowNull: true },
      storageKey: {
        type: DataTypes.STRING(191),
        allowNull: false,
        unique: true
      },
      sha256: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true
      },
      mimeType: {
        type: DataTypes.STRING(80),
        allowNull: false,
        defaultValue: "image/webp"
      },
      sourceMessageId: { type: DataTypes.STRING(191), allowNull: true },
      createdByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      createdAt: { type: DataTypes.DATE(6), allowNull: false },
      updatedAt: { type: DataTypes.DATE(6), allowNull: false }
    });
    await queryInterface.addIndex("SavedStickers", ["updatedAt"], {
      name: "saved_stickers_updated_at"
    });
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.dropTable("SavedStickers");
  }
};
