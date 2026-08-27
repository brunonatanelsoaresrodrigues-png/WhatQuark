import { QueryInterface } from "sequelize";

import { ensureWppKeysSchema } from "../wppKeys";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await ensureWppKeysSchema(queryInterface);
  },

  down: async (): Promise<void> => {
    // the previous shape could not be indexed on MySQL/MariaDB, so there is
    // nothing worth rolling back to
  }
};
