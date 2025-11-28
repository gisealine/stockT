const express = require('express');
const router = express.Router();
const db = require('../config/database');
const transactionService = require('../services/transactionService');

// 获取所有交易记录
router.get('/', async (req, res) => {
  try {
    const transactions = await transactionService.getAllTransactions();
    res.json({ status: 'OK', data: transactions });
  } catch (error) {
    console.error('获取交易记录失败:', error);
    res.status(500).json({ status: 'ERROR', message: '获取交易记录失败', error: error.message });
  }
});

// 根据股票名称获取交易记录
router.get('/stock/:stockName', async (req, res) => {
  try {
    const { stockName } = req.params;
    const transactions = await transactionService.getTransactionsByStock(decodeURIComponent(stockName));
    res.json({ status: 'OK', data: transactions });
  } catch (error) {
    console.error('获取交易记录失败:', error);
    res.status(500).json({ status: 'ERROR', message: '获取交易记录失败', error: error.message });
  }
});

// 获取单笔交易记录
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await transactionService.getTransactionById(id);
    if (!transaction) {
      return res.status(404).json({ status: 'ERROR', message: '交易记录不存在' });
    }
    res.json({ status: 'OK', data: transaction });
  } catch (error) {
    console.error('获取交易记录失败:', error);
    res.status(500).json({ status: 'ERROR', message: '获取交易记录失败', error: error.message });
  }
});

// 创建交易记录
router.post('/', async (req, res) => {
  try {
    const transactionData = req.body;
    const newTransaction = await transactionService.createTransaction(transactionData);
    res.status(201).json({ status: 'OK', message: '交易记录创建成功', data: newTransaction });
  } catch (error) {
    console.error('创建交易记录失败:', error);
    res.status(400).json({ status: 'ERROR', message: '创建交易记录失败', error: error.message });
  }
});

// 更新交易记录
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const transactionData = req.body;
    const updatedTransaction = await transactionService.updateTransaction(id, transactionData);
    if (!updatedTransaction) {
      return res.status(404).json({ status: 'ERROR', message: '交易记录不存在' });
    }
    res.json({ status: 'OK', message: '交易记录更新成功', data: updatedTransaction });
  } catch (error) {
    console.error('更新交易记录失败:', error);
    res.status(400).json({ status: 'ERROR', message: '更新交易记录失败', error: error.message });
  }
});

// 删除交易记录
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await transactionService.deleteTransaction(id);
    if (!deleted) {
      return res.status(404).json({ status: 'ERROR', message: '交易记录不存在' });
    }
    res.json({ status: 'OK', message: '交易记录删除成功' });
  } catch (error) {
    console.error('删除交易记录失败:', error);
    res.status(500).json({ status: 'ERROR', message: '删除交易记录失败', error: error.message });
  }
});

// 获取盈亏统计
router.get('/stats/profit-loss', async (req, res) => {
  try {
    const stats = await transactionService.getProfitLossStats();
    res.json({ status: 'OK', data: stats });
  } catch (error) {
    console.error('获取盈亏统计失败:', error);
    res.status(500).json({ status: 'ERROR', message: '获取盈亏统计失败', error: error.message });
  }
});

module.exports = router;

