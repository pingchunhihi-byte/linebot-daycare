async function pushScheduled(client, db, prefix) {
  const groupId = db.getGroupId();
  if (!groupId) {
    console.log('⚠️ 尚未設定群組ID');
    return;
  }

  const msg = db.getPendingMessage();
  const today = new Date().toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: 'numeric',
    day: 'numeric'
  });

  let text = '';
  if (msg) {
    text =
      `🌅 早安！${today} 交班內容\n` +
      `─────────────────\n` +
      `${msg.content}\n` +
      `─────────────────\n` +
      `請相關人員注意，今日工作順利 🙏`;
    db.markMessageSent(msg.id);
    db.cleanOldMessages();
  } else {
    text =
      `🌅 早安！${today} 交班內容\n` +
      `─────────────────\n` +
      `今日無特別交班事項\n` +
      `─────────────────\n` +
      `今日工作順利 🙏`;
  }

  try {
    await client.pushMessage(groupId, { type: 'text', text });
    console.log('✅ 07:00 推播完成');
  } catch (err) {
    console.error('❌ 07:00 推播失敗:', err.message);
  }
}

module.exports = { pushScheduled };
