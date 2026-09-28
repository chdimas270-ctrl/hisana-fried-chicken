// Penyimpanan data sederhana berbasis file JSON.
// Cukup untuk skala 1 outlet. Setiap tulis dilakukan atomik (tulis ke file
// sementara lalu rename) supaya data tidak korup kalau server mati mendadak.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function ensureFile(file, defaultValue) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
  }
}

function init() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  ensureFile(SUBMISSIONS_FILE, []);
  ensureFile(SETTINGS_FILE, { pria: true, wanita: true });
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeJSONAtomic(file, data) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

// --- Settings (status buka/tutup lamaran) ---
function getSettings() {
  return readJSON(SETTINGS_FILE);
}

function setSettings(partial) {
  const current = getSettings();
  const updated = { ...current, ...partial };
  writeJSONAtomic(SETTINGS_FILE, updated);
  return updated;
}

// --- Submissions (data lamaran) ---
// Serialisasi tulis sederhana: karena Node.js single-thread dan tiap operasi
// di sini sinkron, tidak ada race condition antar-request selama file I/O
// tidak di-await bersamaan dengan I/O lain yang menyentuh file yang sama.
function listSubmissions() {
  return readJSON(SUBMISSIONS_FILE);
}

function addSubmission(entry) {
  const all = listSubmissions();
  all.push(entry);
  writeJSONAtomic(SUBMISSIONS_FILE, all);
  return entry;
}

function deleteSubmission(id) {
  const all = listSubmissions();
  const filtered = all.filter((s) => s.id !== id);
  writeJSONAtomic(SUBMISSIONS_FILE, filtered);
  return filtered.length !== all.length;
}

function getSubmission(id) {
  const all = listSubmissions();
  return all.find((s) => s.id === id) || null;
}

module.exports = {
  init,
  getSettings,
  setSettings,
  listSubmissions,
  getSubmission,
  addSubmission,
  deleteSubmission,
};
