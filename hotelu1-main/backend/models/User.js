const { DataTypes } = require('sequelize');
const sequelize = require('./sequelize');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  // unique is enforced in DB; avoid Sequelize alter adding duplicate indexes
  username: { type: DataTypes.STRING, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  subfranchise_id: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'users',
  timestamps: false,
});

module.exports = User; 