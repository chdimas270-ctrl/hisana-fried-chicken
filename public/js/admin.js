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
  const modalUsia = document.getElementById('modalUsia');
  const modalPosisi = document.getElementById('modalPosisi');
  const modalReferensi = document.getElementById('modalReferensi');
  const modalEmail = document.getElementById('modalEmail');
  const modalDomisili = document.getElementById('modalDomisili');
  const modalPengalaman = document.getElementById('modalPengalaman');
  const modalFilesWrap = document.getElementById('modalFilesWrap');
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
        item.noWa,
        item.noHp,
        item.email,
        item.posisiPekerjaan,
        item.domisili,
        item.referensi,
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

        const phoneVal = item.noWa || item.noHp || '-';
        let phoneDigits = phoneVal.replace(/[^0-9]/g, '');
        if (phoneDigits.startsWith('0')) phoneDigits = '62' + phoneDigits.slice(1);

        const posisiFixed = item.posisiPekerjaan || (item.jenisKelamin === 'pria' ? 'Crew' : 'Kasir');

        const waMsg = encodeURIComponent(
          `Halo Sdr/i ${item.namaLengkap},\n\nTerima kasih telah melamar posisi ${posisiFixed} di Hisana Fried Chicken Cirebon. Berkas Anda telah kami tinjau dan kami bermaksud mengundang Anda untuk mengikuti tahapan wawancara kerja...`
        );
        const waLink = `https://wa.me/${phoneDigits}?text=${waMsg}`;

        // Render file pill badges
        let filesHtml = '';
        if (item.files) {
          if (item.files.fotoKtp) {
            filesHtml += `<a href="/api/admin/files/${encodeURIComponent(item.files.fotoKtp.storedFilename)}" target="_blank" class="doc-link" title="Lihat Foto KTP">🪪 KTP</a> `;
          }
          if (item.files.cv) {
            filesHtml += `<a href="/api/admin/files/${encodeURIComponent(item.files.cv.storedFilename)}" target="_blank" class="doc-link" title="Lihat CV">📑 CV</a> `;
          }
          if (item.files.suratLamaran) {
            filesHtml += `<a href="/api/admin/files/${encodeURIComponent(item.files.suratLamaran.storedFilename)}" target="_blank" class="doc-link" title="Lihat Surat Lamaran">📄 Surat</a>`;
          }
        }
        if (!filesHtml) filesHtml = '<span style="color:var(--text-muted);font-size:0.8rem;">-</span>';

        return `
          <tr>
            <td>
              <div style="font-weight:600; color:var(--secondary);">${formattedDate}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">${formattedTime} WIB</div>
            </td>
            <td>
              <span class="badge-tag ${posisiFixed === 'Crew' ? 'crew' : 'kasir'}">
                ${posisiFixed === 'Crew' ? '👨 Crew' : '👩 Kasir'}
              </span>
            </td>
            <td>
              <div style="font-weight:700; color:var(--secondary);">${escapeHtml(item.namaLengkap)}</div>
              <div style="font-size:0.78rem; color:var(--text-secondary);">${item.usia ? item.usia + ' Tahun' : '-'}</div>
            </td>
            <td>
              <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(phoneVal)}</div>
              <div style="font-size:0.75rem; color:var(--text-secondary);">${escapeHtml(item.email)}</div>
            </td>
            <td>
              <div style="font-size:0.85rem; color:var(--text-primary); max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(item.domisili || '')}">
                ${escapeHtml(item.domisili || '-')}
              </div>
            </td>
            <td>
              <div style="font-size:0.85rem; font-weight:600; color:var(--text-primary);">${escapeHtml(item.referensi || '-')}</div>
            </td>
            <td>
              <div style="display:flex; flex-wrap:wrap; gap:4px;">
                ${filesHtml}
              </div>
            </td>
            <td style="text-align: right;">
              <div style="display: flex; gap: 6px; justify-content: flex-end; align-items: center;">
                <a href="${waLink}" target="_blank" class="doc-link" style="color:var(--success); font-weight:700;" title="Hubungi via WhatsApp">
                  💬 WA
                </a>
                <button class="btn-upload detail-btn" data-id="${item.id}" style="padding:4px 8px; font-size:0.75rem;" title="Lihat Profil & Berkas">
                  👁️ Detail
                </button>
                <button class="btn-upload delete-btn" data-id="${item.id}" data-name="${escapeHtml(item.namaLengkap)}" style="padding:4px 8px; font-size:0.75rem; color:var(--danger); border-color:#FECACA;" title="Hapus Data">
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
    const posisiFixed = c.posisiPekerjaan || (c.jenisKelamin === 'pria' ? 'Crew' : 'Kasir');
    modalName.textContent = c.namaLengkap;
    modalSubMeta.textContent = `Posisi: ${posisiFixed} · Kategori ${c.jenisKelamin === 'pria' ? 'Pria' : 'Wanita'}`;
    modalUsia.textContent = c.usia ? `${c.usia} Tahun` : '-';
    modalPosisi.textContent = posisiFixed;
    modalReferensi.textContent = c.referensi || '-';
    modalEmail.textContent = c.email || '-';
    modalDomisili.textContent = c.domisili || '-';
    modalPengalaman.textContent = c.pengalamanKerja || 'Belum memiliki pengalaman kerja (Fresh Graduate).';

    // Render Dokumen Terlampir di Modal
    modalFilesWrap.innerHTML = '';
    if (c.files) {
      if (c.files.fotoKtp) {
        modalFilesWrap.innerHTML += `
          <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0; padding:10px 14px; border-radius:8px;">
            <div style="display:flex; align-items:center; gap:8px; font-size:0.9rem; font-weight:600; color:#0f172a;">
              <span>🪪</span> Foto KTP Asli
            </div>
            <a href="/api/admin/files/${encodeURIComponent(c.files.fotoKtp.storedFilename)}" target="_blank" class="btn btn-dark" style="width:auto; padding:6px 14px; font-size:0.8rem;">
              Buka / Unduh KTP &rarr;
            </a>
          </div>
        `;
      }
      if (c.files.cv) {
        modalFilesWrap.innerHTML += `
          <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0; padding:10px 14px; border-radius:8px;">
            <div style="display:flex; align-items:center; gap:8px; font-size:0.9rem; font-weight:600; color:#0f172a;">
              <span>📑</span> CV (Curriculum Vitae)
            </div>
            <a href="/api/admin/files/${encodeURIComponent(c.files.cv.storedFilename)}" target="_blank" class="btn btn-dark" style="width:auto; padding:6px 14px; font-size:0.8rem;">
              Buka / Unduh CV &rarr;
            </a>
          </div>
        `;
      }
      if (c.files.suratLamaran) {
        modalFilesWrap.innerHTML += `
          <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0; padding:10px 14px; border-radius:8px;">
            <div style="display:flex; align-items:center; gap:8px; font-size:0.9rem; font-weight:600; color:#0f172a;">
              <span>📄</span> Surat Lamaran Kerja
            </div>
            <a href="/api/admin/files/${encodeURIComponent(c.files.suratLamaran.storedFilename)}" target="_blank" class="btn btn-dark" style="width:auto; padding:6px 14px; font-size:0.8rem;">
              Buka / Unduh Surat &rarr;
            </a>
          </div>
        `;
      }
    }

    if (!modalFilesWrap.innerHTML) {
      modalFilesWrap.innerHTML = '<div style="color:var(--slate-400); font-size:0.88rem; font-style:italic;">Tidak ada berkas yang diunggah.</div>';
    }

    // WA Button in Modal
    const phoneVal = c.noWa || c.noHp || '';
    let phoneDigits = phoneVal.replace(/[^0-9]/g, '');
    if (phoneDigits.startsWith('0')) phoneDigits = '62' + phoneDigits.slice(1);
    const waMsg = encodeURIComponent(
      `Halo Sdr/i ${c.namaLengkap},\n\nTerima kasih telah melamar posisi ${posisiFixed} di Hisana Fried Chicken Cirebon. Berkas Anda telah kami tinjau dan kami bermaksud mengundang Anda untuk mengikuti tahapan wawancara kerja...`
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
