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
