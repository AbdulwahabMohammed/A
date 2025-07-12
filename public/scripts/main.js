function populateSelect(id, items) {
  const select = document.getElementById(id);
  select.innerHTML = '<option value="">-- الكل --</option>';
  items.forEach(it => {
    const opt = document.createElement('option');
    opt.value = it.id;
    opt.textContent = it.name || it.alamana || it.albaldia || it.FacilityName;
    select.appendChild(opt);
  });
}

async function fetchOptions() {
  const [supRes, adminRes] = await Promise.all([
    fetch('/api/suppliers'),
    fetch('/api/administrations')
  ]);
  populateSelect('supplier', await supRes.json());
  populateSelect('administration', await adminRes.json());
}

async function updateMunicipalities() {
  const administration = document.getElementById('administration').value;
  if (!administration) { populateSelect('municipality', []); return; }
  const res = await fetch(`/api/municipalities?administration=${administration}`);
  populateSelect('municipality', await res.json());
}

async function updateEstablishments() {
  const supplier = document.getElementById('supplier').value;
  if (!supplier) { populateSelect('establishment', []); return; }
  const res = await fetch(`/api/establishments?supplier=${supplier}`);
  populateSelect('establishment', await res.json());
}

function createActionButtons(row, dbIndex) {
  return `<button class="btn btn-sm btn-success me-1" onclick="updateStatus(${dbIndex}, '${row.CertificateNumber}', 1)">تشغيل</button>` +
         `<button class="btn btn-sm btn-warning me-1" onclick="updateStatus(${dbIndex}, '${row.CertificateNumber}', 0)">إيقاف</button>` +
         `<button class="btn btn-sm btn-danger" onclick="updateStatus(${dbIndex}, '${row.CertificateNumber}', 2)">نصاب</button>`;
}

async function search() {
  const data = {
    query: document.getElementById('mainQuery').value,
    supplier: document.getElementById('supplier').value,
    administration: document.getElementById('administration').value,
    municipality: document.getElementById('municipality').value,
    establishment: document.getElementById('establishment').value,
    fromDate: document.getElementById('fromDate').value,
    toDate: document.getElementById('toDate').value
  };
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const results = await res.json();
  const tbody = document.getElementById('results');
  tbody.innerHTML = '';
  results.forEach(r => {
    const tr = document.createElement('tr');
    tr.dataset.index = r.dbIndex;
    tr.innerHTML = `<td>${r.CertificateNumber}</td><td>${r.PersonName}</td><td>${r.dbIndex}</td><td>${statusText(r.status)}</td><td>${createActionButtons(r, r.dbIndex)}</td>`;
    tbody.appendChild(tr);
  });
  document.getElementById('resultsSection').style.display = 'block';
}

function statusText(status) {
  if (status == 1) return 'نشطة';
  if (status == 0) return 'موقوفة';
  if (status == 2) return 'نصاب';
  return '';
}

async function updateStatus(dbIndex, certificateNumber, status) {
  await fetch('/api/updateStatus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dbIndex, certificateNumber, status })
  });
  search();
}

document.getElementById('searchBtn').addEventListener('click', search);
document.getElementById('activateAll').addEventListener('click', () => applyAll(1));
document.getElementById('deactivateAll').addEventListener('click', () => applyAll(0));
document.getElementById('flagAll').addEventListener('click', () => applyAll(2));
document.getElementById('administration').addEventListener('change', updateMunicipalities);
document.getElementById('supplier').addEventListener('change', updateEstablishments);

async function applyAll(status) {
  const rows = document.querySelectorAll('#results tr');
  for (const row of rows) {
    const cert = row.children[0].innerText;
    const dbIndex = row.dataset.index;
    await updateStatus(dbIndex, cert, status);
  }
  search();
}

fetchOptions();
