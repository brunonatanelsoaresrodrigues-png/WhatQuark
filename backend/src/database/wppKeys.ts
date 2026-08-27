import { QueryInterface, DataTypes } from "sequelize";

export const WPP_KEYS_TABLE = "WppKeys";
export const WPP_KEYS_UNIQUE_INDEX = "wpp_keys_connection_type_key_unique";

export const WPP_KEYS_TYPE_LENGTH = 64;
export const WPP_KEYS_KEY_ID_LENGTH = 255;

const quoteIdentifier = (queryInterface: QueryInterface, name: string) => {
  const dialect = queryInterface.sequelize.getDialect();
  const quote = dialect === "mysql" || dialect === "mariadb" ? "`" : '"';

  return `${quote}${name}${quote}`;
};

const dropOversizedKeys = async (queryInterface: QueryInterface) => {
  const table = quoteIdentifier(queryInterface, WPP_KEYS_TABLE);
  const type = quoteIdentifier(queryInterface, "type");
  const keyId = quoteIdentifier(queryInterface, "keyId");

  await queryInterface.sequelize.query(
    `DELETE FROM ${table} WHERE LENGTH(${type}) > ${WPP_KEYS_TYPE_LENGTH} OR LENGTH(${keyId}) > ${WPP_KEYS_KEY_ID_LENGTH}`
  );
};

const dropDuplicatedKeys = async (queryInterface: QueryInterface) => {
  const table = quoteIdentifier(queryInterface, WPP_KEYS_TABLE);
  const id = quoteIdentifier(queryInterface, "id");
  const connectionId = quoteIdentifier(queryInterface, "connectionId");
  const type = quoteIdentifier(queryInterface, "type");
  const keyId = quoteIdentifier(queryInterface, "keyId");
  const keep = quoteIdentifier(queryInterface, "keep");

  await queryInterface.sequelize.query(
    `DELETE FROM ${table} WHERE ${id} NOT IN (
       SELECT ${id} FROM (
         SELECT MAX(${id}) AS ${id} FROM ${table}
         GROUP BY ${connectionId}, ${type}, ${keyId}
       ) AS ${keep}
     )`
  );
};

const removeIndexIfExists = async (queryInterface: QueryInterface) => {
  try {
    await queryInterface.removeIndex(WPP_KEYS_TABLE, WPP_KEYS_UNIQUE_INDEX);
  } catch (err) {
    // index was never created, nothing to remove
  }
};

/**
 * Brings WppKeys to the shape the Baileys key store depends on.
 *
 * The columns must be VARCHAR: MySQL/MariaDB refuse to index TEXT columns
 * without a prefix length, so the unique index silently never existed there.
 * Without that index `WppKey.upsert` inserts a new row on every write and
 * reads return the oldest value, which corrupts the signal keys and keeps the
 * session from ever pairing.
 */
export const ensureWppKeysSchema = async (
  queryInterface: QueryInterface
): Promise<void> => {
  // both deletes run before the ALTERs: a table that lived without the unique
  // index has a row per write, and rebuilding all of that just to throw it
  // away afterwards is the slow way around
  await dropOversizedKeys(queryInterface);
  await dropDuplicatedKeys(queryInterface);

  await queryInterface.changeColumn(WPP_KEYS_TABLE, "type", {
    type: DataTypes.STRING(WPP_KEYS_TYPE_LENGTH),
    allowNull: false
  });

  await queryInterface.changeColumn(WPP_KEYS_TABLE, "keyId", {
    type: DataTypes.STRING(WPP_KEYS_KEY_ID_LENGTH),
    allowNull: false
  });

  await removeIndexIfExists(queryInterface);

  await queryInterface.addIndex(
    WPP_KEYS_TABLE,
    ["connectionId", "type", "keyId"],
    {
      unique: true,
      name: WPP_KEYS_UNIQUE_INDEX
    }
  );
};
