import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.createTable("ContactIdentityIssues", {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      contactId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      type: { type: DataTypes.STRING(40), allowNull: false },
      status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "OPEN" },
      severity: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "INFO" },
      fingerprint: { type: DataTypes.STRING(128), allowNull: false, unique: true },
      evidence: { type: DataTypes.TEXT({ length: "long" }), allowNull: true },
      resolution: { type: DataTypes.STRING(32), allowNull: true },
      resolvedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      detectedAt: { type: DataTypes.DATE, allowNull: false },
      lastSeenAt: { type: DataTypes.DATE, allowNull: false },
      resolvedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await queryInterface.addIndex("ContactIdentityIssues", ["status", "severity"]);
    await queryInterface.addIndex("ContactIdentityIssues", ["contactId", "type"]);

    await queryInterface.createTable("ContactQuarkLinks", {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      contactId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      quarkPatientId: { type: DataTypes.STRING(64), allowNull: false },
      status: { type: DataTypes.STRING(16), allowNull: false },
      matchMethod: { type: DataTypes.STRING(32), allowNull: false },
      confidence: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      confirmedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      confirmedAt: { type: DataTypes.DATE, allowNull: true },
      rejectedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await queryInterface.addIndex("ContactQuarkLinks", ["quarkPatientId"]);

    await queryInterface.createTable("ContactIdentityAudits", {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      contactId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      action: { type: DataTypes.STRING(48), allowNull: false },
      source: { type: DataTypes.STRING(24), allowNull: false },
      previousValueHash: { type: DataTypes.STRING(64), allowNull: true },
      newValueHash: { type: DataTypes.STRING(64), allowNull: true },
      metadata: { type: DataTypes.TEXT({ length: "long" }), allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await queryInterface.addIndex("ContactIdentityAudits", ["contactId", "createdAt"]);

    await queryInterface.createTable("OperationalIncidents", {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      incidentKey: { type: DataTypes.STRING(96), allowNull: false, unique: true },
      status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "OPEN" },
      severity: { type: DataTypes.STRING(16), allowNull: false },
      title: { type: DataTypes.STRING(160), allowNull: false },
      detail: { type: DataTypes.TEXT, allowNull: true },
      startedAt: { type: DataTypes.DATE, allowNull: false },
      lastSeenAt: { type: DataTypes.DATE, allowNull: false },
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
    await queryInterface.addIndex("OperationalIncidents", ["status", "severity"]);

    await queryInterface.createTable("AiSuggestions", {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Tickets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      generatedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      model: { type: DataTypes.STRING(64), allowNull: false },
      promptVersion: { type: DataTypes.STRING(32), allowNull: false },
      inputHash: { type: DataTypes.STRING(64), allowNull: false },
      output: { type: DataTypes.TEXT({ length: "long" }), allowNull: false },
      status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: "GENERATED" },
      reviewedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      reviewedOutputHash: { type: DataTypes.STRING(64), allowNull: true },
      copiedAt: { type: DataTypes.DATE, allowNull: true },
      discardedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await queryInterface.addIndex("AiSuggestions", ["ticketId", "createdAt"]);
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.dropTable("AiSuggestions");
    await queryInterface.dropTable("OperationalIncidents");
    await queryInterface.dropTable("ContactIdentityAudits");
    await queryInterface.dropTable("ContactQuarkLinks");
    await queryInterface.dropTable("ContactIdentityIssues");
  }
};
