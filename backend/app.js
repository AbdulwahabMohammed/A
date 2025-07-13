const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const { pools } = require('./db');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// helper to run the same query on multiple pools and merge results.
// optional altSql allows falling back to a different table if the first query
// fails (for example when table names differ between databases)
async function gatherData(sql, params = [], usePools = pools, altSql) {
  const map = new Map();
  let anySuccess = false;
  for (const pool of usePools) {
    try {
      const [rows] = await pool.query(sql, params);
      rows.forEach(r => map.set(`${r.id}-${r.name ?? ''}`, r));
      anySuccess = true;
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE' && altSql) {
        try {
          const [rows] = await pool.query(altSql, params);
          rows.forEach(r => map.set(`${r.id}-${r.name ?? ''}`, r));
          anySuccess = true;
          continue;
        } catch (err2) {
          console.error('Alt query error', err2);
        }
      } else {
        console.error('Query error', err);
      }
    }
  }
  return { data: Array.from(map.values()), success: anySuccess };
}

// Options endpoints
// supplier table name may vary between databases (HC_suppliers or Supplier)
// gatherData will attempt HC_suppliers first then fall back to Supplier
app.get('/api/suppliers', async (req, res) => {
  const { data, success } = await gatherData(
    'SELECT id, name FROM HC_suppliers WHERE is_active = 1',
    [],
    pools,
    'SELECT id, name FROM Supplier WHERE is_active = 1'
  );
  if (!success) return res.status(500).json([]);
  res.json(data);
});

app.get('/api/administrations', async (req, res) => {
  const { data, success } = await gatherData('SELECT id, alamana FROM HC_alamanat');
  if (!success) return res.status(500).json([]);
  res.json(data);
});

app.get('/api/municipalities', async (req, res) => {
  const { administration } = req.query;
  if (!administration) return res.json([]);
  const { data, success } = await gatherData('SELECT id, albaldia FROM HC_albaldia WHERE alamana = ?', [administration]);
  if (!success) return res.status(500).json([]);
  res.json(data);
});

app.get('/api/establishments', async (req, res) => {
  const { supplier } = req.query;
  if (!supplier) return res.json([]);
  const sql = `SELECT DISTINCT f.id, f.FacilityName FROM HC_Facility f
               JOIN HC_HealthCertificate hc ON hc.Facility = f.id
               WHERE hc.Supplier = ?`;
  const { data, success } = await gatherData(sql, [supplier]);
  if (!success) return res.status(500).json([]);
  res.json(data);
});

// Advanced search endpoint
app.post('/api/search', async (req, res) => {
  const {
    query,
    supplier,
    administration,
    municipality,
    establishment,
    fromDate,
    toDate
  } = req.body;

  const results = [];
  for (let i = 0; i < pools.length; i++) {
    const pool = pools[i];
    try {
      let sql = `SELECT hc.certificateNumber AS CertificateNumber, p.name AS PersonName, ${i + 1} AS dbIndex, hc.status
                 FROM HC_HealthCertificate hc
                 LEFT JOIN HC_Person p ON hc.Person = p.id
                 LEFT JOIN HC_Facility f ON hc.Facility = f.id
                 WHERE 1=1`;
      const params = [];
      if (query) {
        sql += ' AND (hc.certificateNumber LIKE ? OR hc.code LIKE ? OR f.FacilityNumber LIKE ? OR f.licenseNumber LIKE ?)';
        params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
      }
      if (supplier) {
        sql += ' AND hc.Supplier = ?';
        params.push(supplier);
      }
      if (administration) {
        sql += ' AND hc.alamana = ?';
        params.push(administration);
      }
      if (municipality) {
        sql += ' AND hc.albaldia = ?';
        params.push(municipality);
      }
      if (establishment) {
        sql += ' AND hc.Facility = ?';
        params.push(establishment);
      }
      if (fromDate && toDate) {
        sql += ' AND hc.addingDate BETWEEN ? AND ?';
        params.push(fromDate, toDate);
      } else if (fromDate) {
        sql += ' AND hc.addingDate >= ?';
        params.push(fromDate);
      }
      const [rows] = await pool.query(sql, params);
      rows.forEach(row => results.push(row));
    } catch (err) {
      console.error(`DB ${i + 1} error`, err);
    }
  }
  res.json(results);
});

// Update status endpoint
app.post('/api/updateStatus', async (req, res) => {
  const { dbIndex, certificateNumber, status } = req.body;
  const pool = pools[dbIndex - 1];
  try {
    await pool.query(
      'UPDATE HC_HealthCertificate SET status = ? WHERE certificateNumber = ?',
      [status, certificateNumber]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update error', err);
    res.status(500).json({ success: false });
  }
});

// GitHub webhook to update repo on push
app.post('/webhook', (req, res) => {
  const event = req.get('X-GitHub-Event');
  const userAgent = req.get('User-Agent') || '';
  if (req.method !== 'POST' || !event || !userAgent.startsWith('GitHub-Hookshot')) {
    return res.status(400).send('Invalid request');
  }

  const repoDir = path.resolve(__dirname, '..');
  exec('git pull', { cwd: repoDir }, (err, stdout, stderr) => {
    const logMessage = `${new Date().toISOString()} - pull ${err ? 'failed' : 'success'}\n`;
    fs.appendFile(path.join(repoDir, 'webhook.log'), logMessage, () => {});
    if (err) {
      console.error('Git pull error', err);
      return res.status(500).send('Error');
    }
    res.send('Updated');
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
