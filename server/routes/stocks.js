const express = require('express');
const router = express.Router();
const stockService = require('../services/stockService');

// 获取所有股票
router.get('/', async (req, res) => {
  try {
    const stocks = await stockService.getAllStocks();
    res.json({ status: 'OK', data: stocks });
  } catch (error) {
    console.error('获取股票列表失败:', error);
    res.status(500).json({ status: 'ERROR', message: '获取股票列表失败', error: error.message });
  }
});

// 获取单只股票
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const stock = await stockService.getStockById(id);
    if (!stock) {
      return res.status(404).json({ status: 'ERROR', message: '股票不存在' });
    }
    res.json({ status: 'OK', data: stock });
  } catch (error) {
    console.error('获取股票失败:', error);
    res.status(500).json({ status: 'ERROR', message: '获取股票失败', error: error.message });
  }
});

// 获取股票详情（包含持仓和盈亏）
router.get('/:name/detail', async (req, res) => {
  try {
    const { name } = req.params;
    const detail = await stockService.getStockDetail(decodeURIComponent(name));
    res.json({ status: 'OK', data: detail });
  } catch (error) {
    console.error('获取股票详情失败:', error);
    res.status(500).json({ status: 'ERROR', message: '获取股票详情失败', error: error.message });
  }
});

// 创建股票
router.post('/', async (req, res) => {
  try {
    const stockData = req.body;
    const newStock = await stockService.createStock(stockData);
    res.status(201).json({ status: 'OK', message: '股票创建成功', data: newStock });
  } catch (error) {
    console.error('创建股票失败:', error);
    res.status(400).json({ status: 'ERROR', message: '创建股票失败', error: error.message });
  }
});

// 更新股票
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const stockData = req.body;
    const updatedStock = await stockService.updateStock(id, stockData);
    if (!updatedStock) {
      return res.status(404).json({ status: 'ERROR', message: '股票不存在' });
    }
    res.json({ status: 'OK', message: '股票更新成功', data: updatedStock });
  } catch (error) {
    console.error('更新股票失败:', error);
    res.status(400).json({ status: 'ERROR', message: '更新股票失败', error: error.message });
  }
});

// 删除股票
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await stockService.deleteStock(id);
    if (!deleted) {
      return res.status(404).json({ status: 'ERROR', message: '股票不存在' });
    }
    res.json({ status: 'OK', message: '股票删除成功' });
  } catch (error) {
    console.error('删除股票失败:', error);
    res.status(400).json({ status: 'ERROR', message: '删除股票失败', error: error.message });
  }
});

module.exports = router;

