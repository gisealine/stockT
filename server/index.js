const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./config/database');
const transactionsRouter = require('./routes/transactions');
const stocksRouter = require('./routes/stocks');
const stockCorporateActionsRouter = require('./routes/stockCorporateActions');
const syncRouter = require('./routes/sync');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API 路由（必须在静态文件之前）
app.use('/api/transactions', transactionsRouter);
app.use('/api/stocks', stocksRouter);
app.use('/api/stock-corporate-actions', stockCorporateActionsRouter);
app.use('/api/sync', syncRouter);

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

// 生产环境：提供静态文件（React构建后的文件）
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  // 所有非API请求返回React应用（必须在最后）
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

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
  console.log(`环境: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.NODE_ENV === 'production') {
    console.log('生产模式：前端文件已集成到服务器');
  }
});

