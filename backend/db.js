const mysql = require('mysql2/promise');
require('dotenv').config();

// Three different database configurations
const dbConfigs = [
  {
    host: process.env.DB1_HOST,
    port: process.env.DB1_PORT,
    database: process.env.DB1_DATABASE,
    user: process.env.DB1_USER,
    password: process.env.DB1_PASSWORD
  },
  {
    host: process.env.DB2_HOST,
    port: process.env.DB2_PORT,
    database: process.env.DB2_DATABASE,
    user: process.env.DB2_USER,
    password: process.env.DB2_PASSWORD
  },
  {
    host: process.env.DB3_HOST,
    port: process.env.DB3_PORT,
    database: process.env.DB3_DATABASE,
    user: process.env.DB3_USER,
    password: process.env.DB3_PASSWORD
  }
];

const pools = dbConfigs.map(cfg =>
  mysql.createPool({
    ...cfg,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10
  })
);

async function testConnections() {
  for (let i = 0; i < pools.length; i++) {
    try {
      await pools[i].query('SELECT 1');
      console.log(`Database ${i + 1} connected`);
    } catch (err) {
      console.error(`Database ${i + 1} connection error`, err);
    }
  }
}

testConnections();

module.exports = { pools };
