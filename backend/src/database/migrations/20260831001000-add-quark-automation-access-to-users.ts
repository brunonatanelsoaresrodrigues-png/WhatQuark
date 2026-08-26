import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.addColumn("Users", "canAccessQuarkAutomation", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // Preserva integralmente os acessos existentes. Depois da migracao, o
    // administrador pode administrar Clinic e Automacao separadamente.
    await queryInterface.bulkUpdate(
      "Users",
      { canAccessQuarkAutomation: true },
      { canAccessQuarkClinic: true }
    );
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.removeColumn("Users", "canAccessQuarkAutomation");
  }
};
