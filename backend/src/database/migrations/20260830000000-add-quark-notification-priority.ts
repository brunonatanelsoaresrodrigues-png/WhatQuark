import { QueryInterface, DataTypes } from "sequelize";
const TABLE = "QuarkAppointmentNotifications";
const INDEX = "quark_notifications_ready_priority";
module.exports = {
  up: async (query: QueryInterface) => {
    const table = (await query.describeTable(TABLE)) as Record<string, unknown>;
    if (!table.priorityAt)
      await query.addColumn(TABLE, "priorityAt", {
        type: DataTypes.DATE,
        allowNull: true
      });
    await query.sequelize.query(
      `UPDATE ${TABLE} n INNER JOIN QuarkAppointments a ON a.appointmentId = n.appointmentId SET n.priorityAt = a.scheduledAt WHERE n.priorityAt IS NULL`
    );
    const indexes = (await query.showIndex(TABLE)) as { name: string }[];
    if (!indexes.some(index => index.name === INDEX))
      await query.addIndex(TABLE, {
        name: INDEX,
        fields: ["status", "nextAttemptAt", "priorityAt"]
      });
  },
  down: async (query: QueryInterface) => {
    const indexes = (await query.showIndex(TABLE)) as { name: string }[];
    if (indexes.some(index => index.name === INDEX))
      await query.removeIndex(TABLE, INDEX);
    const table = (await query.describeTable(TABLE)) as Record<string, unknown>;
    if (table.priorityAt) await query.removeColumn(TABLE, "priorityAt");
  }
};
