const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const { pools, databases } = require('./db');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

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
      let sql = `SELECT hc.certificateNumber AS CertificateNumber, p.name AS PersonName, ${i} AS dbIndex, hc.status
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
      rows.forEach(row => results.push({ ...row, database: databases[i] }));
    } catch (err) {
      console.error('DB error', err);
    }
  }
  res.json(results);
});

// Update status endpoint
app.post('/api/updateStatus', async (req, res) => {
  const { dbIndex, certificateNumber, status } = req.body;
  const pool = pools[dbIndex];
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
