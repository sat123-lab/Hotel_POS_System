const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('mrbeast_db', 'root', 'Mysql@7785', {
  host: 'localhost',
  dialect: 'mysql',
});

module.exports = sequelize; 