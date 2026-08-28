import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Tickets", "awaitingPatientSince", {
      type: DataTypes.DATE,
      allowNull: true
    });
    await queryInterface.addColumn("Tickets", "inactivityClosingAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
    await queryInterface.addColumn("Tickets", "inactivityNoticeSentAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
    await queryInterface.addColumn("Tickets", "inactivityNoticeMessageId", {
      type: DataTypes.STRING,
      allowNull: true
    });
    await queryInterface.addColumn("Tickets", "closedByInactivity", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.addColumn("Tickets", "inactivityPreviousUserId", {
      type: DataTypes.INTEGER,
      allowNull: true
    });

    await queryInterface.addIndex("Tickets", {
      name: "tickets_awaiting_patient_due",
      fields: ["status", "awaitingPatientSince", "inactivityClosingAt"]
    });
    await queryInterface.addIndex("Tickets", {
      name: "tickets_closed_by_inactivity",
      fields: ["contactId", "whatsappId", "closedByInactivity"]
    });

    await queryInterface.createTable("TicketInactivityEvents", {
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
      eventType: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      reason: {
        type: DataTypes.STRING(128),
        allowNull: false
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      messageId: {
        type: DataTypes.STRING,
        allowNull: true
      },
      occurredAt: {
        type: DataTypes.DATE,
        allowNull: false
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

    await queryInterface.addIndex("TicketInactivityEvents", {
      name: "ticket_inactivity_events_ticket_date",
      fields: ["ticketId", "occurredAt"]
    });
    await queryInterface.addIndex("TicketInactivityEvents", {
      name: "ticket_inactivity_events_type_date",
      fields: ["eventType", "occurredAt"]
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("TicketInactivityEvents");
    await queryInterface.removeIndex("Tickets", "tickets_closed_by_inactivity");
    await queryInterface.removeIndex("Tickets", "tickets_awaiting_patient_due");
    await queryInterface.removeColumn("Tickets", "inactivityPreviousUserId");
    await queryInterface.removeColumn("Tickets", "closedByInactivity");
    await queryInterface.removeColumn("Tickets", "inactivityNoticeMessageId");
    await queryInterface.removeColumn("Tickets", "inactivityNoticeSentAt");
    await queryInterface.removeColumn("Tickets", "inactivityClosingAt");
    await queryInterface.removeColumn("Tickets", "awaitingPatientSince");
  }
};
