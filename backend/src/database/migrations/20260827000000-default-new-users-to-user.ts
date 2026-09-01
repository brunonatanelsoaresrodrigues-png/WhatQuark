import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) =>
    queryInterface.changeColumn("Users", "profile", {
      type: DataTypes.STRING,
      defaultValue: "user"
    }),
  down: (queryInterface: QueryInterface) =>
    queryInterface.changeColumn("Users", "profile", {
      type: DataTypes.STRING,
      defaultValue: "admin"
    })
};
