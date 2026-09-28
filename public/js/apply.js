(() => {
  const params = new URLSearchParams(window.location.search);
  const gender = params.get('g') === 'wanita' ? 'wanita' : 'pria';

  const genderInput = document.getElementById('jenisKelamin');
  const categoryBadge = document.getElementById('categoryBadge');
  const pageTitle = document.getElementById('pageTitle');
  const submitBtn = document.getElementById('submitBtn');
  const form = document.getElementById('applyForm');
  const alertBox = document.getElementById('alertBox');
  const successModal = document.getElementById('successModal');
  const posisiDisplay = document.getElementById('posisiPekerjaanDisplay');
  const posisiInput = document.getElementById('posisiPekerjaan');
  const posisiHint = document.getElementById('posisiHint');

  // Set nilai dan gaya berdasarkan gender
  if (genderInput) genderInput.value = gender;

  if (categoryBadge) {
    categoryBadge.className = 'form-role-badge';
    categoryBadge.textContent = gender === 'pria' ? 'Formulir Laki-laki (Crew)' : 'Formulir Perempuan (Kasir)';
  }

  if (pageTitle) {
    pageTitle.textContent = `Formulir Pendaftaran — ${gender === 'pria' ? 'Crew' : 'Kasir'}`;
  }

  // ATURAN POSISI PEKERJAAN:
  // Perempuan: HANYA Kasir
  // Laki-laki: HANYA Crew
  const assignedPosition = gender === 'wanita' ? 'Kasir' : 'Crew';
  if (posisiDisplay) {
    posisiDisplay.value = `${assignedPosition} (${gender === 'wanita' ? 'Khusus Perempuan' : 'Khusus Laki-laki'})`;
  }
  if (posisiInput) {
    posisiInput.value = assignedPosition;
  }
  if (posisiHint) {
    posisiHint.textContent = `Posisi kerja ditetapkan: ${assignedPosition}.`;
  }

  if (submitBtn) {
    submitBtn.className = 'btn';
  }

  // Cek ketersediaan lowongan dari server
  async function checkCategoryStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data && data.ok && data.status && data.status[gender] === false) {
        if (form) form.style.display = 'none';
        showAlert('alert-warning', `
          <strong>Pemberitahuan:</strong> Lowongan kerja untuk kategori <strong>${gender === 'pria' ? 'Pria (Crew)' : 'Wanita (Kasir)'}</strong> saat ini sedang ditutup. Silakan cek kembali secara berkala.
        `);
      }
    } catch (err) {
      console.warn('Gagal memverifikasi status lowongan:', err);
    }
  }

  checkCategoryStatus();

  function showAlert(className, htmlContent) {
    if (!alertBox) return;
    alertBox.innerHTML = `<div class="alert ${className}">${htmlContent}</div>`;
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearFieldErrors() {
    document.querySelectorAll('.field.has-error, .file-upload-card.has-error').forEach((el) => {
      el.classList.remove('has-error');
    });
  }

  function markFieldError(name, customMsg) {
    const input = form.querySelector(`[name="${name}"]`);
    if (!input) return;
    const container = input.closest('.field') || input.closest('.file-upload-card');
    if (container) {
      container.classList.add('has-error');
      if (customMsg) {
        const errorMsg = container.querySelector('.error-message');
        if (errorMsg) errorMsg.textContent = customMsg;
      }
    }
  }

  // Hapus error saat input diubah
  form.querySelectorAll('input, select, textarea').forEach((input) => {
    input.addEventListener('input', () => {
      const container = input.closest('.field') || input.closest('.file-upload-card');
      if (container) container.classList.remove('has-error');
    });
  });

  // Format nomor WhatsApp otomatis
  const noWaInput = document.getElementById('noWa');
  if (noWaInput) {
    noWaInput.addEventListener('blur', () => {
      let val = noWaInput.value.trim().replace(/[^0-9+]/g, '');
      if (val.startsWith('+62')) {
        val = '0' + val.slice(3);
      } else if (val.startsWith('62')) {
        val = '0' + val.slice(2);
      }
      noWaInput.value = val;
    });
  }

  // ---------------------------------------------------------------------------
  // MANAJEMEN UNGGAH BERKAS (SECURITY & CLIENT VALIDATION)
  // ---------------------------------------------------------------------------
  const ALLOWED_EXTS = ['.pdf', '.jpg', '.jpeg', '.png'];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function setupFileInput(inputId, infoBoxId) {
    const fileInput = document.getElementById(inputId);
    const infoBox = document.getElementById(infoBoxId);
    if (!fileInput || !infoBox) return;

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const ext = '.' + file.name.split('.').pop().toLowerCase();

        // Validasi Ekstensi
        if (!ALLOWED_EXTS.includes(ext)) {
          alert(`Format file "${file.name}" tidak diizinkan! Hanya diperbolehkan file PDF, JPG, dan PNG.`);
          fileInput.value = '';
          infoBox.classList.remove('active');
          return;
        }

        // Validasi Ukuran File
        if (file.size > MAX_FILE_SIZE) {
          alert(`Ukuran file "${file.name}" terlalu besar (${formatBytes(file.size)}). Maksimal ukuran file adalah 5 MB.`);
          fileInput.value = '';
          infoBox.classList.remove('active');
          return;
        }

        // Tampilkan info file
        const textSpan = infoBox.querySelector('.file-name-text');
        if (textSpan) {
          textSpan.textContent = `✓ ${file.name} (${formatBytes(file.size)})`;
        }
        infoBox.classList.add('active');

        // Hapus error jika ada
        const card = fileInput.closest('.upload-card') || fileInput.closest('.file-upload-card');
        if (card) card.classList.remove('has-error');
      } else {
        infoBox.classList.remove('active');
      }
    });
  }

  setupFileInput('fotoKtp', 'infoKtp');
  setupFileInput('cv', 'infoCv');
  setupFileInput('suratLamaran', 'infoSurat');

  // Global helper untuk clear file
  window.clearFileInput = function (inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.value = '';
    const infoMap = {
      fotoKtp: 'infoKtp',
      cv: 'infoCv',
      suratLamaran: 'infoSurat',
    };
    const infoBox = document.getElementById(infoMap[inputId]);
    if (infoBox) infoBox.classList.remove('active');
  };

  // ---------------------------------------------------------------------------
  // SUBMIT FORMULIR VIA MULTIPART/FORM-DATA
  // ---------------------------------------------------------------------------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors();
    if (alertBox) alertBox.innerHTML = '';

    // Cek berkas wajib KTP dan CV
    const ktpInput = document.getElementById('fotoKtp');
    const cvInput = document.getElementById('cv');

    let hasFileError = false;
    if (!ktpInput.files || ktpInput.files.length === 0) {
      document.getElementById('cardKtp').classList.add('has-error');
      hasFileError = true;
    }
    if (!cvInput.files || cvInput.files.length === 0) {
      document.getElementById('cardCv').classList.add('has-error');
      hasFileError = true;
    }

    // Validasi HTML5 bawaan
    if (!form.checkValidity() || hasFileError) {
      let hasFirstError = false;
      form.querySelectorAll(':invalid').forEach((el) => {
        if (el.name) {
          markFieldError(el.name);
          if (!hasFirstError) {
            el.focus();
            hasFirstError = true;
          }
        }
      });

      showAlert(
        'alert-danger',
        'Mohon lengkapi seluruh kolom wajib bertanda bintang (*) dan pastikan Foto KTP serta CV telah Anda pilih.'
      );
      return;
    }

    // Bangun FormData dengan berkas biner
    const formData = new FormData(form);

    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner"></span> Sedang Mengunggah & Mengirim...';

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        // PENTING: Jangan set Content-Type header manual agar browser membuat boundary multipart otomatis
        body: formData,
      });

      const data = await res.json();

      if (data && data.ok) {
        form.reset();
        document.querySelectorAll('.file-selected-info').forEach((el) => el.classList.remove('active'));

        if (successModal) {
          successModal.classList.add('active');
        } else {
          form.style.display = 'none';
          showAlert('alert-success', data.message || 'Lamaran & berkas berhasil dikirim! Terima kasih.');
        }
      } else {
        if (data && data.errors && Array.isArray(data.errors)) {
          data.errors.forEach((err) => markFieldError(err.path, err.msg));
        }
        showAlert(
          'alert-danger',
          data.message || 'Gagal mengirim formulir. Silakan periksa kembali data Anda.'
        );
      }
    } catch (err) {
      console.error('Submit error:', err);
      showAlert(
        'alert-danger',
        'Terjadi kendala jaringan saat mengunggah berkas. Pastikan ukuran file tidak melebihi 5 MB dan koneksi Anda stabil.'
      );
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
})();
