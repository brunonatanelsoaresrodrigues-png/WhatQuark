import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.changeColumn("WppKeys", "value", {
      type: DataTypes.TEXT({ length: "long" }),
      allowNull: false
    });
  },
  down: async (queryInterface: QueryInterface): Promise<void> => {
    const [oversized] = await queryInterface.sequelize.query(
      "SELECT id FROM WppKeys WHERE OCTET_LENGTH(value) > 65535 LIMIT 1"
    );
    if (oversized.length)
      throw new Error(
        "Cannot shrink WppKeys.value without losing saved WhatsApp sync keys"
      );
    await queryInterface.changeColumn("WppKeys", "value", {
      type: DataTypes.TEXT,
      allowNull: false
    });
  }
};
