# 安装指南

## 前置要求

- Node.js (版本 14 或更高)
- MySQL (版本 5.7 或更高)
- npm 或 yarn

## 安装步骤

### 1. 安装后端依赖

```bash
npm install
```

### 2. 安装前端依赖

```bash
cd client
npm install
cd ..
```

或者使用一键安装脚本：

```bash
npm run install-all
```

### 3. 配置数据库

1. 创建 MySQL 数据库（可以使用 MySQL 命令行或 phpMyAdmin）：

```sql
CREATE DATABASE stock_trading CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. 在项目根目录创建 `.env` 文件（复制以下内容并修改）：

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=stock_trading
PORT=5000
```

**重要**：将 `your_password` 替换为您的 MySQL 密码。

### 4. 初始化数据库表

使用 MySQL 命令行：

```bash
mysql -u root -p < database/schema.sql
```

或者手动执行 `database/schema.sql` 文件中的 SQL 语句。

### 5. 启动应用

#### 开发模式（同时启动前后端）：

```bash
npm run dev
```

#### 分别启动：

后端（在项目根目录）：
```bash
npm run server
```

前端（在新终端，项目根目录）：
```bash
npm run client
```

### 6. 访问应用

- 前端：http://localhost:3000
- 后端API：http://localhost:5000

## 测试连接

访问 http://localhost:5000/api/test-db 测试数据库连接是否正常。

## 常见问题

### 数据库连接失败

1. 检查 MySQL 服务是否运行
2. 检查 `.env` 文件中的数据库配置是否正确
3. 检查数据库用户是否有足够权限

### 端口被占用

修改 `.env` 文件中的 `PORT` 值，或修改 `client/package.json` 中的 proxy 配置。

