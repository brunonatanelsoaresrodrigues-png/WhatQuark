import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Users", "canViewOtherAgentsTickets", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.bulkUpdate(
      "Users",
      { canViewOtherAgentsTickets: true },
      { profile: "admin" }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Users", "canViewOtherAgentsTickets");
  }
};
