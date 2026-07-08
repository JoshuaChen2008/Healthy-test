# Codex 任务卡 05 · 部署前准备 + README 交付项收尾

> 使用方式：把本文件全文复制给 Codex 执行。
> 本卡只做**能自动化的代码/文档收尾**；真正的「上 Vercel、连 Supabase、造已支付 sessionId」由人工在网页操作，不在本卡范围。

## 背景

任务卡 01–04 已完成：三张表、7 个接口、健康算法、四类测试 + CI。
对照 `docs/PRD.md` 第 6 节交付清单，代码侧还差三处**部署前必须补齐**的收尾：

1. **Vercel 上 Prisma 不会自动生成 client** —— 需要一个 `postinstall` 钩子，否则线上构建会报 `@prisma/client did not initialize`。
2. **缺 `.env.example`** —— 评审 clone 仓库后不知道要配哪些环境变量。
3. **README 交付项不全** —— 缺 API 文档入口、`/pay` 付费前后演示、已支付测试 sessionId、CI 徽章还是占位符 `OWNER/REPO`。

先阅读：
- `docs/PRD.md` 第 6 节（交付清单原文）
- `docs/api.md`（已写好的完整 API 文档，README 直接链接它，**不要重复抄一遍**）
- `README.md`（现有内容，尤其顶部徽章行与测试章节）
- `package.json`（现有 scripts）、`lib/prisma.ts`（用 `DATABASE_URL` + pg 适配器）

## ⚠️ 环境约定

- **不要动任何 `.env*` 文件**，也不要把真实连接串写进仓库。`.gitignore` 已忽略 `.env*`，保持现状。
- 不要改动接口逻辑、算法、测试内容——本卡只碰 `package.json`、README 和新增 `.env.example`。
- 改完后 `npm run build` 和 `npm test` 必须仍然通过。

## 任务

### 1. 补 Prisma 构建钩子

在 `package.json` 的 `scripts` 增加：

```json
"postinstall": "prisma generate"
```

原因：Vercel 每次构建会重装依赖并缓存 `node_modules`，`@prisma/client` 需在装完依赖后重新生成，否则线上运行时报错。本地不受影响。

### 2. 新增 `.env.example`

在仓库根目录新建 `.env.example`，列出运行/测试所需环境变量的**键名和示例值（不含真实密钥）**：

```
# 应用运行 + 集成测试所需的 Postgres 连接串
DATABASE_URL="postgresql://user:password@host:5432/dbname"
```

如果代码里还读了其它环境变量，一并补上并加注释说明用途。

### 3. README 交付项收尾

- **修徽章**：把第 1 行 `OWNER/REPO` 换成真实的 `<github-用户名>/<仓库名>`。若此刻仓库名未定，用醒目的 `TODO(owner/repo)` 占位并在交付汇报里点名提醒人工替换。
- **加「API 文档」一节**：一句话说明所有接口的请求/响应与 curl 示例见 [`docs/api.md`](docs/api.md)，并把 `/pay` **付费前 vs 付费后**的两条对比 curl 直接贴到 README（方便评审一眼看到 funnel 差异）。
- **加「在线演示 / 已支付 sessionId」一节**，用占位区块，等人工部署后回填：
  ```
  - 线上地址：TODO(部署后填 Vercel URL)
  - 已支付测试 userId：TODO(部署后用 /api/pay 造一个并填这里)
  ```
- **加「环境变量」一节**：说明复制 `.env.example` 为 `.env`（或 Vercel 配 `DATABASE_URL`）即可。

## 交付要求

- `package.json` 含 `postinstall`；`.env.example` 已建；README 补齐上述四节。
- `npm run build`、`npm test` 均通过。
- 汇报：哪些地方留了 `TODO(...)` 占位需要人工回填，逐条列出。

## 验收标准（自检后逐条汇报）

- [ ] `package.json` 有 `"postinstall": "prisma generate"`
- [ ] 根目录有 `.env.example`，列出 `DATABASE_URL`（示例值，非真实密钥）
- [ ] README 徽章占位符已处理（替换或显式 TODO 提醒）
- [ ] README 有「API 文档」一节，链接 `docs/api.md` + 贴 `/pay` 前后对比 curl
- [ ] README 有「在线演示 / 已支付 sessionId」占位区块
- [ ] README 有「环境变量」一节
- [ ] `npm run build`、`npm test` 通过
- [ ] 未改动 `.env*`、接口逻辑、算法、测试内容
- [ ] 列出所有留待人工回填的 TODO
