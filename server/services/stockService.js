const db = require('../config/database');
const { calculateCommissionAndTax } = require('../utils/commissionCalculator');

// 股票类型映射：数字 -> 中文
const STOCK_TYPE_MAP = {
  1: 'A股',
  2: '港股',
  3: '美股'
};

// 股票类型反向映射：中文 -> 数字
const STOCK_TYPE_REVERSE_MAP = {
  'A股': 1,
  '港股': 2,
  '美股': 3
};

class StockService {
  // 将数字转换为中文
  convertStockTypeToText(type) {
    if (typeof type === 'number') {
      return STOCK_TYPE_MAP[type] || 'A股';
    }
    return type || 'A股';
  }

  // 将中文转换为数字
  convertStockTypeToNumber(type) {
    if (typeof type === 'string') {
      return STOCK_TYPE_REVERSE_MAP[type] || 1;
    }
    return type || 1;
  }
  // 获取所有股票
  async getAllStocks() {
    const [rows] = await db.execute(
      `SELECT * FROM stocks ORDER BY name ASC`
    );
    // 将数字转换为中文
    return rows.map(row => ({
      ...row,
      stock_type: this.convertStockTypeToText(row.stock_type)
    }));
  }

  // 根据ID获取股票
  async getStockById(id) {
    const [rows] = await db.execute(
      `SELECT * FROM stocks WHERE id = ?`,
      [id]
    );
    const stock = rows[0] || null;
    if (stock) {
      stock.stock_type = this.convertStockTypeToText(stock.stock_type);
    }
    return stock;
  }

  // 根据名称获取股票
  async getStockByName(name) {
    const [rows] = await db.execute(
      `SELECT * FROM stocks WHERE name = ?`,
      [name]
    );
    const stock = rows[0] || null;
    if (stock) {
      stock.stock_type = this.convertStockTypeToText(stock.stock_type);
    }
    return stock;
  }

  // 创建股票
  async createStock(data) {
    const { name, stock_type } = data;

    if (!name || !name.trim()) {
      throw new Error('股票名称不能为空');
    }

    // 如果没有传递 stock_type，使用默认值 'A股'
    const finalStockType = stock_type || 'A股';
    
    if (!['A股', '港股', '美股'].includes(finalStockType)) {
      throw new Error('股票类型必须是 A股、港股 或 美股');
    }

    // 检查是否已存在（需要先转换，因为数据库存储的是数字）
    const existing = await this.getStockByName(name.trim());
    if (existing) {
      throw new Error('股票名称已存在');
    }

    // 将中文转换为数字存储
    const stockTypeNumber = this.convertStockTypeToNumber(finalStockType);

    const [result] = await db.execute(
      `INSERT INTO stocks (name, stock_type) VALUES (?, ?)`,
      [name.trim(), stockTypeNumber]
    );

    return await this.getStockById(result.insertId);
  }

  // 更新股票
  async updateStock(id, data) {
    const existing = await this.getStockById(id);
    if (!existing) {
      return null;
    }

    const { name, stock_type } = data;

    if (!name || !name.trim()) {
      throw new Error('股票名称不能为空');
    }

    if (stock_type && !['A股', '港股', '美股'].includes(stock_type)) {
      throw new Error('股票类型必须是 A股、港股 或 美股');
    }

    // 检查新名称是否已被其他股票使用
    const existingByName = await this.getStockByName(name.trim());
    if (existingByName && existingByName.id !== id) {
      throw new Error('股票名称已被使用');
    }

    // 将中文转换为数字存储
    const finalStockType = stock_type || existing.stock_type || 'A股';
    const stockTypeNumber = this.convertStockTypeToNumber(finalStockType);

    await db.execute(
      `UPDATE stocks SET name = ?, stock_type = ? WHERE id = ?`,
      [name.trim(), stockTypeNumber, id]
    );

    return await this.getStockById(id);
  }

  // 删除股票
  async deleteStock(id) {
    const existing = await this.getStockById(id);
    if (!existing) {
      return false;
    }

    // 检查是否有交易记录关联
    const [transactions] = await db.execute(
      `SELECT COUNT(*) as count FROM transactions WHERE stock_name = ?`,
      [existing.name]
    );

    if (transactions[0].count > 0) {
      throw new Error('该股票存在交易记录，无法删除');
    }

    await db.execute(`DELETE FROM stocks WHERE id = ?`, [id]);
    return true;
  }

