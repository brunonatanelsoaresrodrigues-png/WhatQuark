import { DataTypes, QueryInterface } from "sequelize";

const TABLE = "Users";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    const table = (await queryInterface.describeTable(TABLE)) as Record<
      string,
      unknown
    >;
    if (!table.avatar) {
      await queryInterface.addColumn(TABLE, "avatar", {
        type: DataTypes.STRING(120),
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    const table = (await queryInterface.describeTable(TABLE)) as Record<
      string,
      unknown
    >;
    if (table.avatar) await queryInterface.removeColumn(TABLE, "avatar");
  }
};
