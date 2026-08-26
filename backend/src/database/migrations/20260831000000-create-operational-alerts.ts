import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("OperationalAlerts", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      alertKey: {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: true
      },
      category: { type: DataTypes.STRING(32), allowNull: false },
      severity: { type: DataTypes.STRING(16), allowNull: false },
      status: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "OPEN"
      },
      title: { type: DataTypes.STRING(160), allowNull: false },
      message: { type: DataTypes.STRING(512), allowNull: false },
      details: { type: DataTypes.TEXT, allowNull: true },
      firstDetectedAt: { type: DataTypes.DATE, allowNull: false },
      lastDetectedAt: { type: DataTypes.DATE, allowNull: false },
      acknowledgedAt: { type: DataTypes.DATE, allowNull: true },
      acknowledgedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      resolvedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.addIndex("OperationalAlerts", {
      name: "operational_alerts_status_severity",
      fields: ["status", "severity", "lastDetectedAt"]
    });
    await queryInterface.addIndex("OperationalAlerts", {
      name: "operational_alerts_category_date",
      fields: ["category", "lastDetectedAt"]
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("OperationalAlerts");
  }
};