  // 获取股票详情（包含持仓和盈亏信息）
  async getStockDetail(stockName) {
    // 获取所有交易记录
    const [transactions] = await db.execute(
      `SELECT * FROM transactions 
       WHERE stock_name = ? 
       ORDER BY transaction_date ASC, created_at ASC`,
      [stockName]
    );

    // 计算当前持仓
    // 使用最低成本法：买入先平空仓再开多仓（选择最高价空仓先平），卖出先平多仓再开空仓（选择最低价多仓先平）
    let currentPosition = 0; // 正数表示多仓，负数表示空仓
    const buyPositions = []; // 多仓持仓记录（按价格从低到高排序）
    const sellPositions = []; // 空仓持仓记录（按价格从高到低排序）

    for (const trans of transactions) {
      if (trans.transaction_type === 'BUY') {
        let remainingBuyQty = trans.quantity;
        
        // 先平空仓（选择卖出价最高的，最大化收益）
        while (remainingBuyQty > 0 && sellPositions.length > 0) {
          // 找到卖出价最高的空仓
          let maxPriceIndex = -1;
          let maxPrice = -1;
          for (let i = 0; i < sellPositions.length; i++) {
            if (sellPositions[i].quantity > 0 && sellPositions[i].price > maxPrice) {
              maxPrice = sellPositions[i].price;
              maxPriceIndex = i;
            }
          }
          
          if (maxPriceIndex === -1) break;
          
          const shortPos = sellPositions[maxPriceIndex];
          const usedQty = Math.min(remainingBuyQty, shortPos.quantity);
          
          shortPos.quantity -= usedQty;
          if (shortPos.quantity <= 0) {
            sellPositions.splice(maxPriceIndex, 1);
          }
          remainingBuyQty -= usedQty;
        }
        
        // 剩余的开多仓（按价格从低到高排序，以便后续选择最低价先平）
        if (remainingBuyQty > 0) {
          const newPos = {
            id: trans.id,
            type: 'BUY',
            quantity: remainingBuyQty,
            price: parseFloat(trans.price),
            date: trans.transaction_date,
            totalAmount: remainingBuyQty * parseFloat(trans.price),
            commission: trans.commission || 0, // 保存完整的买入手续费，在完全平仓时才扣除
            tax: trans.tax || 0, // 保存完整的买入税费，在完全平仓时才扣除
            originalQuantity: trans.quantity // 保存原始数量，用于判断是否完全平仓
          };
          
          // 插入到合适位置（按价格从低到高排序）
          let inserted = false;
          for (let i = 0; i < buyPositions.length; i++) {
            if (newPos.price < buyPositions[i].price) {
              buyPositions.splice(i, 0, newPos);
              inserted = true;
              break;
            }
          }
          if (!inserted) {
            buyPositions.push(newPos);
          }
          currentPosition += remainingBuyQty;
        }
      } else if (trans.transaction_type === 'SELL') {
        let remainingSellQty = trans.quantity;
        
        // 先平多仓（选择买入价最低的，最大化收益）
        while (remainingSellQty > 0 && buyPositions.length > 0) {
          // 买入价最低的在数组最前面（已经排序）
          if (buyPositions[0].quantity <= 0) {
            buyPositions.shift();
            continue;
          }
          
          const longPos = buyPositions[0];
          const usedQty = Math.min(remainingSellQty, longPos.quantity);
          
          longPos.quantity -= usedQty;
          if (longPos.quantity <= 0) {
            buyPositions.shift();
          }
          remainingSellQty -= usedQty;
        }
        
        // 剩余的开空仓（按价格从高到低排序，以便后续选择最高价先平）
        if (remainingSellQty > 0) {
          const newPos = {
            id: trans.id,
            type: 'SHORT_SELL', // 标记为空仓
            quantity: remainingSellQty,
            price: parseFloat(trans.price),
            date: trans.transaction_date,
            totalAmount: remainingSellQty * parseFloat(trans.price),
            commission: trans.commission || 0, // 保存完整的开空仓手续费，在完全平仓时才扣除
            tax: trans.tax || 0, // 保存完整的开空仓税费，在完全平仓时才扣除
            originalQuantity: trans.quantity // 保存原始数量
          };
          
          // 插入到合适位置（按价格从高到低排序）
          let inserted = false;
          for (let i = 0; i < sellPositions.length; i++) {
            if (newPos.price > sellPositions[i].price) {
              sellPositions.splice(i, 0, newPos);
              inserted = true;
              break;
            }
          }
          if (!inserted) {
            sellPositions.push(newPos);
          }
          currentPosition -= remainingSellQty;
        }
      }
    }

    // 合并当前持仓（多仓和空仓）
    const currentPositions = [
      ...buyPositions.filter(p => p.quantity > 0),
      ...sellPositions.filter(p => p.quantity > 0).map(p => ({
        ...p,
        quantity: -p.quantity, // 负数表示空仓
      }))
    ];

    // 获取股票信息以确定股票类型
    const stock = await this.getStockByName(stockName);
    const stockType = stock ? stock.stock_type : 'A股';
    
    // 计算已平仓的盈亏和开平仓明细
    const closedProfitLossResult = this.calculateClosedProfitLossAndDetails(transactions, stockType);
    const closedProfitLoss = closedProfitLossResult.totalProfitLoss;
    const closedPositions = closedProfitLossResult.closedPositions;

    return {
      stockName,
      currentPosition: buyPositions.reduce((sum, p) => sum + p.quantity, 0) - sellPositions.reduce((sum, p) => sum + p.quantity, 0),
      positions: currentPositions,
      closedProfitLoss: parseFloat(closedProfitLoss.toFixed(2)),
      closedPositions: closedPositions, // 开平仓明细
      transactions: transactions.map(t => ({
        ...t,
        price: parseFloat(t.price),
        total_amount: parseFloat(t.total_amount)
      })).sort((a, b) => {
        // 按日期倒序排列（最新的在前），如果日期相同则按创建时间倒序
        const dateA = new Date(a.transaction_date);
        const dateB = new Date(b.transaction_date);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateB.getTime() - dateA.getTime();
        }
        // 如果日期相同，按创建时间倒序
        const createdA = new Date(a.created_at || 0);
        const createdB = new Date(b.created_at || 0);
        return createdB.getTime() - createdA.getTime();
      }), // 成交记录明细，按日期倒序
    };
  }

  // 计算已平仓的盈亏和开平仓明细（使用最低成本法最大化收益）
  calculateClosedProfitLossAndDetails(transactions, stockType = 'A股') {
    const buyPositions = []; // 可用买入持仓 {id, quantity, price, date, commission, tax}
    const sellPositions = []; // 可用卖出持仓（空仓） {id, quantity, price, date, commission, tax}
    const closedPositions = []; // 已平仓明细

    for (const trans of transactions) {
      if (trans.transaction_type === 'BUY') {
        let remainingBuyQty = trans.quantity;
        const originalBuyQty = trans.quantity;
        
        // 先判断这笔买入交易是否全部用于平空仓（没有开新多仓）
        let tempRemainingBuyQty = trans.quantity;
        for (const pos of sellPositions) {
          if (tempRemainingBuyQty <= 0) break;
          tempRemainingBuyQty -= Math.min(tempRemainingBuyQty, pos.quantity);
        }
        const isFullyClosingShort = (tempRemainingBuyQty === 0); // 这笔买入交易是否全部用于平空仓
        
        // 如果全部用于平空仓，计算整笔买入交易的手续费和税费
        let totalBuyCommission = 0;
        let totalBuyTax = 0;
        if (isFullyClosingShort) {
          const totalBuyAmount = parseFloat(trans.price) * originalBuyQty;
          const { commission, tax } = calculateCommissionAndTax(stockType, 'BUY', totalBuyAmount, trans.commission);
          totalBuyCommission = commission;
          totalBuyTax = tax;
        }
        
        // 先平空仓（优先选择卖出价最高的，最大化收益）
        while (remainingBuyQty > 0 && sellPositions.length > 0) {
          // 找到卖出价最高的空仓
          let maxPriceIndex = -1;
          let maxPrice = -1;
          for (let i = 0; i < sellPositions.length; i++) {
            if (sellPositions[i].quantity > 0 && sellPositions[i].price > maxPrice) {
              maxPrice = sellPositions[i].price;
              maxPriceIndex = i;
            }
          }
          
          if (maxPriceIndex === -1) break;
          
          const shortPos = sellPositions[maxPriceIndex];
          const usedQty = Math.min(remainingBuyQty, shortPos.quantity);
          const isLastClosing = (remainingBuyQty - usedQty === 0); // 是否是最后一次平空仓
          
          // 计算平空仓盈亏（包含手续费和税费）
          const revenue = shortPos.price * usedQty; // 开空仓收入
          const cost = parseFloat(trans.price) * usedQty; // 平空仓成本
          
          // 原则：开空仓的手续费和税费只有在开空仓记录被完全平仓时才一次性扣除
          let shortCommission = 0;
          let shortTax = 0;
          if (usedQty === shortPos.quantity) {
            // 完全平仓，扣除全部开空仓手续费和税费
            shortCommission = shortPos.commission || 0;
            shortTax = shortPos.tax || 0;
          }
          // 如果只是部分平仓，不扣除开空仓手续费和税费
          
          // 计算买入手续费和税费
          // 全部用于平空仓时，只在最后一次平空仓时计算整笔买入交易的手续费和税费
          let buyCommission = 0;
          let buyTax = 0;
          if (isFullyClosingShort && isLastClosing) {
            // 最后一次平空仓，计算整笔买入交易的手续费和税费
            buyCommission = totalBuyCommission;
            buyTax = totalBuyTax;
          }
          // 如果不是最后一次，或部分用于平仓、部分开新仓，不计算买入交易的手续费和税费
          
          // 平空仓盈亏 = 开空仓收入 - 平空仓成本 - 开空仓手续费（完全平仓时才扣除） - 开空仓税费（完全平仓时才扣除） - 买入手续费 - 买入税费
          const profitLoss = revenue - cost - shortCommission - shortTax - buyCommission - buyTax;
          
          closedPositions.push({
            openDate: shortPos.date,
            closeDate: trans.transaction_date,
            openPrice: shortPos.price,
            closePrice: parseFloat(trans.price),
            quantity: usedQty,
            profitLoss: parseFloat(profitLoss.toFixed(2)),
            type: 'SHORT' // 卖空
          });
          
          shortPos.quantity -= usedQty;
          if (shortPos.quantity <= 0) {
            sellPositions.splice(maxPriceIndex, 1);
          }
          remainingBuyQty -= usedQty;
        }
        
        // 剩余的开多仓（按价格排序，最低价的在前）
        if (remainingBuyQty > 0) {
          const newPos = {
            id: trans.id,
            quantity: remainingBuyQty,
            price: parseFloat(trans.price),
            date: trans.transaction_date,
            commission: trans.commission || 0, // 保存完整的买入手续费，在完全平仓时才扣除
            tax: trans.tax || 0, // 保存完整的买入税费，在完全平仓时才扣除
            originalQuantity: trans.quantity // 保存原始数量
          };
          
          // 插入到合适位置（按价格从低到高排序）
          let inserted = false;
          for (let i = 0; i < buyPositions.length; i++) {
            if (newPos.price < buyPositions[i].price) {
              buyPositions.splice(i, 0, newPos);
              inserted = true;
              break;
            }
          }
          if (!inserted) {
            buyPositions.push(newPos);
          }
        }
      } else if (trans.transaction_type === 'SELL') {
        let remainingSellQty = trans.quantity;
        const originalSellQty = trans.quantity;
        
        // 先判断这笔卖出交易是否全部用于平仓（没有开新仓）
        // 通过模拟计算 remainingSellQty 最终是否为0
        let tempRemainingSellQty = trans.quantity;
        for (const pos of buyPositions) {
          if (tempRemainingSellQty <= 0) break;
          tempRemainingSellQty -= Math.min(tempRemainingSellQty, pos.quantity);
        }
        const isFullyClosing = (tempRemainingSellQty === 0); // 这笔卖出交易是否全部用于平仓
        
        // 如果全部用于平仓，计算整笔交易的手续费和税费
        let totalSellCommission = 0;
        let totalSellTax = 0;
        if (isFullyClosing) {
          const totalSellAmount = parseFloat(trans.price) * originalSellQty;
          const { commission, tax } = calculateCommissionAndTax(stockType, 'SELL', totalSellAmount, trans.commission);
          totalSellCommission = commission;
          totalSellTax = tax;
        }
        
        // 先平多仓（优先选择买入价最低的，最大化收益）
        while (remainingSellQty > 0 && buyPositions.length > 0) {
          // 找到买入价最低的多仓（第一个就是最低的，因为已经排序）
          if (buyPositions[0].quantity <= 0) {
            buyPositions.shift();
            continue;
          }
          
          const longPos = buyPositions[0];
          const usedQty = Math.min(remainingSellQty, longPos.quantity);
          const isLastClosing = (remainingSellQty - usedQty === 0); // 是否是最后一次平仓
          
          // 计算平多仓盈亏（包含手续费和税费）
          const sellAmount = parseFloat(trans.price) * usedQty; // 卖出金额
          const buyCost = longPos.price * usedQty; // 买入成本
          
          // 原则：买入手续费和税费只有在买入记录被完全平仓时才一次性扣除
          // 判断是否完全平仓：usedQty 等于 longPos.quantity（当前持仓数量）
          // 注意：longPos.quantity 可能小于原始买入数量（如果之前已经部分平仓）
          let buyCommission = 0;
          let buyTax = 0;
          if (usedQty === longPos.quantity) {
            // 完全平仓，扣除全部买入手续费和税费
            buyCommission = longPos.commission || 0;
            buyTax = longPos.tax || 0;
          }
          // 如果只是部分平仓，不扣除买入手续费和税费
          
          // 计算卖出手续费和税费
          let sellCommission = 0;
          let sellTax = 0;
          if (isFullyClosing) {
            // 全部用于平仓，只在最后一次平仓时计算整笔交易的手续费和税费
            if (isLastClosing) {
              // 最后一次平仓，计算整笔交易的手续费和税费
              sellCommission = totalSellCommission;
              sellTax = totalSellTax;
            } else {
              // 不是最后一次，不计算卖出手续费和税费（因为这笔卖出交易还没完全平仓）
              sellCommission = 0;
              sellTax = 0;
            }
          } else {
            // 部分用于平仓、部分开新仓，不计算卖出交易的手续费和税费
            // 因为这笔卖出交易还没完全平仓，开新仓的部分会在将来平仓时计算
            sellCommission = 0;
            sellTax = 0;
          }
          
          // 平多仓盈亏 = 卖出金额 - 买入成本 - 买入手续费（完全平仓时才扣除） - 买入税费（完全平仓时才扣除） - 卖出手续费 - 卖出税费
          const profitLoss = sellAmount - buyCost - buyCommission - buyTax - sellCommission - sellTax;
          
          closedPositions.push({
            openDate: longPos.date,
            closeDate: trans.transaction_date,
            openPrice: longPos.price,
            closePrice: parseFloat(trans.price),
            quantity: usedQty,
            profitLoss: parseFloat(profitLoss.toFixed(2)),
            type: 'LONG' // 多仓
          });
          
          longPos.quantity -= usedQty;
          if (longPos.quantity <= 0) {
            buyPositions.shift();
          }
          remainingSellQty -= usedQty;
        }
        
        // 剩余的开空仓（按价格排序，最高价的在前）
        if (remainingSellQty > 0) {
          const newPos = {
            id: trans.id,
            quantity: remainingSellQty,
            price: parseFloat(trans.price),
            date: trans.transaction_date,
            commission: trans.commission || 0, // 保存完整的开空仓手续费，在完全平仓时才扣除
            tax: trans.tax || 0, // 保存完整的开空仓税费，在完全平仓时才扣除
            originalQuantity: trans.quantity // 保存原始数量
          };
          
          // 插入到合适位置（按价格从高到低排序）
          let inserted = false;
          for (let i = 0; i < sellPositions.length; i++) {
            if (newPos.price > sellPositions[i].price) {
              sellPositions.splice(i, 0, newPos);
              inserted = true;
              break;
            }
          }
          if (!inserted) {
            sellPositions.push(newPos);
          }
        }
      }
    }

    const totalProfitLoss = closedPositions.reduce((sum, p) => sum + p.profitLoss, 0);

    return {
      totalProfitLoss: parseFloat(totalProfitLoss.toFixed(2)),
      closedPositions: closedPositions.sort((a, b) => {
        // 按平仓日期排序
        const dateA = new Date(a.closeDate);
        const dateB = new Date(b.closeDate);
        if (dateA !== dateB) return dateB - dateA; // 最新的在前
        return 0;
      })
    };
  }
}

module.exports = new StockService();

