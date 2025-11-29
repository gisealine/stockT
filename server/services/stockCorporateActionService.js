const db = require('../config/database');

class StockCorporateActionService {
  // 获取所有公司行为记录
  async getAllCorporateActions() {
    const [rows] = await db.execute(
      `SELECT * FROM stock_corporate_actions 
       ORDER BY action_date DESC, created_at DESC`
    );
    return rows;
  }

  // 根据股票名称获取公司行为记录
  async getCorporateActionsByStock(stockName) {
    const [rows] = await db.execute(
      `SELECT * FROM stock_corporate_actions 
       WHERE stock_name = ? 
       ORDER BY action_date DESC, created_at DESC`,
      [stockName]
    );
    return rows;
  }

  // 根据ID获取公司行为记录
  async getCorporateActionById(id) {
    const [rows] = await db.execute(
      `SELECT * FROM stock_corporate_actions WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  // 创建公司行为记录
  async createCorporateAction(data) {
    const {
      stock_name,
      action_type,
      action_date,
      ratio,
      amount,
      notes
    } = data;

    // 验证必填字段
    if (!stock_name || !action_type || !action_date) {
      throw new Error('缺少必填字段：股票名称、行为类型、行为日期');
    }

    // 验证行为类型
    if (!['DIVIDEND', 'SPLIT', 'REVERSE_SPLIT'].includes(action_type)) {
      throw new Error('无效的行为类型');
    }

    // 验证：分红必须填写每股金额
    if (action_type === 'DIVIDEND' && !amount) {
      throw new Error('分红必须填写每股金额');
    }

    // 验证：合股必须填写比例
    if ((action_type === 'SPLIT' || action_type === 'REVERSE_SPLIT') && !ratio) {
      throw new Error('合股/拆股必须填写比例');
    }

    // 检查股票是否存在
    const [stockRows] = await db.execute(
      `SELECT id FROM stocks WHERE name = ?`,
      [stock_name]
    );
    if (stockRows.length === 0) {
      throw new Error('股票不存在');
    }

    // 插入记录
    const [result] = await db.execute(
      `INSERT INTO stock_corporate_actions 
       (stock_name, action_type, action_date, ratio, amount, total_amount, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [stock_name, action_type, action_date, ratio || null, amount || null, null, notes || null]
    );

    return this.getCorporateActionById(result.insertId);
  }

  // 更新公司行为记录
  async updateCorporateAction(id, data) {
    const {
      stock_name,
      action_type,
      action_date,
      ratio,
      amount,
      notes
    } = data;

    // 检查记录是否存在
    const existing = await this.getCorporateActionById(id);
    if (!existing) {
      throw new Error('记录不存在');
    }

    // 验证必填字段
    if (!stock_name || !action_type || !action_date) {
      throw new Error('缺少必填字段：股票名称、行为类型、行为日期');
    }

    // 验证行为类型
    if (!['DIVIDEND', 'SPLIT', 'REVERSE_SPLIT'].includes(action_type)) {
      throw new Error('无效的行为类型');
    }

    // 验证：分红必须填写每股金额
    if (action_type === 'DIVIDEND' && !amount) {
      throw new Error('分红必须填写每股金额');
    }

    // 验证：合股必须填写比例
    if ((action_type === 'SPLIT' || action_type === 'REVERSE_SPLIT') && !ratio) {
      throw new Error('合股/拆股必须填写比例');
    }

    // 更新记录
    await db.execute(
      `UPDATE stock_corporate_actions 
       SET stock_name = ?, action_type = ?, action_date = ?, 
           ratio = ?, amount = ?, total_amount = ?, notes = ?
       WHERE id = ?`,
      [stock_name, action_type, action_date, ratio || null, amount || null, null, notes || null, id]
    );

    return this.getCorporateActionById(id);
  }

  // 删除公司行为记录
  async deleteCorporateAction(id) {
    const existing = await this.getCorporateActionById(id);
    if (!existing) {
      throw new Error('记录不存在');
    }

    await db.execute(
      `DELETE FROM stock_corporate_actions WHERE id = ?`,
      [id]
    );

    return true;
  }
}

module.exports = new StockCorporateActionService();

