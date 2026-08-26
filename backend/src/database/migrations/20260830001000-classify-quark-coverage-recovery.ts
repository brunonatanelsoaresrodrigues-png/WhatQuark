import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE QuarkAppointmentNotifications
      SET eventType = 'COVERAGE_RECOVERY'
      WHERE eventType = 'CREATED'
        AND notificationKey LIKE 'coverage-recovery:3:%'
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE QuarkAppointmentNotifications
      SET eventType = 'CREATED'
      WHERE eventType = 'COVERAGE_RECOVERY'
        AND notificationKey LIKE 'coverage-recovery:3:%'
    `);
  }
};
