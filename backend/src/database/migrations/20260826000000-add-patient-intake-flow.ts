import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Tickets", "intakeStatus", {
      type: DataTypes.STRING(40),
      allowNull: true
    });
    await queryInterface.addColumn("Tickets", "intakeReason", {
      type: DataTypes.STRING(32),
      allowNull: true
    });
    await queryInterface.addColumn("Tickets", "intakeStartedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
    await queryInterface.addColumn("Tickets", "intakeCompletedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
    await queryInterface.addColumn("Tickets", "intakePausedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    await queryInterface.addIndex("Tickets", {
      name: "tickets_intake_status",
      fields: ["intakeStatus", "status"]
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex("Tickets", "tickets_intake_status");
    await queryInterface.removeColumn("Tickets", "intakePausedAt");
    await queryInterface.removeColumn("Tickets", "intakeCompletedAt");
    await queryInterface.removeColumn("Tickets", "intakeStartedAt");
    await queryInterface.removeColumn("Tickets", "intakeReason");
    await queryInterface.removeColumn("Tickets", "intakeStatus");
  }
};
