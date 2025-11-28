const express = require('express');
const cors = require('cors');
const db = require('./config/database');
const transactionsRouter = require('./routes/transactions');
const stocksRouter = require('./routes/stocks');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api/transactions', transactionsRouter);
app.use('/api/stocks', stocksRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: '服务器运行正常' });
});

// 测试数据库连接
app.get('/api/test-db', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT 1 as test');
    res.json({ status: 'OK', message: '数据库连接成功', data: rows });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: '数据库连接失败', error: error.message });
  }
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    status: 'ERROR', 
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : '请联系管理员'
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});

