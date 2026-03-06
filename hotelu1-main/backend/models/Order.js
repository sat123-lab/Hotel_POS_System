const { DataTypes } = require("sequelize");
const sequelize = require("./sequelize");

const Order = sequelize.define(
  "Order",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    table_name: { type: DataTypes.STRING, allowNull: false },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "preparing",
        "ready",
        "delivered",
        "completed",
        "NOT_AVAILABLE",
      ),
      allowNull: false,
      defaultValue: "pending",
    },
    total: { type: DataTypes.FLOAT, allowNull: false },
    timestamp: { type: DataTypes.DATE, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    bill_requested: { type: DataTypes.BOOLEAN, defaultValue: false },
    delivered_at: { type: DataTypes.DATE, allowNull: true },
    bill_generated: { type: DataTypes.BOOLEAN, defaultValue: false },
    payment_method: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: "orders",
    timestamps: false,
  },
);

module.exports = Order;
