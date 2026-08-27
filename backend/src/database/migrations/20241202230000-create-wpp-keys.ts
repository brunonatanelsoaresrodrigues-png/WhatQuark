import { QueryInterface, DataTypes } from "sequelize";

import {
  ensureWppKeysSchema,
  WPP_KEYS_KEY_ID_LENGTH,
  WPP_KEYS_TYPE_LENGTH
} from "../wppKeys";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("WppKeys", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      connectionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Whatsapps",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      type: {
        type: DataTypes.STRING(WPP_KEYS_TYPE_LENGTH),
        allowNull: false
      },
      keyId: {
        type: DataTypes.STRING(WPP_KEYS_KEY_ID_LENGTH),
        allowNull: false
      },
      value: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await ensureWppKeysSchema(queryInterface);
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("WppKeys");
  }
};
