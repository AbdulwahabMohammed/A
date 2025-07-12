const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const { pools } = require('./db');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

async function gatherData(sql, params = []) {
  const map = new Map();
  for (const pool of pools) {
    try {
      const [rows] = await pool.query(sql, params);
      rows.forEach(r => map.set(r.id, r));
    } catch (err) {
      console.error('Option query error', err);
    }
  }
  return Array.from(map.values());
}

// Options endpoints
app.get('/api/suppliers', async (req, res) => {
  const data = await gatherData('SELECT id, name FROM HC_suppliers WHERE is_active = 1');
  res.json(data);
});

app.get('/api/administrations', async (req, res) => {
  const data = await gatherData('SELECT id, alamana FROM HC_alamanat');
  res.json(data);
});

app.get('/api/municipalities', async (req, res) => {
  const { administration } = req.query;
  if (!administration) return res.json([]);
  const data = await gatherData('SELECT id, albaldia FROM HC_albaldia WHERE alamana = ?', [administration]);
  res.json(data);
});

app.get('/api/establishments', async (req, res) => {
  const { supplier } = req.query;
  if (!supplier) return res.json([]);
  const sql = `SELECT DISTINCT f.id, f.FacilityName FROM HC_Facility f
               JOIN HC_HealthCertificate hc ON hc.Facility = f.id
               WHERE hc.Supplier = ?`;
  const data = await gatherData(sql, [supplier]);
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
      console.error('DB error', err);
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

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
