-- 数据库迁移脚本
-- 用于将现有数据库升级到新版本
-- 注意：请在执行前备份数据库

USE stock_trading;

-- 1. 创建股票表（如果不存在）
CREATE TABLE IF NOT EXISTS stocks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE COMMENT '股票名称',
    stock_type TINYINT NOT NULL DEFAULT 1 COMMENT '股票类型：1=A股, 2=港股, 3=美股',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_name (name),
    INDEX idx_stock_type (stock_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='股票表';

-- 2. 添加stock_type字段（如果不存在）
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = 'stock_trading' 
    AND TABLE_NAME = 'stocks' 
    AND COLUMN_NAME = 'stock_type'
);

SET @sql = IF(@col_exists = 0, 
    'ALTER TABLE stocks ADD COLUMN stock_type TINYINT NOT NULL DEFAULT 1 COMMENT \'股票类型：1=A股, 2=港股, 3=美股\' AFTER name', 
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. 添加stock_type索引（如果不存在）
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = 'stock_trading' 
    AND TABLE_NAME = 'stocks' 
    AND INDEX_NAME = 'idx_stock_type'
);

SET @sql = IF(@index_exists = 0,
    'ALTER TABLE stocks ADD INDEX idx_stock_type (stock_type)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. 从现有交易记录中提取唯一的股票名称并插入到stocks表
INSERT IGNORE INTO stocks (name, stock_type)
SELECT DISTINCT stock_name, 1 FROM transactions WHERE stock_name IS NOT NULL AND stock_name != '';

-- 5. 添加commission和tax字段（如果不存在）
SET @col_exists_commission = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = 'stock_trading' 
    AND TABLE_NAME = 'transactions' 
    AND COLUMN_NAME = 'commission'
);

SET @sql = IF(@col_exists_commission = 0, 
    'ALTER TABLE transactions ADD COLUMN commission DECIMAL(12, 2) DEFAULT 0 COMMENT \'手续费\' AFTER total_amount', 
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists_tax = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = 'stock_trading' 
    AND TABLE_NAME = 'transactions' 
    AND COLUMN_NAME = 'tax'
);

SET @sql = IF(@col_exists_tax = 0, 
    'ALTER TABLE transactions ADD COLUMN tax DECIMAL(12, 2) DEFAULT 0 COMMENT \'税费\' AFTER commission', 
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. 删除旧的stock_code索引（如果存在）
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = 'stock_trading' 
    AND TABLE_NAME = 'transactions' 
    AND INDEX_NAME = 'idx_stock_code'
);

SET @sql = IF(@index_exists > 0,
    'ALTER TABLE transactions DROP INDEX idx_stock_code',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. 删除stock_code列（如果存在）
SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = 'stock_trading' 
    AND TABLE_NAME = 'transactions' 
    AND COLUMN_NAME = 'stock_code'
);

SET @sql = IF(@col_exists > 0, 
    'ALTER TABLE transactions DROP COLUMN stock_code', 
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. 修改transaction_type枚举，移除SHORT_SELL
ALTER TABLE transactions 
MODIFY COLUMN transaction_type ENUM('BUY', 'SELL') NOT NULL COMMENT '交易类型：买入/卖出';

-- 6. 创建stock_name索引（如果不存在）
SET @index_exists = (
    SELECT COUNT(*) 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = 'stock_trading' 
    AND TABLE_NAME = 'transactions' 
    AND INDEX_NAME = 'idx_stock_name'
);

SET @sql = IF(@index_exists = 0,
    'ALTER TABLE transactions ADD INDEX idx_stock_name (stock_name)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 7. 删除旧的外键约束（如果存在）
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = 'stock_trading' 
    AND TABLE_NAME = 'transactions' 
    AND CONSTRAINT_NAME = 'fk_transactions_stock_name'
);

-- 如果有旧的外键，先删除
SET @sql = IF(@fk_exists > 0,
    'ALTER TABLE transactions DROP FOREIGN KEY fk_transactions_stock_name',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 8. 添加外键约束（如果不存在）
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = 'stock_trading' 
    AND TABLE_NAME = 'transactions' 
    AND CONSTRAINT_NAME = 'fk_transactions_stock_name'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE transactions ADD CONSTRAINT fk_transactions_stock_name FOREIGN KEY (stock_name) REFERENCES stocks(name) ON DELETE RESTRICT',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 9. 创建股票公司行为表（分红、合股等）（如果不存在）
CREATE TABLE IF NOT EXISTS stock_corporate_actions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stock_name VARCHAR(100) NOT NULL COMMENT '股票名称',
    action_type ENUM('DIVIDEND', 'SPLIT', 'REVERSE_SPLIT') NOT NULL COMMENT '行为类型：DIVIDEND=分红, SPLIT=合股/拆股, REVERSE_SPLIT=反向合股',
    action_date DATE NOT NULL COMMENT '行为日期',
    ratio DECIMAL(10, 4) DEFAULT NULL COMMENT '合股比例（如1:2表示2股合1股，1:0.5表示1股拆成2股）',
    amount DECIMAL(12, 5) DEFAULT NULL COMMENT '分红金额（每股）',
    total_amount DECIMAL(12, 2) DEFAULT NULL COMMENT '总分红金额',
    notes TEXT COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_stock_name (stock_name),
    INDEX idx_action_date (action_date),
    INDEX idx_action_type (action_type),
    FOREIGN KEY (stock_name) REFERENCES stocks(name) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='股票公司行为表（分红、合股等）';

-- 10. 修改amount字段精度为5位小数（如果表已存在且字段精度不是5）
SET @table_exists = (
    SELECT COUNT(*) 
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = 'stock_trading' 
    AND TABLE_NAME = 'stock_corporate_actions'
);

SET @col_exists = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = 'stock_trading' 
    AND TABLE_NAME = 'stock_corporate_actions' 
    AND COLUMN_NAME = 'amount'
);

SET @col_precision = (
    SELECT NUMERIC_SCALE
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = 'stock_trading' 
    AND TABLE_NAME = 'stock_corporate_actions' 
    AND COLUMN_NAME = 'amount'
);

SET @sql = IF(@table_exists > 0 AND @col_exists > 0 AND @col_precision != 5,
    'ALTER TABLE stock_corporate_actions MODIFY COLUMN amount DECIMAL(12, 5) DEFAULT NULL COMMENT \'分红金额（每股）\'',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 11. 添加原始交易数量和原始交易价格字段（如果不存在）
SET @col_exists_original_quantity = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = 'stock_trading' 
    AND TABLE_NAME = 'transactions' 
    AND COLUMN_NAME = 'original_quantity'
);

SET @sql = IF(@col_exists_original_quantity = 0, 
    'ALTER TABLE transactions ADD COLUMN original_quantity INT DEFAULT NULL COMMENT \'原始交易数量（股）\' AFTER price', 
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists_original_price = (
    SELECT COUNT(*) 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = 'stock_trading' 
    AND TABLE_NAME = 'transactions' 
    AND COLUMN_NAME = 'original_price'
);

SET @sql = IF(@col_exists_original_price = 0, 
    'ALTER TABLE transactions ADD COLUMN original_price DECIMAL(10, 2) DEFAULT NULL COMMENT \'原始交易价格\' AFTER original_quantity', 
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
