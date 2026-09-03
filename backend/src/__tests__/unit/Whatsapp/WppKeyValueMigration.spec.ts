import { DataTypes } from "sequelize";

const migration = require("../../../database/migrations/20260903010000-expand-whatsapp-sync-key-value");
const queryInterface = () => ({
  changeColumn: jest.fn(),
  sequelize: { query: jest.fn().mockResolvedValue([[], {}]) }
});

it("expands sync-key storage without changing or removing records", async () => {
  const qi = queryInterface();
  await migration.up(qi);
  expect(qi.changeColumn).toHaveBeenCalledWith("WppKeys", "value", {
    type: DataTypes.TEXT({ length: "long" }),
    allowNull: false
  });
});

it("refuses a rollback that could truncate saved credentials", async () => {
  const qi = queryInterface();
  qi.sequelize.query.mockResolvedValue([[{ id: 1 }], {}]);
  await expect(migration.down(qi)).rejects.toThrow(
    "without losing saved WhatsApp sync keys"
  );
  expect(qi.changeColumn).not.toHaveBeenCalled();
});

it("permits a safe rollback only after checking stored lengths", async () => {
  const qi = queryInterface();
  await migration.down(qi);
  expect(qi.sequelize.query).toHaveBeenCalledWith(
    expect.stringContaining("OCTET_LENGTH(value) > 65535")
  );
  expect(qi.changeColumn).toHaveBeenCalledWith("WppKeys", "value", {
    type: DataTypes.TEXT,
    allowNull: false
  });
});
