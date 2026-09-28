document.getElementById('year').textContent = new Date().getFullYear();

const params = new URLSearchParams(window.location.search);
const gender = params.get('g') === 'wanita' ? 'wanita' : 'pria';
document.getElementById('jenisKelamin').value = gender;
document.getElementById('form-title').textContent =
  'Formulir Lamaran — ' + (gender === 'pria' ? 'Pria' : 'Wanita');

const form = document.getElementById('applyForm');
const alertBox = document.getElementById('alert-box');
const submitBtn = document.getElementById('submitBtn');

// Cek dulu apakah kategori ini masih dibuka, supaya pelamar tidak mengisi
// formulir panjang lalu ditolak di akhir.
(async function checkOpen() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.ok && data.status[gender] === false) {
      form.style.display = 'none';
      showAlert('error', 'Mohon maaf, lamaran untuk kategori ini sedang ditutup.');
    }
  } catch (e) {
    console.error(e);
  }
})();

function showAlert(type, message) {
  alertBox.innerHTML = `<div class="alert ${type}">${escapeHtml(message)}</div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function clearFieldErrors() {
  document.querySelectorAll('.field.has-error').forEach((f) => f.classList.remove('has-error'));
}

function markFieldError(name) {
  const input = form.querySelector(`[name="${name}"]`);
  if (input) input.closest('.field').classList.add('has-error');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFieldErrors();
  alertBox.innerHTML = '';

  if (!form.checkValidity()) {
    form.querySelectorAll(':invalid').forEach((el) => {
      if (el.name) markFieldError(el.name);
    });
    showAlert('error', 'Mohon lengkapi semua kolom wajib dengan benar.');
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());

  submitBtn.disabled = true;
  submitBtn.textContent = 'Mengirim...';

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (data.ok) {
      form.reset();
      form.style.display = 'none';
      showAlert('success', data.message || 'Lamaran berhasil dikirim. Terima kasih!');
    } else {
      (data.errors || []).forEach((err) => markFieldError(err.path));
      showAlert('error', data.message || 'Gagal mengirim lamaran.');
    }
  } catch (err) {
    showAlert('error', 'Terjadi kesalahan jaringan. Silakan coba lagi.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Kirim Lamaran';
  }
});
