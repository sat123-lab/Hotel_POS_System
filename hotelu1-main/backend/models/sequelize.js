const { Sequelize } = require('sequelize');

require('dotenv').config();

// Temporary MySQL connection test using mysql2/promise before Sequelize initializes
(async function testMySqlConnection() {
  try {
    const mysql = require('mysql2/promise');
    
    console.log('=== TEMPORARY MYSQL CONNECTION TEST ===');
    console.log('Attempting direct MySQL connection using mysql2/promise...');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('✓ MySQL connection successful');
    
    const [rows] = await connection.execute('SELECT CURRENT_USER(), USER(), DATABASE(), VERSION()');
    console.log('Query result:', rows[0]);
    
    await connection.end();
    console.log('✓ Connection closed');
    console.log('=== MYSQL CONNECTION TEST COMPLETED ===\n');
    
  } catch (error) {
    console.error('✗ MySQL connection test FAILED');
    console.error('=== COMPLETE RAW MYSQL ERROR OBJECT ===');
    console.error('code:', error.code);
    console.error('errno:', error.errno);
    console.error('sqlState:', error.sqlState);
    console.error('sqlMessage:', error.sqlMessage);
    console.error('fatal:', error.fatal);
    console.error('stack:', error.stack);
    console.error('======================================\n');
  }
})();

// Debug: Log environment variable loading in sequelize.js
console.log('=== SEQUELIZE ENV DEBUG ===');
console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT SET');
console.log('DB_HOST:', process.env.DB_HOST || 'NOT SET');
console.log('DB_NAME:', process.env.DB_NAME || 'NOT SET');
console.log('DB_USER:', process.env.DB_USER || 'NOT SET');
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'SET' : 'NOT SET');
console.log('DB_PORT:', process.env.DB_PORT || 'NOT SET');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('===========================');

/**
 * Backend supports two ways to connect:
 * 1. DATABASE_URL  e.g. postgres://user:pass@host:5432/dbname
 *                       mysql://user:pass@host:3306/dbname
 * 2. Discrete vars: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_DIALECT
 *
 * Render PostgreSQL  -> use DATABASE_URL (Internal Database URL)
 * Aiven / Clever MySQL / local -> use DB_* vars or DATABASE_URL
 */

const useSSL = process.env.DB_SSL === 'true';

const sslOptions = useSSL
  ? { require: true, rejectUnauthorized: false }
  : false;

let sequelize;

if (process.env.DATABASE_URL) {
  const url = process.env.DATABASE_URL;
  const dialect =
    process.env.DB_DIALECT ||
    (url.startsWith('postgres') ? 'postgres' : 'mysql');

  sequelize = new Sequelize(url, {
    dialect,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: { ssl: sslOptions },
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  });
} else {
  const dialect = process.env.DB_DIALECT || 'mysql';
  sequelize = new Sequelize(
    process.env.DB_NAME || 'mrbeast_db',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || (dialect === 'postgres' ? 5432 : 3306),
      dialect,
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      dialectOptions: { ssl: sslOptions },
      pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    }
  );
}

module.exports = sequelize;
