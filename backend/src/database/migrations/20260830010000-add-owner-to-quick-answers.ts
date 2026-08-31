import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.addColumn("QuickAnswers", "userId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    });
    await queryInterface.addIndex("QuickAnswers", ["userId"], {
      name: "quick_answers_user_id"
    });
  },
  down: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.removeIndex("QuickAnswers", "quick_answers_user_id");
    await queryInterface.removeColumn("QuickAnswers", "userId");
  }
};
