import { DataTypes, QueryInterface } from "sequelize";

const TABLE = "Contacts";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    const table = (await queryInterface.describeTable(TABLE)) as Record<
      string,
      unknown
    >;
    if (!table.cpf) {
      await queryInterface.addColumn(TABLE, "cpf", {
        type: DataTypes.STRING(11),
        allowNull: true
      });
    }
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    const table = (await queryInterface.describeTable(TABLE)) as Record<
      string,
      unknown
    >;
    if (table.cpf) await queryInterface.removeColumn(TABLE, "cpf");
  }
};
