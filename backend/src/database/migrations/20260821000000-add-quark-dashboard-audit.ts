import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("QuarkAppointmentNotifications", "messageId", {
      type: DataTypes.STRING,
      allowNull: true
    });
    await queryInterface.addColumn("QuarkAppointmentNotifications", "ticketId", {
      type: DataTypes.INTEGER,
      allowNull: true
    });
    await queryInterface.addColumn(
      "QuarkAppointmentNotifications",
      "deliveredAt",
      {
        type: DataTypes.DATE,
        allowNull: true
      }
    );
    await queryInterface.addColumn("QuarkAppointmentNotifications", "readAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    await queryInterface.addIndex("QuarkAppointmentNotifications", {
      name: "quark_notification_message_id",
      fields: ["messageId"]
    });
    await queryInterface.addIndex("QuarkAppointmentNotifications", {
      name: "quark_notification_metrics_date",
      fields: ["createdAt"]
    });

    await queryInterface.createTable("QuarkAppointmentResponses", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      appointmentId: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      notificationId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      decision: {
        type: DataTypes.STRING(16),
        allowNull: false
      },
      source: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "WHATSAPP"
      },
      status: {
        type: DataTypes.STRING(16),
        allowNull: false
      },
      previousQuarkStatus: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      newQuarkStatus: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      receivedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      appliedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      responseTimeSeconds: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      errorCode: {
        type: DataTypes.STRING(512),
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex("QuarkAppointmentResponses", {
      name: "quark_response_appointment",
      fields: ["appointmentId", "receivedAt"]
    });
    await queryInterface.addIndex("QuarkAppointmentResponses", {
      name: "quark_response_metrics",
      fields: ["status", "decision", "receivedAt"]
    });
    await queryInterface.addIndex("QuarkAppointmentResponses", {
      name: "quark_response_received_at",
      fields: ["receivedAt"]
    });
    await queryInterface.addIndex("QuarkAppointments", {
      name: "quark_appointments_scheduled_at",
      fields: ["scheduledAt"]
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("QuarkAppointmentResponses");
    await queryInterface.removeIndex(
      "QuarkAppointments",
      "quark_appointments_scheduled_at"
    );
    await queryInterface.removeIndex(
      "QuarkAppointmentNotifications",
      "quark_notification_metrics_date"
    );
    await queryInterface.removeIndex(
      "QuarkAppointmentNotifications",
      "quark_notification_message_id"
    );
    await queryInterface.removeColumn(
      "QuarkAppointmentNotifications",
      "readAt"
    );
    await queryInterface.removeColumn(
      "QuarkAppointmentNotifications",
      "deliveredAt"
    );
    await queryInterface.removeColumn(
      "QuarkAppointmentNotifications",
      "ticketId"
    );
    await queryInterface.removeColumn(
      "QuarkAppointmentNotifications",
      "messageId"
    );
  }
};
