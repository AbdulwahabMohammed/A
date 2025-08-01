const express = require('express');
const mariadb = require('mariadb');
const bodyParser = require('body-parser');
const expressLayouts = require('express-ejs-layouts');
require('dotenv').config();

const app = express();
const router = express.Router();
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout');
app.use('/nagl', express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));

const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'test',
  connectionLimit: 5
});

async function generateCardNumber(table, facilityId) {
  const rows = await pool.query(
    'SELECT LicenseNumber FROM OPC_Facility WHERE FacilityID = ?',
    [facilityId]
  );
  const facility = rows[0];
  let prefix = '33.00';
  if (facility && facility.LicenseNumber) {
    prefix = facility.LicenseNumber.slice(0, 5);
  }
  let cardNumber = '';
  let exists = true;
  while (exists) {
    const random = Math.floor(100000 + Math.random() * 900000);
    cardNumber = `${prefix}${random}`;
    const rowsCheck = await pool.query(
      `SELECT 1 FROM ${table} WHERE CardNumber = ? LIMIT 1`,
      [cardNumber]
    );
    exists = rowsCheck.length > 0;
  }
  return cardNumber;
}

router.get('/', (req, res) => {
  res.render('home', {
    title: 'لوحة التحكم',
    header: 'لوحة التحكم'
  });
});

router.get('/facilities', async (req, res) => {
  const facilities = await pool.query(
    'SELECT FacilityID, Name, IdentityNumber, LicenseType FROM OPC_Facility ORDER BY FacilityID DESC'
  );
  res.render('facilities/index', {
    facilities,
    title: 'المنشآت',
    header: 'إدارة المنشآت'
  });
});

router.get('/facilities/new', (req, res) => {
  res.render('facilities/new', {
    identity: req.query.identity || '',
    next: req.query.next || '',
    title: 'إضافة منشأة',
    header: 'إضافة منشأة'
  });
});

router.get('/drivers', async (req, res) => {
  const drivers = await pool.query(
    'SELECT d.DriverID, d.FirstName, d.LastName, d.IdentityNumber, f.Name AS FacilityName FROM OPC_Driver d LEFT JOIN OPC_Facility f ON d.FacilityID = f.FacilityID ORDER BY d.DriverID DESC'
  );
  res.render('drivers/index', {
    drivers,
    title: 'السائقون',
    header: 'إدارة السائقين'
  });
});

router.get('/drivers/new', async (req, res) => {
  const facilities = await pool.query('SELECT FacilityID, Name FROM OPC_Facility');
  res.render('drivers/new', {
    facilities,
    facilityId: req.query.facilityId || '',
    identity: req.query.identity || '',
    next: req.query.next || '',
    title: 'إضافة سائق',
    header: 'إضافة سائق'
  });
});

router.get('/vehicles', async (req, res) => {
  const vehicles = await pool.query(
    'SELECT v.ID, v.PlateNumber, v.SerialNumber, f.Name FROM OPC_Vehicle v LEFT JOIN OPC_Facility f ON v.FacilityID = f.FacilityID ORDER BY v.ID DESC'
  );
  res.render('vehicles/index', {
    vehicles,
    title: 'المركبات',
    header: 'إدارة المركبات'
  });
});

router.get('/vehicles/new', async (req, res) => {
  const facilities = await pool.query('SELECT FacilityID, Name FROM OPC_Facility');
  res.render('vehicles/new', {
    facilities,
    facilityId: req.query.facilityId || '',
    title: 'إضافة مركبة',
    header: 'إضافة مركبة'
  });
});

router.get('/driver-cards', async (req, res) => {
  const cards = await pool.query(
    'SELECT d.ID, d.CardNumber, d.token, d.CardType, drv.FirstName, f.Name, d.IssueDate, d.ExpirationDate, s.name AS SupplierName ' +
      'FROM OPC_DriverCard d ' +
      'LEFT JOIN OPC_Driver drv ON d.DriverID = drv.DriverID ' +
      'LEFT JOIN OPC_Facility f ON d.FacilityID = f.FacilityID ' +
      'LEFT JOIN Supplier s ON d.Supplier = s.id ' +
      'ORDER BY d.ID DESC'
  );
  res.render('drivercards/index', {
    cards,
    title: 'بطاقات السائقين',
    header: 'إدارة بطاقات السائقين'
  });
});

router.get('/driver-cards/new', (req, res) => {
  res.render('drivercards/new', {
    title: 'إضافة بطاقة سائق',
    header: 'إدخال هوية المنشأة'
  });
});

