import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("QuarkAppointments", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      appointmentId: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true
      },
      patientId: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      phone: {
        type: DataTypes.STRING(32),
        allowNull: true
      },
      patientName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      status: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      scheduledAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      scheduleFingerprint: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      snapshotFingerprint: {
        type: DataTypes.STRING(64),
        allowNull: false
      },
      snapshot: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      awaitingConfirmation: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      confirmationRequestedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      lastSeenAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      firstSeenAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      lastChangedAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      baselineImported: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      fingerprintVersion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
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

    await queryInterface.createTable("QuarkAppointmentNotifications", {
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
      notificationKey: {
        type: DataTypes.STRING(128),
        allowNull: false
      },
      eventType: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      payload: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      nextAttemptAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      processingStartedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      workerId: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      sentAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      lastError: {
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

    await queryInterface.addIndex("QuarkAppointmentNotifications", {
      name: "quark_notification_unique",
      unique: true,
      fields: ["appointmentId", "notificationKey"]
    });

    await queryInterface.addIndex("QuarkAppointmentNotifications", {
      name: "quark_notification_worker",
      fields: ["status", "nextAttemptAt"]
    });

    await queryInterface.addIndex("QuarkAppointments", {
      name: "quark_appointments_phone_pending",
      fields: ["phone", "awaitingConfirmation", "scheduledAt"]
    });

    await queryInterface.createTable("QuarkSyncStates", {
      key: {
        type: DataTypes.STRING(64),
        primaryKey: true,
        allowNull: false
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      baselineStartedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      baselineCompletedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      lastSuccessfulSyncAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      syncLockUntil: {
        type: DataTypes.DATE,
        allowNull: true
      },
      syncWorkerId: {
        type: DataTypes.STRING(64),
        allowNull: true
      },
      fingerprintVersion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
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
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("QuarkSyncStates");
    await queryInterface.dropTable("QuarkAppointmentNotifications");
    await queryInterface.dropTable("QuarkAppointments");
  }
};
