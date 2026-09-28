(() => {
  // Elements
  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');
  const loginForm = document.getElementById('loginForm');
  const loginAlert = document.getElementById('loginAlert');
  const logoutWrap = document.getElementById('logoutWrap');
  const logoutBtn = document.getElementById('logoutBtn');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const passwordInput = document.getElementById('password');

  const togglePria = document.getElementById('togglePria');
  const toggleWanita = document.getElementById('toggleWanita');
  const tableBody = document.getElementById('tableBody');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const filterBtns = document.querySelectorAll('.filter-btn');

  // KPI elements
  const kpiTotal = document.getElementById('kpiTotal');
  const kpiPria = document.getElementById('kpiPria');
  const kpiWanita = document.getElementById('kpiWanita');
  const kpiToday = document.getElementById('kpiToday');
  const countAll = document.getElementById('countAll');
  const countPria = document.getElementById('countPria');
  const countWanita = document.getElementById('countWanita');

  // Modal elements
  const detailModal = document.getElementById('detailModal');
  const closeDetailBtn = document.getElementById('closeDetailBtn');
  const modalCloseActionBtn = document.getElementById('modalCloseActionBtn');
  const modalName = document.getElementById('modalName');
  const modalSubMeta = document.getElementById('modalSubMeta');
  const modalTTL = document.getElementById('modalTTL');
  const modalStatusPernikahan = document.getElementById('modalStatusPernikahan');
  const modalPendidikan = document.getElementById('modalPendidikan');
  const modalKetersediaan = document.getElementById('modalKetersediaan');
  const modalAlamat = document.getElementById('modalAlamat');
  const modalPengalaman = document.getElementById('modalPengalaman');
  const modalAlasan = document.getElementById('modalAlasan');
  const modalWaBtn = document.getElementById('modalWaBtn');

  // Delete modal elements
  const deleteModal = document.getElementById('deleteModal');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const deleteCandidateName = document.getElementById('deleteCandidateName');

  let allSubmissions = [];
  let currentFilter = 'all';
  let candidateToDelete = null;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  // Toggle Password Visibility
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPwd = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPwd ? 'text' : 'password');
      togglePasswordBtn.textContent = isPwd ? '🙈' : '👁️';
    });
  }

  // Check Session
  async function checkSession() {
    try {
      const res = await fetch('/api/admin/session');
      const data = await res.json();
      if (data && data.isAdmin) {
        showDashboard();
      } else {
        loginView.style.display = 'block';
        dashboardView.style.display = 'none';
        if (logoutWrap) logoutWrap.style.display = 'none';
      }
    } catch (err) {
      console.warn('Gagal cek sesi:', err);
      loginView.style.display = 'block';
      dashboardView.style.display = 'none';
    }
  }

  // Login Handler
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginAlert.innerHTML = '';
    const password = passwordInput.value;
    const btn = document.getElementById('btnLogin');

    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Sedang Masuk...';

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (data && data.ok) {
        loginForm.reset();
        showDashboard();
      } else {
        loginAlert.innerHTML = `<div class="alert alert-danger">${escapeHtml(data.message || 'Password salah.')}</div>`;
      }
    } catch (err) {
      loginAlert.innerHTML = `<div class="alert alert-danger">Gagal terhubung ke server. Pastikan server aktif.</div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });

  // Logout Handler
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await fetch('/api/admin/logout', { method: 'POST' });
      location.reload();
    });
  }

  function showDashboard() {
    loginView.style.display = 'none';
    dashboardView.style.display = 'block';
    if (logoutWrap) logoutWrap.style.display = 'block';

    loadStatus();
    loadStats();
    loadSubmissions();
  }

  // Load Status Switches
  async function loadStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data && data.status) {
        togglePria.checked = !!data.status.pria;
        toggleWanita.checked = !!data.status.wanita;
      }
    } catch (e) {
      console.error('Gagal load status:', e);
    }
  }

  async function updateStatus(partial) {
    try {
      await fetch('/api/admin/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });
    } catch (e) {
      alert('Gagal memperbarui status lowongan.');
    }
  }

  togglePria.addEventListener('change', () => updateStatus({ pria: togglePria.checked }));
  toggleWanita.addEventListener('change', () => updateStatus({ wanita: toggleWanita.checked }));

  // Load KPI Stats
  async function loadStats() {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.status === 401) return checkSession();
      const data = await res.json();
      if (data && data.ok && data.stats) {
        kpiTotal.textContent = data.stats.total;
        kpiPria.textContent = data.stats.pria;
        kpiWanita.textContent = data.stats.wanita;
        kpiToday.textContent = data.stats.hariIni;

        countAll.textContent = data.stats.total;
        countPria.textContent = data.stats.pria;
        countWanita.textContent = data.stats.wanita;
      }
    } catch (e) {
      console.warn('Gagal load stats:', e);
    }
  }

  // Load Submissions
  async function loadSubmissions() {
    try {
      const res = await fetch('/api/admin/submissions');
      if (res.status === 401) return checkSession();
      const data = await res.json();
      allSubmissions = data.submissions || [];
      applyFilterAndRender();
    } catch (e) {
      console.error('Gagal load submissions:', e);
    }
  }

  // Search & Filter Logic
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      applyFilterAndRender();
    });
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      applyFilterAndRender();
    });
  });

  function applyFilterAndRender() {
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

    const filtered = allSubmissions.filter((item) => {
      // Filter kategori
      if (currentFilter === 'pria' && item.jenisKelamin !== 'pria') return false;
      if (currentFilter === 'wanita' && item.jenisKelamin !== 'wanita') return false;

      // Filter teks pencarian
      if (!query) return true;
      const haystack = [
        item.namaLengkap,
        item.noHp,
        item.email,
        item.posisiDilamar,
        item.pendidikanTerakhir,
        item.alamat,
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(query);
    });

    renderTable(filtered);
  }

  // Render Data Table
  function renderTable(rows) {
    if (!rows || rows.length === 0) {
      tableBody.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    tableBody.innerHTML = rows
      .map((item) => {
        const dateObj = new Date(item.submittedAt);
        const formattedDate = dateObj.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        const formattedTime = dateObj.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        });

        // Format WA link
        let phoneDigits = (item.noHp || '').replace(/[^0-9]/g, '');
        if (phoneDigits.startsWith('0')) phoneDigits = '62' + phoneDigits.slice(1);
        const waMsg = encodeURIComponent(
          `Halo Sdr/i ${item.namaLengkap},\n\nTerima kasih telah melamar posisi ${item.posisiDilamar} di Hisana Fried Chicken Cirebon. Kami dari tim HRD bermaksud untuk mengundang Anda dalam tahap wawancara kerja...`
        );
        const waLink = `https://wa.me/${phoneDigits}?text=${waMsg}`;

        return `
          <tr>
            <td>
              <div style="font-weight:600; color:var(--slate-800);">${formattedDate}</div>
              <div style="font-size:0.75rem; color:var(--slate-400);">${formattedTime} WIB</div>
            </td>
            <td>
              <span class="badge-gender ${item.jenisKelamin}">
                ${item.jenisKelamin === 'pria' ? '👨 Pria' : '👩 Wanita'}
              </span>
            </td>
            <td>
              <div style="font-weight:700; color:var(--slate-900);">${escapeHtml(item.namaLengkap)}</div>
              <div style="font-size:0.75rem; color:var(--slate-500);">${escapeHtml(item.statusPernikahan || '-')}</div>
            </td>
            <td>
              <div style="font-weight:600; color:var(--slate-800);">${escapeHtml(item.noHp)}</div>
              <div style="font-size:0.75rem; color:var(--slate-500);">${escapeHtml(item.email)}</div>
            </td>
            <td>
              <span class="badge-pos">${escapeHtml(item.posisiDilamar)}</span>
              <div style="font-size:0.75rem; color:var(--slate-500); margin-top:2px;">Pendidikan: ${escapeHtml(item.pendidikanTerakhir)}</div>
            </td>
            <td>
              <div style="font-size:0.82rem; color:var(--slate-700);">${escapeHtml(item.ketersediaan || 'Full Time')}</div>
            </td>
            <td style="text-align: right;">
              <div class="action-buttons" style="justify-content: flex-end;">
                <a href="${waLink}" target="_blank" class="btn-icon wa" title="Hubungi via WhatsApp">
                  💬
                </a>
                <button class="btn-icon detail-btn" data-id="${item.id}" title="Lihat Profil Lengkap">
                  👁️
                </button>
                <button class="btn-icon delete delete-btn" data-id="${item.id}" data-name="${escapeHtml(item.namaLengkap)}" title="Hapus Data">
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');

    // Attach Event Handlers for Detail & Delete Buttons
    tableBody.querySelectorAll('.detail-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const candidate = allSubmissions.find((s) => s.id === id);
        if (candidate) openDetailModal(candidate);
      });
    });

    tableBody.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        candidateToDelete = { id: btn.dataset.id, name: btn.dataset.name };
        deleteCandidateName.textContent = candidateToDelete.name;
        deleteModal.classList.add('active');
      });
    });
  }

  // Open Detail Modal
  function openDetailModal(c) {
    modalName.textContent = c.namaLengkap;
    modalSubMeta.textContent = `Melamar sebagai: ${c.posisiDilamar} · Kategori ${c.jenisKelamin === 'pria' ? 'Pria' : 'Wanita'}`;
    modalTTL.textContent = c.tempatTanggalLahir || '-';
    modalStatusPernikahan.textContent = c.statusPernikahan || '-';
    modalPendidikan.textContent = c.pendidikanTerakhir || '-';
    modalKetersediaan.textContent = c.ketersediaan || '-';
    modalAlamat.textContent = c.alamat || '-';
    modalPengalaman.textContent = c.pengalamanKerja || 'Belum memiliki pengalaman kerja (Fresh Graduate).';
    modalAlasan.textContent = c.alasanMelamar || '-';

    // WA Button in Modal
    let phoneDigits = (c.noHp || '').replace(/[^0-9]/g, '');
    if (phoneDigits.startsWith('0')) phoneDigits = '62' + phoneDigits.slice(1);
    const waMsg = encodeURIComponent(
      `Halo Sdr/i ${c.namaLengkap},\n\nTerima kasih telah melamar posisi ${c.posisiDilamar} di Hisana Fried Chicken Cirebon. Kami dari tim HRD bermaksud untuk mengundang Anda dalam tahap wawancara kerja...`
    );
    modalWaBtn.href = `https://wa.me/${phoneDigits}?text=${waMsg}`;

    detailModal.classList.add('active');
  }

  // Close Detail Modal Handlers
  function closeDetailModal() {
    detailModal.classList.remove('active');
  }

  if (closeDetailBtn) closeDetailBtn.addEventListener('click', closeDetailModal);
  if (modalCloseActionBtn) modalCloseActionBtn.addEventListener('click', closeDetailModal);

  // Delete Modal Handlers
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => {
      deleteModal.classList.remove('active');
      candidateToDelete = null;
    });
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
      if (!candidateToDelete) return;
      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.textContent = 'Menghapus...';

      try {
        const res = await fetch(`/api/admin/submissions/${candidateToDelete.id}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (data && data.ok) {
          deleteModal.classList.remove('active');
          candidateToDelete = null;
          await loadStats();
          await loadSubmissions();
        } else {
          alert('Gagal menghapus data.');
        }
      } catch (e) {
        alert('Terjadi kesalahan jaringan.');
      } finally {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = 'Ya, Hapus Permanen';
      }
    });
  }

  // Close modals on Escape key or outside click
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      detailModal.classList.remove('active');
      deleteModal.classList.remove('active');
    }
  });

  [detailModal, deleteModal].forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });

  // Initial check
  checkSession();
})();