router.post('/driver-cards/new', async (req, res) => {
  const { IdentityNumber } = req.body;
  const rows = await pool.query(
    'SELECT FacilityID FROM OPC_Facility WHERE IdentityNumber = ?',
    [IdentityNumber]
  );
  if (rows.length) {
    const fid = rows[0].FacilityID;
    return res.redirect(`/nagl/driver-cards/new/${fid}/driver`);
  }
  res.render('facilities/new', {
    identity: IdentityNumber,
    next: '/nagl/driver-cards/new',
    title: 'إضافة منشأة',
    header: 'إضافة منشأة'
  });
});

router.post('/facilities', async (req, res) => {
  const { IdentityNumber, Name, EnglishName, next } = req.body;
  const result = await pool.query(
    'INSERT INTO OPC_Facility (IdentityNumber, Name, EnglishName) VALUES (?, ?, ?)',
    [IdentityNumber, Name, EnglishName || null]
  );
  const fid = result.insertId;
  const redirectTo = next ? `${next}/${fid}/driver` : '/nagl/facilities';
  res.redirect(redirectTo);
});

router.get('/driver-cards/new/:facilityId/driver', async (req, res) => {
  const { facilityId } = req.params;
  const [facilityRow] = await pool.query(
    'SELECT Name FROM OPC_Facility WHERE FacilityID = ?',
    [facilityId]
  );
  res.render('drivercards/driver', {
    facilityId,
    facilityName: facilityRow ? facilityRow.Name : '',
    title: 'إضافة بطاقة سائق',
    header: 'إدخال هوية السائق'
  });
});

router.post('/driver-cards/new/:facilityId/driver', async (req, res) => {
  const { facilityId } = req.params;
  const { IdentityNumber } = req.body;
  const rows = await pool.query(
    'SELECT DriverID, FirstName, LastName FROM OPC_Driver WHERE IdentityNumber = ? AND FacilityID = ?',
    [IdentityNumber, facilityId]
  );
  if (rows.length) {
    const driver = rows[0];
    const [card] = await pool.query(
      'SELECT ID FROM OPC_DriverCard WHERE DriverID = ? ORDER BY ID DESC LIMIT 1',
      [driver.DriverID]
    );
    if (card) {
      return res.redirect(`/nagl/driver-cards/${card.ID}/edit`);
    }
    return res.redirect(`/nagl/driver-cards/new/${facilityId}/driver/${driver.DriverID}`);
  }
  res.render('drivers/new', {
    facilityId,
    identity: IdentityNumber,
    next: `/nagl/driver-cards/new/${facilityId}/driver`,
    title: 'إضافة سائق',
    header: 'إضافة سائق'
  });
});

router.post('/drivers', async (req, res) => {
  const { FacilityID, IdentityNumber, FirstName, LastName, next } = req.body;
  const result = await pool.query(
    'INSERT INTO OPC_Driver (FacilityID, IdentityNumber, FirstName, LastName) VALUES (?, ?, ?, ?)',
    [FacilityID, IdentityNumber, FirstName, LastName]
  );
  const id = result.insertId;
  const redirectTo = next ? `${next}/${id}` : '/nagl/drivers';
  res.redirect(redirectTo);
});

router.post('/vehicles', async (req, res) => {
  const { FacilityID, PlateNumber, SerialNumber } = req.body;
  await pool.query(
    'INSERT INTO OPC_Vehicle (FacilityID, PlateNumber, SerialNumber) VALUES (?, ?, ?)',
    [FacilityID || null, PlateNumber, SerialNumber]
  );
  res.redirect('/nagl/vehicles');
});

router.get('/driver-cards/new/:facilityId/driver/:driverId', async (req, res) => {
  const { facilityId, driverId } = req.params;
  const facilities = await pool.query(
    'SELECT FacilityID, Name, IdentityNumber, LicenseType, LicenseNumber FROM OPC_Facility WHERE FacilityID = ?',
    [facilityId]
  );
  const suppliers = await pool.query('SELECT id, name FROM Supplier');
  const drivers = await pool.query(
    'SELECT DriverID, FirstName, LastName FROM OPC_Driver WHERE DriverID = ?',
    [driverId]
  );
  const licenseTypes = await pool.query(
    'SELECT LicenseTypeNameAR FROM OPC_LicenseType'
  );
  const facility = facilities[0];
  const driver = drivers[0];
  res.render('drivercards/form', {
    facilities,
    suppliers,
    drivers,
    licenseTypes,
    facility,
    driver,
    lockFacility: true,
    lockDriver: true,
    card: null,
    title: 'إضافة بطاقة سائق',
    header: 'إضافة بطاقة سائق'
  });
});

