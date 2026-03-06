const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');

const Inventory = sequelize.define('Inventory', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  currentStock: { type: DataTypes.FLOAT, allowNull: false },
  minStock: { type: DataTypes.FLOAT, allowNull: false },
}, {
  tableName: 'inventory',
  timestamps: false,
});

module.exports = Inventory; 