const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'daycare.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const initSqlJs = require('sql.js');
let db = null;

function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function init() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    scheduled_time TEXT,
    is_sent INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('group_id', '')`);
  saveDb();
  console.log('✅ 資料庫初始化完成');
}

function saveMessage(content, scheduledTime) {
  db.run(`DELETE FROM messages WHERE is_sent = 0`);
  db.run(`INSERT INTO messages (content, scheduled_time) VALUES (?, ?)`, [content, scheduledTime]);
  saveDb();
}

function getPendingMessage() {
  const stmt = db.prepare(`SELECT * FROM messages WHERE is_sent = 0 ORDER BY created_at DESC LIMIT 1`);
  const row = stmt.getAsObject();
  stmt.free();
  return row && row.id ? row : null;
}

function markMessageSent(id) {
  db.run(`UPDATE messages SET is_sent = 1 WHERE id = ?`, [id]);
  saveDb();
}

function cleanOldMessages() {
  db.run(`DELETE FROM messages WHERE is_sent = 1`);
  saveDb();
}

function saveGroupId(groupId) {
  db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES ('group_id', ?)`, [groupId]);
  saveDb();
}

function getGroupId() {
  const stmt = db.prepare(`SELECT value FROM settings WHERE key = 'group_id'`);
  const row = stmt.getAsObject();
  stmt.free();
  return row && row.value ? row.value : null;
}

module.exports = {
  init, saveMessage, getPendingMessage,
  markMessageSent, cleanOldMessages,
  saveGroupId, getGroupId,
};