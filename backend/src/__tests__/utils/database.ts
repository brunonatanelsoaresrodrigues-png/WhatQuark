import database from "../../database";

const truncate = async (): Promise<void> => {
  if (
    process.env.NODE_ENV !== "test" ||
    !/(^|_)test($|_)/i.test(process.env.DB_NAME || "")
  ) {
    throw new Error(
      "Integration tests require a dedicated database with test in its name"
    );
  }
  await database.truncate({ force: true, cascade: true });
};

const disconnect = async (): Promise<void> => {
  return database.connectionManager.close();
};

export { truncate, disconnect };
