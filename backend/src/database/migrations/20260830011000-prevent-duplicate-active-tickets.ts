import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.sequelize.query(`
      ALTER TABLE Tickets
      ADD COLUMN activeIdentity VARCHAR(191) NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE Tickets
      SET activeIdentity = CASE
        WHEN status IN ('open', 'pending')
        THEN CONCAT(contactId, ':', IFNULL(whatsappId, 0), ':', IFNULL(ticketType, 'human'))
        ELSE NULL
      END
    `);
    await queryInterface.addIndex("Tickets", ["activeIdentity"], {
      name: "tickets_one_active_identity",
      unique: true
    });
    await queryInterface.sequelize.query(`
      CREATE TRIGGER tickets_active_identity_before_insert
      BEFORE INSERT ON Tickets
      FOR EACH ROW
      SET NEW.activeIdentity = CASE
        WHEN NEW.status IN ('open', 'pending')
        THEN CONCAT(NEW.contactId, ':', IFNULL(NEW.whatsappId, 0), ':', IFNULL(NEW.ticketType, 'human'))
        ELSE NULL
      END
    `);
    await queryInterface.sequelize.query(`
      CREATE TRIGGER tickets_active_identity_before_update
      BEFORE UPDATE ON Tickets
      FOR EACH ROW
      SET NEW.activeIdentity = CASE
        WHEN NEW.status IN ('open', 'pending')
        THEN CONCAT(NEW.contactId, ':', IFNULL(NEW.whatsappId, 0), ':', IFNULL(NEW.ticketType, 'human'))
        ELSE NULL
      END
    `);
  },
  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.sequelize.query(
      "DROP TRIGGER IF EXISTS tickets_active_identity_before_update"
    );
    await queryInterface.sequelize.query(
      "DROP TRIGGER IF EXISTS tickets_active_identity_before_insert"
    );
    await queryInterface.removeIndex("Tickets", "tickets_one_active_identity");
    await queryInterface.removeColumn("Tickets", "activeIdentity");
  }
};
