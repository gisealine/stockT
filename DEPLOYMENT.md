# 生产环境部署指南

## 前置要求

- Node.js (版本 14 或更高，推荐 16+)
- MySQL (版本 5.7 或更高)
- pnpm 或 npm

## 部署步骤

### 1. 安装依赖

```bash
# 安装后端依赖
pnpm install

# 安装前端依赖
cd client
pnpm install
cd ..
```

或者使用一键安装：

```bash
pnpm install && cd client && pnpm install && cd ..
```

### 2. 配置前端环境变量（可选）

如果需要自定义 API 地址，在 `client` 目录创建 `.env` 或 `.env.production` 文件：

```env
# 如果前后端在同一服务器，使用相对路径（默认）
REACT_APP_API_URL=/api

# 如果前后端分离部署，使用完整 URL
# REACT_APP_API_URL=http://your-api-server:5000/api
```

**注意：**
- 如果不设置，生产环境默认使用相对路径 `/api`（前后端同域）
- 开发环境默认使用 `http://localhost:5000/api`
- 如果前后端分离部署，需要设置完整的 API 地址

### 3. 构建前端应用

```bash
cd client
pnpm run build
cd ..
```

或者使用根目录的构建脚本：

```bash
pnpm run build
```

构建完成后，前端文件会生成在 `client/build` 目录中。

### 4. 配置后端环境变量

在项目根目录创建或修改 `.env` 文件：

```env
NODE_ENV=production
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=stock_trading
PORT=5000
```

**重要配置说明：**
- `NODE_ENV=production`：设置为生产环境模式
- `DB_HOST`：数据库主机地址（生产环境可能是远程地址）
- `DB_USER`：数据库用户名
- `DB_PASSWORD`：数据库密码
- `DB_NAME`：数据库名称
- `PORT`：服务器端口（默认 5000）

### 5. 初始化数据库（如果尚未初始化）

```bash
mysql -u root -p < database/schema.sql
```

### 6. 启动服务器

#### 方式一：直接启动（推荐用于测试）

```bash
# Windows
set NODE_ENV=production && node server/index.js

# Linux/Mac
NODE_ENV=production node server/index.js
```

#### 方式二：使用 PM2（推荐用于生产环境）

首先安装 PM2：

```bash
pnpm install -g pm2
```

然后启动应用：

```bash
# Windows
set NODE_ENV=production && pm2 start server/index.js --name stock-trading

# Linux/Mac
NODE_ENV=production pm2 start server/index.js --name stock-trading
```

PM2 常用命令：

```bash
# 查看运行状态
pm2 status

# 查看日志
pm2 logs stock-trading

# 停止应用
pm2 stop stock-trading

# 重启应用
pm2 restart stock-trading

# 设置开机自启
pm2 startup
pm2 save
```

#### 方式三：使用 systemd（Linux 系统服务）

创建服务文件 `/etc/systemd/system/stock-trading.service`：

```ini
[Unit]
Description=股票交易记录系统
After=network.target mysql.service

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/stock
Environment="NODE_ENV=production"
Environment="PORT=5000"
ExecStart=/usr/bin/node /path/to/stock/server/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl start stock-trading
sudo systemctl enable stock-trading  # 设置开机自启
```

### 6. 配置反向代理（可选，推荐）

使用 Nginx 作为反向代理：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 7. 访问应用

- 应用地址：http://your-server-ip:5000
- 健康检查：http://your-server-ip:5000/api/health
- 数据库测试：http://your-server-ip:5000/api/test-db

## 生产环境注意事项

### 安全建议

1. **数据库安全**
   - 使用强密码
   - 限制数据库访问 IP
   - 使用专用数据库用户，避免使用 root

2. **环境变量安全**
   - 不要将 `.env` 文件提交到版本控制
   - 使用环境变量管理工具（如 AWS Secrets Manager）

3. **HTTPS**
   - 生产环境建议使用 HTTPS
   - 可以使用 Let's Encrypt 免费证书

4. **防火墙**
   - 只开放必要的端口（如 80, 443）
   - 数据库端口（3306）不要对外开放

### 性能优化

1. **使用进程管理器**
   - 推荐使用 PM2 管理 Node.js 进程
   - 可以配置集群模式提高性能

2. **数据库连接池**
   - 已在 `server/config/database.js` 中配置连接池
   - 可根据服务器性能调整 `connectionLimit`

3. **静态文件缓存**
   - 前端构建文件已优化
   - 可通过 Nginx 配置静态文件缓存

### 监控和日志

1. **日志管理**
   - 使用 PM2 的日志功能
   - 或配置日志轮转工具（如 logrotate）

2. **健康检查**
   - 定期访问 `/api/health` 检查服务状态
   - 可以配置监控工具（如 Uptime Robot）

## 故障排查

### 常见问题

1. **端口被占用**
   ```bash
   # 查看端口占用
   netstat -ano | findstr :5000  # Windows
   lsof -i :5000                 # Linux/Mac
   ```

2. **数据库连接失败**
   - 检查 `.env` 配置
   - 检查数据库服务是否运行
   - 检查防火墙设置

3. **前端页面无法访问**
   - 确认已执行 `pnpm run build`
   - 检查 `client/build` 目录是否存在
   - 检查服务器日志

## 更新部署

当需要更新应用时：

```bash
# 1. 拉取最新代码
git pull

# 2. 安装新依赖（如果有）
pnpm install
cd client && pnpm install && cd ..

# 3. 重新构建前端
pnpm run build

# 4. 重启服务
pm2 restart stock-trading
# 或
sudo systemctl restart stock-trading
```

