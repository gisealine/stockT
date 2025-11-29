const express = require('express');
const router = express.Router();
const stockCorporateActionService = require('../services/stockCorporateActionService');

// 获取所有公司行为记录
router.get('/', async (req, res) => {
  try {
    const records = await stockCorporateActionService.getAllCorporateActions();
    res.json({ status: 'OK', data: records });
  } catch (error) {
    console.error('获取公司行为记录失败:', error);
    res.status(500).json({ status: 'ERROR', message: '获取公司行为记录失败', error: error.message });
  }
});

// 根据股票名称获取公司行为记录
router.get('/stock/:stockName', async (req, res) => {
  try {
    const { stockName } = req.params;
    const records = await stockCorporateActionService.getCorporateActionsByStock(stockName);
    res.json({ status: 'OK', data: records });
  } catch (error) {
    console.error('获取公司行为记录失败:', error);
    res.status(500).json({ status: 'ERROR', message: '获取公司行为记录失败', error: error.message });
  }
});

// 根据ID获取公司行为记录
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const record = await stockCorporateActionService.getCorporateActionById(id);
    if (!record) {
      return res.status(404).json({ status: 'ERROR', message: '记录不存在' });
    }
    res.json({ status: 'OK', data: record });
  } catch (error) {
    console.error('获取公司行为记录失败:', error);
    res.status(500).json({ status: 'ERROR', message: '获取公司行为记录失败', error: error.message });
  }
});

// 创建公司行为记录
router.post('/', async (req, res) => {
  try {
    const record = await stockCorporateActionService.createCorporateAction(req.body);
    res.status(201).json({ status: 'OK', message: '创建成功', data: record });
  } catch (error) {
    console.error('创建公司行为记录失败:', error);
    res.status(400).json({ status: 'ERROR', message: '创建公司行为记录失败', error: error.message });
  }
});

// 更新公司行为记录
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const record = await stockCorporateActionService.updateCorporateAction(id, req.body);
    res.json({ status: 'OK', message: '更新成功', data: record });
  } catch (error) {
    console.error('更新公司行为记录失败:', error);
    const statusCode = error.message === '记录不存在' ? 404 : 400;
    res.status(statusCode).json({ status: 'ERROR', message: '更新公司行为记录失败', error: error.message });
  }
});

// 删除公司行为记录
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await stockCorporateActionService.deleteCorporateAction(id);
    res.json({ status: 'OK', message: '删除成功' });
  } catch (error) {
    console.error('删除公司行为记录失败:', error);
    const statusCode = error.message === '记录不存在' ? 404 : 400;
    res.status(statusCode).json({ status: 'ERROR', message: '删除公司行为记录失败', error: error.message });
  }
});

module.exports = router;

