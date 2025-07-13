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

async function updateEstablishments() {
  const supplier = document.getElementById('supplier').value;
  if (!supplier) { populateSelect('establishment', []); return; }
  const res = await fetch(`/api/establishments?supplier=${supplier}`);
  populateSelect('establishment', await res.json());
}

function createActionButtons(row, dbIndex) {
  const playBtn = `<button class="btn btn-sm btn-success me-1" onclick="updateStatus(${dbIndex}, '${row.CertificateNumber}', 1)" data-bs-toggle="tooltip" title="تشغيل الشهادة"><i class="bi bi-play-fill"></i></button>`;
  const pauseBtn = `<button class="btn btn-sm btn-warning me-1" onclick="updateStatus(${dbIndex}, '${row.CertificateNumber}', 0)" data-bs-toggle="tooltip" title="إيقاف الشهادة"><i class="bi bi-pause-fill"></i></button>`;
  const flagBtn = `<button class="btn btn-sm btn-danger me-1" onclick="updateStatus(${dbIndex}, '${row.CertificateNumber}', 2)" data-bs-toggle="tooltip" title="وضع كـ نصاب"><i class="bi bi-exclamation-triangle-fill"></i></button>`;
  if (row.status == 1) return pauseBtn + flagBtn;
  if (row.status == 0) return playBtn + flagBtn;
  if (row.status == 2) return playBtn + pauseBtn;
  return '';
}

let searchResults = [];
const pageSize = 20;
let currentPage = 1;

function renderPage(page) {
  currentPage = page;
  const tbody = document.getElementById('results');
  tbody.innerHTML = '';
  const start = (page - 1) * pageSize;
  const pageData = searchResults.slice(start, start + pageSize);
  pageData.forEach(r => {
    const tr = document.createElement('tr');
    tr.dataset.index = r.dbIndex;
    const statusCell = `<span class="${statusClass(r.status)}">${statusText(r.status)}</span>`;
    tr.innerHTML = `<td><pre class="codebox">${r.CertificateNumber}</pre></td><td>${r.PersonName}</td><td>${r.dbIndex}</td><td>${statusCell}</td><td>${createActionButtons(r, r.dbIndex)}</td>`;
    tbody.appendChild(tr);
  });
  const tooltips = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltips.map(t => new bootstrap.Tooltip(t));
  document.getElementById('count').textContent = searchResults.length;
  renderPagination();
  document.getElementById('resultsSection').style.display = searchResults.length ? 'block' : 'none';
}

function renderPagination() {
  const pages = Math.ceil(searchResults.length / pageSize);
  const container = document.getElementById('pagination');
  container.innerHTML = '';
  if (pages <= 1) return;
  for (let i = 1; i <= pages; i++) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline-secondary btn-sm ms-1';
    btn.textContent = i;
    if (i === currentPage) btn.classList.add('active');
    btn.addEventListener('click', () => renderPage(i));
    container.appendChild(btn);
  }
}

async function search() {
  const data = {
    query: document.getElementById('mainQuery').value,
    supplier: document.getElementById('supplier').value,
    administration: document.getElementById('administration').value,
    status: document.getElementById('status').value,
    establishment: document.getElementById('establishment').value,
    fromDate: document.getElementById('fromDate').value,
    toDate: document.getElementById('toDate').value
  };
  if (
    !data.query &&
    !data.supplier &&
    !data.administration &&
    !data.establishment &&
    data.status === '' &&
    !data.fromDate &&
    !data.toDate
  ) {
    const alertBox = document.getElementById('alertMsg');
    alertBox.classList.remove('d-none');
    setTimeout(() => alertBox.classList.add('d-none'), 3000);
    return;
  }
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  searchResults = await res.json();
  renderPage(1);
}

function statusText(status) {
  if (status == 1) return 'نشطة';
  if (status == 0) return 'موقوفة';
  if (status == 2) return 'نصاب';
  return '';
}

function statusClass(status) {
  if (status == 1) return 'status-active';
  if (status == 0) return 'status-paused';
  if (status == 2) return 'status-flagged';
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
document.getElementById('supplier').addEventListener('change', updateEstablishments);
document.getElementById('clearBtn').addEventListener('click', clearSearch);

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

function clearSearch() {
  document.getElementById('mainQuery').value = '';
  document.getElementById('supplier').value = '';
  document.getElementById('administration').value = '';
  document.getElementById('status').value = '';
  document.getElementById('establishment').value = '';
  document.getElementById('fromDate').value = '';
  document.getElementById('toDate').value = '';
  populateSelect('establishment', []);
  document.getElementById('resultsSection').style.display = 'none';
  searchResults = [];
  document.getElementById('pagination').innerHTML = '';
  document.getElementById('count').textContent = 0;
}

// enable Bootstrap tooltips
document.addEventListener('DOMContentLoaded', () => {
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(t => new bootstrap.Tooltip(t));
});

