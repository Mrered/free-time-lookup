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
    // 先备份
    const oldValue = await redis.get(key);
    if (oldValue) {
      await redis.set(key + '_backup', oldValue);
    }
    // 再覆盖
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

// 新增：恢复备份接口
app.post('/api/restore-backup', async (req, res) => {
  try {
    const backup = await redis.get('excel_data_backup');
    if (!backup) return res.status(404).json({ message: '没有可用备份' });
    await redis.set('excel_data', backup);
    res.json({ message: '恢复成功' });
  } catch (err) {
    res.status(500).json({ message: '恢复失败: ' + err.message });
  }
});

app.get('/api/upload-excel', async (req, res) => {
  try {
    const value = await redis.get('excel_data');
    res.json({ value: value ? JSON.parse(value) : [] });
  } catch (err) {
    res.status(500).json({ message: '获取数据失败: ' + err.message });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
}); 