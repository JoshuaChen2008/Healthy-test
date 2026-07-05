# Codex 任务卡 01 · 初始化项目 + 建数据库表

> 使用方式：把本文件全文复制给 Codex 执行。

## 背景

这是一个「健康测评系统后端」项目（面试挑战）。设计文档已就绪，请**先阅读**：
- `docs/PRD.md`（要做什么）
- `docs/tech-design.md`（技术选型、API 清单、校验规则、测试策略）
- `docs/schema-design.md`（数据库三张表的字段与关系）——**本任务以它为准**

技术栈：Next.js (App Router) + TypeScript、Prisma + Supabase (PostgreSQL)。

## 本次任务范围

只做「初始化项目 + 建表 + 生成 ERD 图」，**不写业务接口**（接口是后续任务）。

## 步骤

1. **初始化 Next.js 项目**（package name 用 `health-assessment`）
   - App Router + TypeScript + ESLint + Tailwind CSS
   - 最终状态：项目代码与现有 `docs/` 位于**同一个仓库根目录**。
   - 若在当前非空目录初始化报错，可先初始化到子目录再把 `docs/` 并入，保证单一仓库根目录。

2. **安装并初始化 Prisma**
   - 安装 `prisma`（dev）与 `@prisma/client`
   - `npx prisma init`

3. **配置数据库连接**
   - `datasource` 使用 `provider = "postgresql"`，`url = env("DATABASE_URL")`，`directUrl = env("DIRECT_URL")`
   - 在 `.env` 中放置这两个变量（**占位值即可**）：
     ```
     DATABASE_URL="postgresql://...:6543/postgres?pgbouncer=true"
     DIRECT_URL="postgresql://...:5432/postgres"
     ```
   - ⚠️ 真实连接串与密码由**用户本人**填入 `.env`，你不要索取或写入真实密码。

4. **编写 `schema.prisma`**，严格照 `docs/schema-design.md`：
   - `User`：id(UUID 主键)、createdAt、updatedAt；关系 assessments(1:多)、subscription(1:1 可空)
   - `Assessment`：
     - 核心列：gender、goal、age(Int)、heightCm(Float)、weightKg(Float)、targetWeightKg(Float)、workoutFrequency，均可空
     - `answers Json`，默认空对象 `{}`
     - 可选联系方式：email、name（可空）
     - 进度与结果：currentStep(Int, 默认0)、status(默认 "in_progress")、bmi、recommendedCalories、targetDate，可空
     - createdAt、updatedAt
     - `userId` 外键 → User.id（**不唯一**，加普通索引）
   - `Subscription`：id、userId(外键→User.id，**唯一**)、status(默认 "free")、paidAt(可空)、createdAt、updatedAt
   - 枚举值（gender/goal/workoutFrequency/status）用 Prisma enum 或应用层校验，二选一保持一致，并在代码中注明选择理由。

5. **建表**：运行 `npx prisma db push`，把三张表建到 Supabase。

6. **生成 ERD 关系图**：接入 `prisma-erd-generator`（或等价方案），把三张表关系图输出到 `docs/schema-erd.svg`（或 .png）。

7. **配置 `.gitignore`**：确保忽略 `.env`、`node_modules/`、`.next/`。**`.env` 绝不进仓库。**

8. **初始化 git 并首次提交**（若尚未初始化）。commit message 用清晰英文，如 `chore: init next.js + prisma schema and push tables`。

## 验收标准（请自检后逐条汇报）

- [ ] `npm run dev` 能启动，浏览器打开默认页
- [ ] `prisma/schema.prisma` 三个 model 字段与 `docs/schema-design.md` 完全一致
- [ ] `npx prisma db push` 成功，Supabase 中出现 users / assessments / subscriptions 三张表
- [ ] `docs/schema-erd.svg` 已生成
- [ ] `git status` 中 `.env` 未被跟踪（已被忽略）
- [ ] 汇报你做了哪些设计决定（如 enum 与否），以及任何偏离文档的地方及原因
