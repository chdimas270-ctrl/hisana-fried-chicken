const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginForm = document.getElementById('loginForm');
const loginAlert = document.getElementById('loginAlert');
const logoutArea = document.getElementById('logout-area');
const toggleP = document.getElementById('toggle-pria');
const toggleW = document.getElementById('toggle-wanita');
const tableBody = document.getElementById('tableBody');
const emptyState = document.getElementById('emptyState');
const dataTable = document.getElementById('dataTable');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

async function checkSession() {
  const res = await fetch('/api/admin/session');
  const data = await res.json();
  if (data.isAdmin) {
    showDashboard();
  } else {
    loginView.style.display = 'block';
    dashboardView.style.display = 'none';
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginAlert.innerHTML = '';
  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (data.ok) {
      loginForm.reset();
      showDashboard();
    } else {
      loginAlert.innerHTML = `<div class="alert error">${escapeHtml(data.message)}</div>`;
    }
  } catch (err) {
    loginAlert.innerHTML = `<div class="alert error">Gagal terhubung ke server.</div>`;
  }
});

function showDashboard() {
  loginView.style.display = 'none';
  dashboardView.style.display = 'block';
  logoutArea.innerHTML = '<a href="#" id="logoutBtn" style="color:#F2B705">Keluar</a>';
  document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/api/admin/logout', { method: 'POST' });
    location.reload();
  });
  loadStatus();
  loadSubmissions();
}

async function loadStatus() {
  const res = await fetch('/api/status');
  const data = await res.json();
  toggleP.checked = !!data.status.pria;
  toggleW.checked = !!data.status.wanita;
}

async function updateStatus(partial) {
  await fetch('/api/admin/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(partial),
  });
}

toggleP.addEventListener('change', () => updateStatus({ pria: toggleP.checked }));
toggleW.addEventListener('change', () => updateStatus({ wanita: toggleW.checked }));

async function loadSubmissions() {
  const res = await fetch('/api/admin/submissions');
  if (res.status === 401) return checkSession();
  const data = await res.json();
  renderTable(data.submissions || []);
}

function renderTable(rows) {
  if (rows.length === 0) {
    dataTable.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }
  dataTable.style.display = 'table';
  emptyState.style.display = 'none';

  tableBody.innerHTML = rows
    .map(
      (r) => `
    <tr>
      <td>${escapeHtml(new Date(r.submittedAt).toLocaleString('id-ID'))}</td>
      <td><span class="badge-gender ${r.jenisKelamin}">${r.jenisKelamin === 'pria' ? 'Pria' : 'Wanita'}</span></td>
      <td>${escapeHtml(r.namaLengkap)}</td>
      <td>${escapeHtml(r.noHp)}</td>
      <td>${escapeHtml(r.email)}</td>
      <td>${escapeHtml(r.posisiDilamar)}</td>
      <td>${escapeHtml(r.pendidikanTerakhir)}</td>
      <td><button class="btn danger" style="padding:6px 10px;font-size:0.78rem" data-id="${r.id}">Hapus</button></td>
    </tr>`
    )
    .join('');

  tableBody.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Hapus data lamaran ini?')) return;
      await fetch(`/api/admin/submissions/${btn.dataset.id}`, { method: 'DELETE' });
      loadSubmissions();
    });
  });
}

checkSession();
