const mysql = require('mysql2/promise');

// Three different database configurations
const dbConfigs = [
  {
    host: '162.241.216.179',
    port: 3306,
    database: 'lmbolwmy_newsickforemp',
    user: 'lmbolwmy_asdi',
    password: 'eCTCeMCZCUS5ps9'
  },
  {
    host: '162.241.216.179',
    port: 3306,
    database: 'lmbolwmy_cert',
    user: 'lmbolwmy_asdi',
    password: 'eCTCeMCZCUS5ps9'
  },
  {
    host: '49.13.53.13',
    port: 3306,
    database: 'lmbolwmy_cert',
    user: 'lmbolwmy_asdi',
    password: 'eCTCeMCZCUS5ps9'
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
