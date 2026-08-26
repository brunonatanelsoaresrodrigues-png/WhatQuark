import { DataTypes, QueryInterface } from "sequelize";

const TABLE = "QuarkAppointmentNotifications";
const INDEX = "quark_notifications_ready_priority";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = (await queryInterface.describeTable(TABLE)) as Record<
      string,
      unknown
    >;
    if (!table.priorityAt) {
      await queryInterface.addColumn(TABLE, "priorityAt", {
        type: DataTypes.DATE,
        allowNull: true
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE ${TABLE} n
      INNER JOIN QuarkAppointments a ON a.appointmentId = n.appointmentId
      SET n.priorityAt = a.scheduledAt
      WHERE n.priorityAt IS NULL
    `);

    const indexes = (await queryInterface.showIndex(TABLE)) as Array<{
      name?: string;
    }>;
    if (!indexes.some(index => index.name === INDEX)) {
      await queryInterface.addIndex(TABLE, {
        name: INDEX,
        fields: ["status", "nextAttemptAt", "priorityAt"]
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const indexes = (await queryInterface.showIndex(TABLE)) as Array<{
      name?: string;
    }>;
    if (indexes.some(index => index.name === INDEX)) {
      await queryInterface.removeIndex(TABLE, INDEX);
    }

    const table = (await queryInterface.describeTable(TABLE)) as Record<
      string,
      unknown
    >;
    if (table.priorityAt) {
      await queryInterface.removeColumn(TABLE, "priorityAt");
    }
  }
};
