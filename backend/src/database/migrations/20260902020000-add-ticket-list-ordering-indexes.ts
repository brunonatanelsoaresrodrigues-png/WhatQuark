import { QueryInterface } from "sequelize";

const TABLE = "Messages";
const ACTIVITY_INDEX = "messages_ticket_created_at";
const PENDING_INDEX = "messages_ticket_unread_created_at";

const hasIndex = async (
  queryInterface: QueryInterface,
  name: string
): Promise<boolean> => {
  const indexes = (await queryInterface.showIndex(TABLE)) as unknown as Array<{
    name: string;
  }>;
  return indexes.some(index => index.name === name);
};

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    if (!(await hasIndex(queryInterface, ACTIVITY_INDEX))) {
      await queryInterface.addIndex(TABLE, ["ticketId", "createdAt"], {
        name: ACTIVITY_INDEX
      });
    }

    if (!(await hasIndex(queryInterface, PENDING_INDEX))) {
      await queryInterface.addIndex(
        TABLE,
        ["ticketId", "fromMe", "read", "createdAt"],
        { name: PENDING_INDEX }
      );
    }
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    if (await hasIndex(queryInterface, PENDING_INDEX)) {
      await queryInterface.removeIndex(TABLE, PENDING_INDEX);
    }

    if (await hasIndex(queryInterface, ACTIVITY_INDEX)) {
      await queryInterface.removeIndex(TABLE, ACTIVITY_INDEX);
    }
  }
};
