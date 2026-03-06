const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");

const RolePermission = sequelize.define(
  "RolePermission",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "roles", key: "id" },
    },
    permissionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "permissions", key: "id" },
    },
  },
  {
    tableName: "role_permissions",
    timestamps: false,
  }
);

module.exports = RolePermission;
