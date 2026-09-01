import { QueryInterface } from "sequelize";
module.exports = {
  up: async (query: QueryInterface) => {
    await query.sequelize.query(
      "UPDATE QuarkAppointmentNotifications SET eventType = 'COVERAGE_RECOVERY' WHERE eventType = 'CREATED' AND notificationKey LIKE 'coverage-recovery:3:%'"
    );
  },
  down: async (query: QueryInterface) => {
    await query.sequelize.query(
      "UPDATE QuarkAppointmentNotifications SET eventType = 'CREATED' WHERE eventType = 'COVERAGE_RECOVERY' AND notificationKey LIKE 'coverage-recovery:3:%'"
    );
  }
};