router.post('/driver-cards', async (req, res) => {
  const {
    CardType,
    FacilityID,
    DriverID,
    IssueDate,
    ExpirationDate,
    Supplier
  } = req.body;
  const CardNumber = await generateCardNumber('OPC_DriverCard', FacilityID);
  const today = new Date().toISOString().slice(0, 10);
  const result = await pool.query(
    'INSERT INTO OPC_DriverCard (CardNumber, CardType, FacilityID, DriverID, IssueDate, ExpirationDate, Supplier, addingDate, LastUpdate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [CardNumber, CardType, FacilityID, DriverID, IssueDate, ExpirationDate, Supplier, today, today]
  );
  res.redirect('/nagl/driver-cards');
});

router.get('/driver-cards/:id/edit', async (req, res) => {
  const { id } = req.params;
  const cardRows = await pool.query('SELECT * FROM OPC_DriverCard WHERE ID = ?', [id]);
  const facilities = await pool.query('SELECT FacilityID, Name, IdentityNumber, LicenseType, LicenseNumber FROM OPC_Facility');
  const suppliers = await pool.query('SELECT id, name FROM Supplier');
  const drivers = await pool.query('SELECT DriverID, FirstName, LastName FROM OPC_Driver');
  const licenseTypes = await pool.query('SELECT LicenseTypeNameAR FROM OPC_LicenseType');
  const card = cardRows[0];
  if (!card) return res.redirect('/nagl/driver-cards');
  res.render('drivercards/form', {
    facilities,
    suppliers,
    drivers,
    licenseTypes,
    facility: null,
    driver: null,
    card,
    lockFacility: false,
    lockDriver: false,
    title: 'تعديل بطاقة سائق',
    header: 'تعديل بطاقة سائق'
  });
});

router.post('/driver-cards/:id', async (req, res) => {
  const { id } = req.params;
  const { CardType, FacilityID, DriverID, IssueDate, ExpirationDate, Supplier } = req.body;
  const today = new Date().toISOString().slice(0, 10);
  await pool.query(
    'UPDATE OPC_DriverCard SET CardType=?, FacilityID=?, DriverID=?, IssueDate=?, ExpirationDate=?, Supplier=?, LastUpdate=? WHERE ID=?',
    [CardType, FacilityID, DriverID, IssueDate, ExpirationDate, Supplier, today, id]
  );
  res.redirect('/nagl/driver-cards');
});

router.post('/driver-cards/:id/delete', async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM OPC_DriverCard WHERE ID = ?', [id]);
  res.redirect('/nagl/driver-cards');
});

router.get('/cards', async (req, res) => {
  const cards = await pool.query(
    'SELECT c.ID, c.CardNumber, v.PlateNumber, f.Name, c.IssueDate, c.ExpirationDate, s.name AS SupplierName FROM OPC_Card c LEFT JOIN OPC_Vehicle v ON c.VehicleID = v.ID LEFT JOIN OPC_Facility f ON c.FacilityID = f.FacilityID LEFT JOIN Supplier s ON c.Supplier = s.id'
  );
  res.render('cards/index', {
    cards,
    title: 'كروت التشغيل',
    header: 'إدارة كروت التشغيل'
  });
});

router.get('/cards/new', async (req, res) => {
  const facilities = await pool.query('SELECT FacilityID, Name, IdentityNumber, LicenseType, LicenseNumber FROM OPC_Facility');
  const suppliers = await pool.query('SELECT id, name FROM Supplier');
  const vehicles = await pool.query('SELECT ID, PlateNumber, SerialNumber, FacilityID FROM OPC_Vehicle');
  const licenseTypes = await pool.query('SELECT LicenseTypeNameAR FROM OPC_LicenseType');
  res.render('cards/new', {
    facilities,
    suppliers,
    vehicles,
    licenseTypes,
    title: 'إضافة كرت تشغيل',
    header: 'إضافة كرت تشغيل'
  });
});

router.post('/cards', async (req, res) => {
  const {
    FacilityID,
    VehicleID,
    IssueDate,
    ExpirationDate,
    RenewalDate,
    Supplier
  } = req.body;
  const CardNumber = await generateCardNumber('OPC_Card', FacilityID);
  const today = new Date().toISOString().slice(0, 10);
  await pool.query(
    'INSERT INTO OPC_Card (CardNumber, FacilityID, VehicleID, IssueDate, ExpirationDate, RenewalDate, Supplier, addingDate, LastUpdate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [CardNumber, FacilityID, VehicleID, IssueDate, ExpirationDate, RenewalDate || null, Supplier, today, today]
  );
  res.redirect('/nagl/cards');
});

router.get('/cards/:id/edit', async (req, res) => {
  const { id } = req.params;
  const cardRows = await pool.query('SELECT * FROM OPC_Card WHERE ID = ?', [id]);
  const card = cardRows[0];
  if (!card) return res.redirect('/nagl/cards');
  const facilities = await pool.query('SELECT FacilityID, Name, IdentityNumber, LicenseType, LicenseNumber FROM OPC_Facility');
  const suppliers = await pool.query('SELECT id, name FROM Supplier');
  const vehicles = await pool.query('SELECT ID, PlateNumber, SerialNumber, FacilityID FROM OPC_Vehicle');
  const licenseTypes = await pool.query('SELECT LicenseTypeNameAR FROM OPC_LicenseType');
  res.render('cards/new', {
    facilities,
    suppliers,
    vehicles,
    licenseTypes,
    card,
    title: 'تعديل كرت تشغيل',
    header: 'تعديل كرت تشغيل'
  });
});

