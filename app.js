const { middleware, messagingApi } = require('@line/bot-sdk');
const express = require('express');
const cron = require('node-cron');
const path = require('path');
const db = require('./db/database');
const { pushScheduled } = require('./routes/scheduler');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'daycare2024';

const client = new messagingApi.MessagingApiClient(config);
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/webhook', middleware(config), (req, res) => {
  req.body.events.forEach(event => {
    if (event.source && event.source.type === 'group') {
      const savedGroupId = db.getGroupId();
      if (!savedGroupId) {
        db.saveGroupId(event.source.groupId);
        console.log('✅ 群組ID已儲存:', event.source.groupId);
      }
    }
  });
  res.json({ status: 'ok' });
});

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: '密碼錯誤' });
  }
});

app.post('/api/save', (req, res) => {
  const { password, content, scheduledTime } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: '未授權' });
  }
  if (!content || !content.trim()) {
    return res.status(400).json({ success: false, message: '內容不能為空' });
  }
  db.saveMessage(content.trim(), scheduledTime || null);
  res.json({ success: true, message: '已儲存，將於排程時間推播' });
});

app.post('/api/push-now', async (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: '未授權' });
  }
  const groupId = db.getGroupId();
  if (!groupId) {
    return res.status(400).json({ success: false, message: '尚未設定群組ID，請先把 Bot 加入群組並讓群組有人說話' });
  }
  const msg = db.getPendingMessage();
  if (!msg) {
    return res.status(400).json({ success: false, message: '目前沒有待推播的內容，請先儲存交班內容' });
  }
  try {
    await client.pushMessage({ to: groupId, messages: [{ type: 'text', text: msg.content }] });
    db.markMessageSent(msg.id);
    res.json({ success: true, message: '推播成功！' });
  } catch (err) {
    console.error('推播失敗:', err.message);
    res.status(500).json({ success: false, message: '推播失敗：' + err.message });
  }
});

app.get('/api/status', (req, res) => {
  const password = req.query.password;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: '未授權' });
  }
  const msg = db.getPendingMessage();
  const groupId = db.getGroupId();
  res.json({
    success: true,
    groupConnected: !!groupId,
    pending: msg ? {
      content: msg.content,
      scheduledTime: msg.scheduled_time,
      savedAt: msg.created_at
    } : null
  });
});

app.get('/', (req, res) => res.send('交班小幫手運行中 ✅'));

cron.schedule('0 7 * * *', async () => {
  console.log('⏰ 07:00 自動推播');
  await pushScheduled(client, db);
}, { timezone: 'Asia/Taipei' });

cron.schedule('30 18 * * *', async () => {
  console.log('⏰ 18:30 提醒推播');
  const groupId = db.getGroupId();
  const msg = db.getPendingMessage();
  if (!groupId) return;

  const today = new Date().toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric'
  });

  let text = '';
  if (msg) {
    text = `📋 ${today} 交班預覽\n─────────────────\n${msg.content}\n─────────────────\n⏰ 明日 07:00 將自動推播給早班\n✏️ 如需修改請至推播控制頁面更新`;
  } else {
    text = `⚠️ 提醒：今日尚未設定交班內容\n請主管至推播控制頁面輸入交班內容\n⏰ 明日 07:00 將自動推播`;
  }

  try {
    await client.pushMessage({ to: groupId, messages: [{ type: 'text', text }] });
    console.log('✅ 18:30 預覽推播完成');
  } catch (err) {
    console.error('❌ 18:30 推播失敗:', err.message);
  }
}, { timezone: 'Asia/Taipei' });

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 交班小幫手啟動，PORT: ${PORT}`);
  await db.init();
});