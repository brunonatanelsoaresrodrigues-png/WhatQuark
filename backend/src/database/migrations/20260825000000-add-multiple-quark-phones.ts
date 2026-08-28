import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("QuarkAppointments", "phones", {
      type: DataTypes.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn(
      "QuarkAppointmentNotifications",
      "recipientPhone",
      {
        type: DataTypes.STRING(32),
        allowNull: true
      }
    );
    await queryInterface.addColumn(
      "QuarkAppointmentResponses",
      "recipientPhone",
      {
        type: DataTypes.STRING(32),
        allowNull: true
      }
    );

    await queryInterface.createTable("QuarkAppointmentRecipients", {
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
      phone: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      source: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      isPrimary: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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

    await queryInterface.sequelize.query(`
      UPDATE QuarkAppointments
      SET phones = CASE
        WHEN phone IS NULL OR phone = '' THEN '[]'
        ELSE JSON_ARRAY(phone)
      END
    `);
    await queryInterface.sequelize.query(`
      INSERT INTO QuarkAppointmentRecipients
        (appointmentId, phone, source, isPrimary, active, createdAt, updatedAt)
      SELECT appointmentId, phone, 'LEGACY', 1, 1, NOW(), NOW()
      FROM QuarkAppointments
      WHERE phone IS NOT NULL AND phone <> ''
    `);
    await queryInterface.sequelize.query(`
      UPDATE QuarkAppointmentNotifications
      SET recipientPhone = JSON_UNQUOTE(JSON_EXTRACT(payload, '$.phone'))
      WHERE JSON_VALID(payload) = 1
        AND JSON_EXTRACT(payload, '$.phone') IS NOT NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE QuarkAppointmentNotifications
      SET notificationKey = CONCAT(
        notificationKey,
        ':to:',
        LEFT(SHA2(CONCAT('"', recipientPhone, '"'), 256), 16)
      )
      WHERE recipientPhone IS NOT NULL
        AND notificationKey NOT LIKE '%:to:%'
    `);
    await queryInterface.sequelize.query(`
      UPDATE QuarkAppointmentResponses r
      INNER JOIN QuarkAppointmentNotifications n ON n.id = r.notificationId
      SET r.recipientPhone = n.recipientPhone
      WHERE r.notificationId IS NOT NULL
    `);

    await queryInterface.changeColumn("QuarkAppointments", "phones", {
      type: DataTypes.TEXT,
      allowNull: false
    });
    await queryInterface.addIndex("QuarkAppointmentRecipients", {
      name: "quark_recipient_unique",
      unique: true,
      fields: ["appointmentId", "phone"]
    });
    await queryInterface.addIndex("QuarkAppointmentRecipients", {
      name: "quark_recipient_phone_active",
      fields: ["phone", "active", "appointmentId"]
    });
    await queryInterface.addIndex("QuarkAppointmentNotifications", {
      name: "quark_notification_recipient",
      fields: ["appointmentId", "recipientPhone", "sentAt"]
    });
    await queryInterface.addIndex("QuarkAppointmentResponses", {
      name: "quark_response_recipient",
      fields: ["appointmentId", "recipientPhone", "receivedAt"]
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "QuarkAppointmentResponses",
      "quark_response_recipient"
    );
    await queryInterface.removeIndex(
      "QuarkAppointmentNotifications",
      "quark_notification_recipient"
    );
    await queryInterface.dropTable("QuarkAppointmentRecipients");
    await queryInterface.removeColumn(
      "QuarkAppointmentResponses",
      "recipientPhone"
    );
    await queryInterface.removeColumn(
      "QuarkAppointmentNotifications",
      "recipientPhone"
    );
    await queryInterface.removeColumn("QuarkAppointments", "phones");
  }
};
