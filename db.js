// Penyimpanan data hibrida: Mendukung file JSON lokal & MongoDB Atlas Cloud (Vercel Serverless)
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Di Vercel serverless, hanya direktori /tmp yang memiliki izin tulis
const DATA_DIR = process.env.VERCEL ? path.join('/tmp', 'data') : path.join(__dirname, 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

let inMemorySubmissions = [];
let inMemorySettings = { pria: true, wanita: true };
let mongoClient = null;
let mongoDb = null;
let isInitialized = false;

function ensureFile(file, defaultValue) {
  if (!fs.existsSync(file)) {
    try {
      fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2));
    } catch (e) {
      console.warn('[DB WARN] Gagal menulis ensureFile:', e.message);
    }
  }
}

function readJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch (e) {
    console.warn('[DB WARN] Gagal membaca JSON file:', e.message);
  }
  return fallback;
}

function writeJSONAtomic(file, data) {
  try {
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  } catch (e) {
    console.warn('[DB WARN] Gagal menulis atomic file:', e.message);
  }
}

function getMongoUri() {
  return (
    process.env.MONGODB_URI ||
    process.env.MONGODB_URL ||
    process.env.STORAGE_URL ||
    process.env.DATABASE_URL ||
    ''
  );
}

async function connectMongo() {
  const uri = getMongoUri();
  if (!uri) return;
  try {
    mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await mongoClient.connect();
    mongoDb = mongoClient.db('hisana_recruitment');
    console.log('✅ [DATABASE] Sukses terhubung ke MongoDB Atlas Cloud!');

    // Sinkronisasi data dari MongoDB ke Memory & Disk
    const remoteSettings = await mongoDb.collection('settings').findOne({ _id: 'global' });
    if (remoteSettings) {
      inMemorySettings = { pria: remoteSettings.pria, wanita: remoteSettings.wanita };
      writeJSONAtomic(SETTINGS_FILE, inMemorySettings);
    } else {
      await mongoDb.collection('settings').updateOne(
        { _id: 'global' },
        { $set: inMemorySettings },
        { upsert: true }
      );
    }

    const remoteSubmissions = await mongoDb.collection('submissions').find().toArray();
    if (remoteSubmissions && remoteSubmissions.length > 0) {
      inMemorySubmissions = remoteSubmissions.map(({ _id, ...rest }) => rest);
      writeJSONAtomic(SUBMISSIONS_FILE, inMemorySubmissions);
    }
  } catch (err) {
    console.warn('⚠️ [DATABASE] Gagal konek MongoDB, beroperasi dengan file lokal/tmp:', err.message);
  }
}

function init() {
  if (!isInitialized) {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {}

    ensureFile(SUBMISSIONS_FILE, []);
    ensureFile(SETTINGS_FILE, { pria: true, wanita: true });

    inMemorySubmissions = readJSON(SUBMISSIONS_FILE, []);
    inMemorySettings = readJSON(SETTINGS_FILE, { pria: true, wanita: true });
    isInitialized = true;
  }

  // Hubungkan ke MongoDB di background jika URI tersedia
  if (getMongoUri() && !mongoDb) {
    connectMongo().catch(() => {});
  }
}

// Inisialisasi awal
init();

// --- Settings (status buka/tutup lamaran) ---
function getSettings() {
  return inMemorySettings;
}

function setSettings(partial) {
  inMemorySettings = { ...inMemorySettings, ...partial };
  writeJSONAtomic(SETTINGS_FILE, inMemorySettings);

  if (mongoDb) {
    mongoDb.collection('settings').updateOne(
      { _id: 'global' },
      { $set: inMemorySettings },
      { upsert: true }
    ).catch(e => console.error('[DB ERROR setSettings]', e.message));
  }
  return inMemorySettings;
}

// --- Submissions (data lamaran) ---
function listSubmissions() {
  return inMemorySubmissions;
}

function addSubmission(entry) {
  inMemorySubmissions.push(entry);
  writeJSONAtomic(SUBMISSIONS_FILE, inMemorySubmissions);

  if (mongoDb) {
    mongoDb.collection('submissions').insertOne({ ...entry }).catch(e => console.error('[DB ERROR addSubmission]', e.message));
  }
  return entry;
}

function deleteSubmission(id) {
  const prevLen = inMemorySubmissions.length;
  inMemorySubmissions = inMemorySubmissions.filter((s) => s.id !== id);
  writeJSONAtomic(SUBMISSIONS_FILE, inMemorySubmissions);

  if (mongoDb) {
    mongoDb.collection('submissions').deleteOne({ id }).catch(e => console.error('[DB ERROR deleteSubmission]', e.message));
  }
  return inMemorySubmissions.length !== prevLen;
}

function getSubmission(id) {
  return inMemorySubmissions.find((s) => s.id === id) || null;
}

// --- Penyimpanan Berkas ke MongoDB Cloud (Opsional untuk Vercel) ---
async function saveFile(filename, buffer, mimetype, originalName) {
  if (mongoDb) {
    try {
      await mongoDb.collection('files').updateOne(
        { filename },
        { $set: { filename, buffer, mimetype, originalName, uploadedAt: new Date() } },
        { upsert: true }
      );
    } catch (e) {
      console.error('[DB ERROR saveFile]', e.message);
    }
  }
}

async function getFile(filename) {
  if (mongoDb) {
    try {
      return await mongoDb.collection('files').findOne({ filename });
    } catch (e) {
      console.error('[DB ERROR getFile]', e.message);
    }
  }
  return null;
}

module.exports = {
  init,
  getSettings,
  setSettings,
  listSubmissions,
  getSubmission,
  addSubmission,
  deleteSubmission,
  saveFile,
  getFile,
};
