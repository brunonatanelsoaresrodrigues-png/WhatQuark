import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Users", "canAccessQuarkClinic", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.bulkUpdate(
      "Users",
      { canAccessQuarkClinic: true },
      { profile: "admin" }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Users", "canAccessQuarkClinic");
  }
};
