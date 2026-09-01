import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const indexes = (await queryInterface.showIndex(
      "QuarkAppointments"
    )) as Array<{ name?: string }>;
    const alreadyExists = indexes.some(
      index => index.name === "quark_appointments_scheduled_at"
    );

    if (!alreadyExists) {
      await queryInterface.addIndex("QuarkAppointments", {
        name: "quark_appointments_scheduled_at",
        fields: ["scheduledAt"]
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const indexes = (await queryInterface.showIndex(
      "QuarkAppointments"
    )) as Array<{ name?: string }>;
    const exists = indexes.some(
      index => index.name === "quark_appointments_scheduled_at"
    );

    if (exists) {
      await queryInterface.removeIndex(
        "QuarkAppointments",
        "quark_appointments_scheduled_at"
      );
    }
  }
};
