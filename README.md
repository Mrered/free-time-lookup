# free-time-lookup 兴趣班空余时间统计 📊

本项目是一个基于 [Next.js](https://nextjs.org) 的兴趣班空余时间统计前端，支持上传 Excel 表格，统计各班级在不同时间段的空余情况。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Mrered/free-time-lookup)

## 🚀 快速开始

### 🖥️ 本地开发

首先你需要 [Node.js](https://nodejs.org/en/download/package-manager/all) 环境。

```bash
# 🧑‍💻 克隆仓库并进入目录
git clone https://github.com/Mrered/free-time-lookup
cd free-time-lookup

# 📦 安装依赖（可选用 npm/yarn/pnpm/bun）
npm install

# ▶️ 启动开发服务器
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000/) 查看效果。

### 🏗️ 构建与生产部署

```bash
npm run build
npm run start
```

此时访问 [http://localhost:3000](http://localhost:3000/) 即可正常使用。

### ⚙️ 环境变量

| 变量名    | 说明           | 示例值                                      |
|-----------|----------------|---------------------------------------------|
| REDIS_URL | Redis 连接地址 | rediss://default:<password>@<host>:<port>   |

你可以在根目录下新建 `.env.local` 文件，写入：

```
REDIS_URL=rediss://default:<password>@<host>:<port>
```

ℹ️ Redis 连接地址可在 Vercel Redis 控制台获取。

## 📁 主要文件说明

- 入口页面：`src/app/page.tsx`
- 全局样式：`src/app/globals.css`

## 🌐 其他

如需部署到 Vercel，可直接点击上方按钮。

---

如需添加更多部署方式或有其他需求，欢迎提 Issue。

---

GitHub 仓库地址：[https://github.com/Mrered/free-time-lookup](https://github.com/Mrered/free-time-lookup)
