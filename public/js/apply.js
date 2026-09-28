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

  // Set nilai dan gaya berdasarkan gender
  if (genderInput) genderInput.value = gender;

  if (categoryBadge) {
    categoryBadge.className = `form-category-tag ${gender}`;
    categoryBadge.innerHTML = gender === 'pria' ? '👨‍🍳 Lamaran Kategori Pria' : '👩‍🍳 Lamaran Kategori Wanita';
  }

  if (pageTitle) {
    pageTitle.textContent = `Formulir Lamaran — ${gender === 'pria' ? 'Pria' : 'Wanita'}`;
  }

  if (submitBtn) {
    submitBtn.className = `btn ${gender === 'pria' ? 'btn-orange' : 'btn-red'}`;
  }

  // Cek status lowongan dari server
  async function checkCategoryStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data && data.ok && data.status && data.status[gender] === false) {
        if (form) form.style.display = 'none';
        showAlert('alert-warning', `
          <strong>Pemberitahuan:</strong> Lowongan kerja untuk kategori <strong>${gender === 'pria' ? 'Pria' : 'Wanita'}</strong> saat ini sedang ditutup atau kuota telah terpenuhi. Silakan cek kembali secara berkala.
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
    document.querySelectorAll('.field.has-error').forEach((el) => {
      el.classList.remove('has-error');
    });
  }

  function markFieldError(name, customMsg) {
    const input = form.querySelector(`[name="${name}"]`);
    if (!input) return;
    const field = input.closest('.field');
    if (field) {
      field.classList.add('has-error');
      if (customMsg) {
        const errorMsg = field.querySelector('.error-message');
        if (errorMsg) errorMsg.textContent = customMsg;
      }
    }
  }

  // Hapus tanda error seketika pengguna mulai mengetik
  form.querySelectorAll('input, select, textarea').forEach((input) => {
    input.addEventListener('input', () => {
      const field = input.closest('.field');
      if (field) field.classList.remove('has-error');
    });
  });

  // Format otomatis nomor WhatsApp
  const noHpInput = document.getElementById('noHp');
  if (noHpInput) {
    noHpInput.addEventListener('blur', () => {
      let val = noHpInput.value.trim().replace(/[^0-9+]/g, '');
      if (val.startsWith('+62')) {
        val = '0' + val.slice(3);
      } else if (val.startsWith('62')) {
        val = '0' + val.slice(2);
      }
      noHpInput.value = val;
    });
  }

  // Handle Pengiriman Formulir
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors();
    if (alertBox) alertBox.innerHTML = '';

    // Validasi HTML5 bawaan
    if (!form.checkValidity()) {
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
      showAlert('alert-danger', 'Mohon periksa kembali kolom yang bertanda merah dan lengkapi data wajib.');
      return;
    }

    const payload = Object.fromEntries(new FormData(form).entries());

    // Validasi tambahan format nomor HP
    const phoneClean = payload.noHp.replace(/[\s-]/g, '');
    if (!/^(08|628|\+628)[0-9]{8,13}$/.test(phoneClean)) {
      markFieldError('noHp', 'Nomor HP harus diawali 08 dan memiliki panjang 10-14 digit.');
      showAlert('alert-danger', 'Nomor HP / WhatsApp yang Anda masukkan tidak valid.');
      return;
    }

    // Set status loading
    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner"></span> Sedang Mengirim Data...';

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data && data.ok) {
        form.reset();
        // Tampilkan Modal Sukses
        if (successModal) {
          successModal.classList.add('active');
        } else {
          form.style.display = 'none';
          showAlert('alert-success', data.message || 'Lamaran berhasil dikirim! Terima kasih.');
        }
      } else {
        if (data && data.errors && Array.isArray(data.errors)) {
          data.errors.forEach((err) => markFieldError(err.path, err.msg));
        }
        showAlert('alert-danger', data.message || 'Gagal mengirim lamaran. Silakan periksa kembali data Anda.');
      }
    } catch (err) {
      console.error('Submit error:', err);
      showAlert('alert-danger', 'Terjadi gangguan jaringan saat mengirim data. Pastikan koneksi internet Anda stabil.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
})();
