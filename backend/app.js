const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config();

const { pools } = require('./db');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

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
    status,
    establishment,
    fromDate,
    toDate
  } = req.body;

  const results = [];
  for (let i = 0; i < pools.length; i++) {
    const pool = pools[i];
    try {
      let sql = `SELECT hc.certificateNumber AS CertificateNumber, hc.code AS Code, p.name AS PersonName, ${i + 1} AS dbIndex, hc.status
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
      if (establishment) {
        sql += ' AND hc.Facility = ?';
        params.push(establishment);
      }
      if (status !== undefined && status !== '') {
        sql += ' AND hc.status = ?';
        params.push(status);
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
app.post('/webhook', bodyParser.raw({ type: '*/*' }), (req, res) => {
  const event = req.get('X-GitHub-Event');
  const userAgent = req.get('User-Agent') || '';
  if (req.method !== 'POST' || !event || !userAgent.startsWith('GitHub-Hookshot')) {
    return res.status(400).send('Invalid request');
  }

  // Verify GitHub signature
  if (WEBHOOK_SECRET) {
    const sig256 = req.get('X-Hub-Signature-256');
    const sig = req.get('X-Hub-Signature');
    let expected;
    if (sig256) {
      const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET).update(req.body).digest('hex');
      expected = `sha256=${hmac}`;
      if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig256))) {
        return res.status(401).send('Signature mismatch');
      }
    } else if (sig) {
      const hmac = crypto.createHmac('sha1', WEBHOOK_SECRET).update(req.body).digest('hex');
      expected = `sha1=${hmac}`;
      if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
        return res.status(401).send('Signature mismatch');
      }
    } else {
      return res.status(401).send('No signature');
    }
  }

  const repoDir = path.resolve(__dirname, '..');
  exec('git pull', { cwd: repoDir }, (err) => {
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
