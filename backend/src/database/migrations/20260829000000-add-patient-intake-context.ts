import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Tickets", "intakeContext", {
      type: DataTypes.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn("Tickets", "intakeContextExpiresAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Tickets", "intakeContextExpiresAt");
    await queryInterface.removeColumn("Tickets", "intakeContext");
  }
};
