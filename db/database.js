const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'daycare.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      scheduled_time TEXT,
      is_sent INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('group_id', '')`).run();
  console.log('✅ 資料庫初始化完成');
}

// 儲存交班訊息（覆蓋舊的未推播訊息）
function saveMessage(content, scheduledTime) {
  // 先刪除未推播的舊訊息
  db.prepare(`DELETE FROM messages WHERE is_sent = 0`).run();
  // 新增新訊息
  db.prepare(`
    INSERT INTO messages (content, scheduled_time)
    VALUES (?, ?)
  `).run(content, scheduledTime);
}

// 取得待推播訊息
function getPendingMessage() {
  return db.prepare(`
    SELECT * FROM messages WHERE is_sent = 0 ORDER BY created_at DESC LIMIT 1
  `).get();
}

// 標記已推播
function markMessageSent(id) {
  db.prepare(`UPDATE messages SET is_sent = 1 WHERE id = ?`).run(id);
}

// 清除已推播訊息（保留最近7筆紀錄）
function cleanOldMessages() {
  db.prepare(`
    DELETE FROM messages WHERE is_sent = 1 AND id NOT IN (
      SELECT id FROM messages ORDER BY created_at DESC LIMIT 7
    )
  `).run();
}

// 群組ID
function saveGroupId(groupId) {
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('group_id', ?)`).run(groupId);
}

function getGroupId() {
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'group_id'`).get();
  return row && row.value ? row.value : null;
}

module.exports = {
  init,
  saveMessage,
  getPendingMessage,
  markMessageSent,
  cleanOldMessages,
  saveGroupId,
  getGroupId,
};
