const mysql = require('mysql2/promise');

// Three different database configurations
const dbConfigs = [
  {
    host: '162.241.216.179',
    database: 'lmbolwmy_newsickforemp',
    user: 'lmbolwmy_asdi',
    password: 'eCTCeMCZCUS5ps9'
  },
  {
    host: '162.241.216.179',
    database: 'lmbolwmy_cert',
    user: 'lmbolwmy_asdi',
    password: 'eCTCeMCZCUS5ps9'
  },
  {
    host: '49.13.53.13',
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

module.exports = { pools };
