import database from "../../database";

const truncate = async (): Promise<void> => {
  // MariaDB does not implement TRUNCATE ... CASCADE. Keep referential checks
  // disabled only for the duration of this serial test cleanup so newly added
  // tables with foreign keys cannot make otherwise unrelated suites flaky.
  await database.query("SET FOREIGN_KEY_CHECKS = 0");

  try {
    await database.truncate({ force: true, cascade: true });
  } finally {
    await database.query("SET FOREIGN_KEY_CHECKS = 1");
  }
};

const disconnect = async (): Promise<void> => {
  return database.connectionManager.close();
};

export { truncate, disconnect };
