import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) =>
    queryInterface.createTable("PatientIntakeBookings", {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      ticketId: { type: DataTypes.INTEGER, allowNull: false },
      requestKey: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true
      },
      status: { type: DataTypes.STRING(24), allowNull: false },
      agendaId: { type: DataTypes.STRING(64), allowNull: false },
      scheduledAt: { type: DataTypes.DATE, allowNull: false },
      quarkAppointmentId: { type: DataTypes.STRING(64), allowNull: true },
      lastError: { type: DataTypes.STRING(500), allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    }),

  down: (queryInterface: QueryInterface) =>
    queryInterface.dropTable("PatientIntakeBookings")
};
