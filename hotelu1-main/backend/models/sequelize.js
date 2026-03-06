const { Sequelize } = require('sequelize');

// Load environment variables from .env when running locally (Render and Railway provide env vars automatically)
require('dotenv').config();

// Production-ready Sequelize instance configured via environment variables
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        // For self-signed certificates you might need to disable verification
        rejectUnauthorized: false,
      },
    },
  }
);

module.exports = sequelize;
