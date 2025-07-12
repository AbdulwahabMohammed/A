async function fetchOptions() {
  // Placeholder fetch for suppliers, administrations, etc.
  // Should be replaced with actual AJAX calls to backend to load options
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
    tr.innerHTML = `<td>${r.CertificateNumber}</td><td>${r.PersonName}</td><td>${r.database}</td><td>${statusText(r.status)}</td><td>${createActionButtons(r, r.dbIndex)}</td>`;
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

async function applyAll(status) {
  const rows = document.querySelectorAll('#results tr');
  for (const row of rows) {
    const cert = row.children[0].innerText;
    const dbIndex = row.querySelector('button').getAttribute('onclick').match(/updateStatus\((\d+),/)[1];
    await updateStatus(dbIndex, cert, status);
  }
  search();
}

fetchOptions();