router.post('/cards/:id', async (req, res) => {
  const { id } = req.params;
  const { FacilityID, VehicleID, IssueDate, ExpirationDate, RenewalDate, Supplier } = req.body;
  const today = new Date().toISOString().slice(0, 10);
  await pool.query(
    'UPDATE OPC_Card SET FacilityID=?, VehicleID=?, IssueDate=?, ExpirationDate=?, RenewalDate=?, Supplier=?, LastUpdate=? WHERE ID=?',
    [FacilityID, VehicleID, IssueDate, ExpirationDate, RenewalDate || null, Supplier, today, id]
  );
  res.redirect('/nagl/cards');
});

router.post('/cards/:id/delete', async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM OPC_Card WHERE ID = ?', [id]);
  res.redirect('/nagl/cards');
});

// --- APIs for dynamic data ---
router.get('/api/drivers', async (req, res) => {
  const { facilityId } = req.query;
  const drivers = facilityId
    ? await pool.query('SELECT DriverID, FirstName, LastName, IdentityNumber FROM OPC_Driver WHERE FacilityID = ?', [facilityId])
    : await pool.query('SELECT DriverID, FirstName, LastName, IdentityNumber FROM OPC_Driver');
  res.json(drivers);
});

router.post('/api/drivers', async (req, res) => {
  const { FacilityID, FirstName, LastName } = req.body;
  const result = await pool.query(
    'INSERT INTO OPC_Driver (FacilityID, FirstName, LastName) VALUES (?, ?, ?)',
    [FacilityID || null, FirstName, LastName]
  );
  const DriverID = result.insertId;
  res.json({ DriverID, FirstName, LastName, IdentityNumber: req.body.IdentityNumber || null });
});

router.get('/api/vehicles', async (req, res) => {
  const { facilityId } = req.query;
  const vehicles = facilityId
    ? await pool.query('SELECT ID, PlateNumber, SerialNumber FROM OPC_Vehicle WHERE FacilityID = ?', [facilityId])
    : await pool.query('SELECT ID, PlateNumber, SerialNumber FROM OPC_Vehicle');
  res.json(vehicles);
});

router.post('/api/vehicles', async (req, res) => {
  const { FacilityID, PlateNumber, SerialNumber } = req.body;
  const result = await pool.query(
    'INSERT INTO OPC_Vehicle (FacilityID, PlateNumber, SerialNumber) VALUES (?, ?, ?)',
    [FacilityID || null, PlateNumber, SerialNumber]
  );
  const ID = result.insertId;
  res.json({ ID, PlateNumber, SerialNumber });
});

router.post('/api/facilities', async (req, res) => {
  const {
    Name,
    EnglishName,
    IdentityNumber,
    LicenseNumber,
    LicenseType,
    LicenseIssueDate,
    LicenseExpirationDate,
    LicenseCity,
    LicenseCityEn
  } = req.body;
  const result = await pool.query(
    'INSERT INTO OPC_Facility (Name, EnglishName, IdentityNumber, LicenseNumber, LicenseType, LicenseIssueDate, LicenseExpirationDate, LicenseCity, LicenseCityEn) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      Name,
      EnglishName || null,
      IdentityNumber,
      LicenseNumber || null,
      LicenseType || null,
      LicenseIssueDate || null,
      LicenseExpirationDate || null,
      LicenseCity || null,
      LicenseCityEn || null
    ]
  );
  const FacilityID = result.insertId;
  res.json({ FacilityID, Name, IdentityNumber, LicenseType });
});

router.get('/api/license-types', async (req, res) => {
  const rows = await pool.query('SELECT LicenseTypeNameAR, LicenseTypeNameEN FROM OPC_LicenseType');
  res.json(rows);
});

router.post('/api/license-types', async (req, res) => {
  const { LicenseTypeNameAR, LicenseTypeNameEN } = req.body;
  const result = await pool.query(
    'INSERT INTO OPC_LicenseType (LicenseTypeNameAR, LicenseTypeNameEN) VALUES (?, ?)',
    [LicenseTypeNameAR, LicenseTypeNameEN || null]
  );
  const LicenseTypeID = result.insertId;
  res.json({ LicenseTypeID, LicenseTypeNameAR, LicenseTypeNameEN });
});

app.use('/nagl', router);

const port = process.env.PORT || 3002;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
