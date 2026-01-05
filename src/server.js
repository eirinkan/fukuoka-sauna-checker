require('dotenv').config();

const express = require('express');
const path = require('path');
const { scrapeAll, getAvailability } = require('./scraper');
const { PRICING } = require('./pricing');

const app = express();
const PORT = process.env.PORT || 3000;

// 静的ファイル配信
app.use(express.static(path.join(__dirname, '../public')));

// API: 空き状況取得
app.get('/api/availability', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const data = getAvailability(date);
  res.json(data);
});

// API: 手動更新トリガー（POST/GET両対応 - Cloud Scheduler用）
const handleRefresh = async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] スクレイピング開始 (${req.method})`);
    await scrapeAll();
    console.log(`[${new Date().toISOString()}] スクレイピング完了`);
    res.json({ success: true, message: '更新完了' });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] スクレイピングエラー:`, error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
app.post('/api/refresh', handleRefresh);
app.get('/api/refresh', handleRefresh);

// API: ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API: 料金情報取得
app.get('/api/pricing', (req, res) => {
  res.json(PRICING);
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`サーバー起動: http://localhost:${PORT}`);

  // 起動時に初回スクレイピング実行（setImmediateで遅延実行し、Expressコールバック外で実行）
  setImmediate(async () => {
    console.log('初回スクレイピング開始...');
    try {
      await scrapeAll();
      console.log('初回スクレイピング完了');
    } catch (error) {
      console.error('初回スクレイピングエラー:', error.message);
    }
  });
});
