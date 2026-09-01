import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (query: QueryInterface) => {
    await query.createTable("AutomationStates", {
      id: { type: DataTypes.STRING(191), primaryKey: true, allowNull: false },
      data: { type: DataTypes.TEXT, allowNull: false },
      lockOwner: { type: DataTypes.STRING(64), allowNull: true },
      lockedUntil: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await query.createTable("OutboundMessages", {
      id: { type: DataTypes.STRING(64), primaryKey: true, allowNull: false },
      whatsappId: { type: DataTypes.INTEGER, allowNull: false },
      recipient: { type: DataTypes.STRING(64), allowNull: false },
      kind: { type: DataTypes.STRING(16), allowNull: false },
      payload: { type: DataTypes.TEXT({ length: "long" }), allowNull: false },
      status: { type: DataTypes.STRING(16), allowNull: false },
      priority: { type: DataTypes.INTEGER, allowNull: false },
      dueAt: { type: DataTypes.DATE, allowNull: false },
      attemptedAt: { type: DataTypes.DATE, allowNull: true },
      finishedAt: { type: DataTypes.DATE, allowNull: true },
      messageId: { type: DataTypes.STRING(128), allowNull: true },
      result: { type: DataTypes.TEXT, allowNull: true },
      errorCode: { type: DataTypes.STRING(128), allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await query.addIndex("OutboundMessages", ["status", "dueAt"]);
    await query.addIndex("OutboundMessages", ["whatsappId", "attemptedAt"]);
    await query.addIndex("OutboundMessages", ["recipient", "attemptedAt"]);
    await query.addColumn("QuarkAppointmentResponses", "actorUserId", {
      type: DataTypes.INTEGER,
      allowNull: true
    });
  },
  down: async (query: QueryInterface) => {
    await query.removeColumn("QuarkAppointmentResponses", "actorUserId");
    await query.dropTable("OutboundMessages");
    await query.dropTable("AutomationStates");
  }
};
