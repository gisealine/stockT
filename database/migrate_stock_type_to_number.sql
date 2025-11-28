-- 将 stock_type 从 ENUM 中文改为 TINYINT 数字
-- 映射：1=A股, 2=港股, 3=美股

USE stock_trading;

-- 1. 添加临时列存储转换后的值
ALTER TABLE stocks ADD COLUMN stock_type_temp TINYINT DEFAULT 1;

-- 2. 将现有数据转换为数字
UPDATE stocks SET stock_type_temp = 
  CASE 
    WHEN stock_type = 'A股' THEN 1
    WHEN stock_type = '港股' THEN 2
    WHEN stock_type = '美股' THEN 3
    ELSE 1
  END;

-- 3. 删除旧列
ALTER TABLE stocks DROP COLUMN stock_type;

-- 4. 重命名临时列为 stock_type
ALTER TABLE stocks CHANGE COLUMN stock_type_temp stock_type TINYINT NOT NULL DEFAULT 1 COMMENT '股票类型：1=A股, 2=港股, 3=美股';

-- 5. 确保索引存在
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

-- 6. 验证结果
SELECT id, name, stock_type, 
  CASE stock_type
    WHEN 1 THEN 'A股'
    WHEN 2 THEN '港股'
    WHEN 3 THEN '美股'
    ELSE '未知'
  END AS stock_type_text
FROM stocks LIMIT 10;

