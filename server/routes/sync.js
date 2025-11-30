const express = require('express');
const router = express.Router();
const syncService = require('../services/syncService');

// 同步交易记录（根据分红合股信息）
router.post('/:stockName', async (req, res) => {
  try {
    const { stockName } = req.params;
    const result = await syncService.syncTransactionsByCorporateActions(stockName);
    res.json({ status: 'OK', message: result.message, data: { updated: result.updated } });
  } catch (error) {
    console.error('同步交易记录失败:', error);
    res.status(500).json({ status: 'ERROR', message: '同步交易记录失败', error: error.message });
  }
});

module.exports = router;

