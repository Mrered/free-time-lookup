const express = require('express');
const Redis = require('ioredis');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const redis = new Redis(process.env.REDIS_URL);

app.post('/api/upload-excel', async (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) {
    return res.status(400).json({ message: '缺少 key 或 value' });
  }
  try {
    await redis.set(key, JSON.stringify(value));
    res.json({ message: '写入成功' });
  } catch (err) {
    res.status(500).json({ message: '写入失败: ' + err.message });
  }
});

app.post('/api/clear-kv', async (req, res) => {
  try {
    await redis.flushdb();
    res.json({ message: '数据库已清空' });
  } catch (err) {
    res.status(500).json({ message: '清空失败: ' + err.message });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
}); 