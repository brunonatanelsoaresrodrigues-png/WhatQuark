import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Messages", "sentByUserId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });
    await queryInterface.addColumn("Messages", "origin", {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: "UNKNOWN"
    });
    await queryInterface.addColumn("Contacts", "isInternal", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.addColumn("Tickets", "ticketType", {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "PATIENT"
    });

    await queryInterface.addIndex("Messages", {
      name: "messages_origin_created_at",
      fields: ["origin", "createdAt"]
    });
    await queryInterface.addIndex("Messages", {
      name: "messages_sender_created_at",
      fields: ["sentByUserId", "createdAt"]
    });
    await queryInterface.addIndex("Tickets", {
      name: "tickets_type_status",
      fields: ["ticketType", "status"]
    });

    await queryInterface.createTable("MessageAttributions", {
      messageId: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
      },
      sentByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      origin: {
        type: DataTypes.STRING(24),
        allowNull: false
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.createTable("TicketEvents", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Tickets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      eventType: { type: DataTypes.STRING(32), allowNull: false },
      performedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      previousUserId: { type: DataTypes.INTEGER, allowNull: true },
      newUserId: { type: DataTypes.INTEGER, allowNull: true },
      previousQueueId: { type: DataTypes.INTEGER, allowNull: true },
      newQueueId: { type: DataTypes.INTEGER, allowNull: true },
      metadata: { type: DataTypes.TEXT, allowNull: true },
      occurredAt: { type: DataTypes.DATE, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await queryInterface.addIndex("TicketEvents", {
      name: "ticket_events_ticket_date",
      fields: ["ticketId", "occurredAt"]
    });
    await queryInterface.addIndex("TicketEvents", {
      name: "ticket_events_type_date",
      fields: ["eventType", "occurredAt"]
    });
    await queryInterface.addIndex("TicketEvents", {
      name: "ticket_events_actor_date",
      fields: ["performedByUserId", "occurredAt"]
    });

    await queryInterface.createTable("QuarkAppointmentEvents", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      appointmentId: { type: DataTypes.STRING(64), allowNull: false },
      eventType: { type: DataTypes.STRING(32), allowNull: false },
      previousStatus: { type: DataTypes.STRING(64), allowNull: true },
      newStatus: { type: DataTypes.STRING(64), allowNull: true },
      previousScheduledAt: { type: DataTypes.DATE, allowNull: true },
      newScheduledAt: { type: DataTypes.DATE, allowNull: true },
      previousProfessionalId: { type: DataTypes.STRING(64), allowNull: true },
      newProfessionalId: { type: DataTypes.STRING(64), allowNull: true },
      previousProcedureId: { type: DataTypes.STRING(64), allowNull: true },
      newProcedureId: { type: DataTypes.STRING(64), allowNull: true },
      source: { type: DataTypes.STRING(32), allowNull: false },
      metadata: { type: DataTypes.TEXT, allowNull: true },
      occurredAt: { type: DataTypes.DATE, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await queryInterface.addIndex("QuarkAppointmentEvents", {
      name: "quark_appointment_events_appointment_date",
      fields: ["appointmentId", "occurredAt"]
    });
    await queryInterface.addIndex("QuarkAppointmentEvents", {
      name: "quark_appointment_events_type_date",
      fields: ["eventType", "occurredAt"]
    });

    await queryInterface.createTable("DailyReportRecipients", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      name: { type: DataTypes.STRING(120), allowNull: false },
      phone: { type: DataTypes.STRING(15), allowNull: false, unique: true },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      verifiedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await queryInterface.createTable("DailyReportRuns", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      reportDate: { type: DataTypes.DATEONLY, allowNull: false },
      runType: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "DAILY"
      },
      periodStart: { type: DataTypes.DATE, allowNull: false },
      periodEnd: { type: DataTypes.DATE, allowNull: false },
      timezone: { type: DataTypes.STRING(64), allowNull: false },
      status: { type: DataTypes.STRING(24), allowNull: false },
      snapshot: { type: DataTypes.TEXT, allowNull: true },
      renderedBody: { type: DataTypes.TEXT, allowNull: true },
      dataFreshness: { type: DataTypes.DATE, allowNull: true },
      generatedAt: { type: DataTypes.DATE, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },
      lastError: { type: DataTypes.STRING(512), allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await queryInterface.addIndex("DailyReportRuns", {
      name: "daily_report_runs_period_unique",
      unique: true,
      fields: ["reportDate", "timezone", "runType"]
    });

    await queryInterface.createTable("DailyReportRecipientEvents", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      recipientId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "DailyReportRecipients", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      performedByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      eventType: { type: DataTypes.STRING(24), allowNull: false },
      metadata: { type: DataTypes.TEXT, allowNull: true },
      occurredAt: { type: DataTypes.DATE, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await queryInterface.addIndex("DailyReportRecipientEvents", {
      name: "daily_report_recipient_events_date",
      fields: ["recipientId", "occurredAt"]
    });

    await queryInterface.createTable("DailyReportDeliveries", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      reportRunId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "DailyReportRuns", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      recipientId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "DailyReportRecipients", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT"
      },
      ticketId: { type: DataTypes.INTEGER, allowNull: true },
      status: { type: DataTypes.STRING(24), allowNull: false },
      attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      nextAttemptAt: { type: DataTypes.DATE, allowNull: false },
      processingStartedAt: { type: DataTypes.DATE, allowNull: true },
      workerId: { type: DataTypes.STRING(64), allowNull: true },
      messageId: { type: DataTypes.STRING, allowNull: true },
      sentAt: { type: DataTypes.DATE, allowNull: true },
      deliveredAt: { type: DataTypes.DATE, allowNull: true },
      readAt: { type: DataTypes.DATE, allowNull: true },
      lastError: { type: DataTypes.STRING(512), allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
    await queryInterface.addIndex("DailyReportDeliveries", {
      name: "daily_report_delivery_unique",
      unique: true,
      fields: ["reportRunId", "recipientId"]
    });
    await queryInterface.addIndex("DailyReportDeliveries", {
      name: "daily_report_delivery_due",
      fields: ["status", "nextAttemptAt"]
    });
    await queryInterface.addIndex("DailyReportDeliveries", {
      name: "daily_report_delivery_message",
      fields: ["messageId"]
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("DailyReportDeliveries");
    await queryInterface.dropTable("DailyReportRecipientEvents");
    await queryInterface.dropTable("DailyReportRuns");
    await queryInterface.dropTable("DailyReportRecipients");
    await queryInterface.dropTable("QuarkAppointmentEvents");
    await queryInterface.dropTable("TicketEvents");
    await queryInterface.dropTable("MessageAttributions");
    await queryInterface.removeIndex("Tickets", "tickets_type_status");
    await queryInterface.removeIndex("Messages", "messages_sender_created_at");
    await queryInterface.removeIndex("Messages", "messages_origin_created_at");
    await queryInterface.removeColumn("Tickets", "ticketType");
    await queryInterface.removeColumn("Contacts", "isInternal");
    await queryInterface.removeColumn("Messages", "origin");
    await queryInterface.removeColumn("Messages", "sentByUserId");
  }
};
