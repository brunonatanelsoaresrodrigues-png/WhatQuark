import { DataTypes, QueryInterface } from "sequelize";

const TABLE = "Messages";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    const table = (await queryInterface.describeTable(TABLE)) as Record<
      string,
      unknown
    >;

    if (!table.editedAt) {
      await queryInterface.addColumn(TABLE, "editedAt", {
        type: DataTypes.DATE(6),
        allowNull: true
      });
    }

    if (!table.editedByUserId) {
      await queryInterface.addColumn(TABLE, "editedByUserId", {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      });
    }
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    const table = (await queryInterface.describeTable(TABLE)) as Record<
      string,
      unknown
    >;

    if (table.editedByUserId)
      await queryInterface.removeColumn(TABLE, "editedByUserId");
    if (table.editedAt) await queryInterface.removeColumn(TABLE, "editedAt");
  }
};
