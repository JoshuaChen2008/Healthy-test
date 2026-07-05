# 技术框架 · 健康测评系统后端

> 本文档回答「用什么、怎么搭」。这是给 Codex 施工的技术规格。

## 1. 技术选型

| 层 | 选型 | 理由 |
|----|------|------|
| 前端 | Next.js (App Router) + TypeScript | 题目点名可用；前后端同项目，概念最少 |
| 后端 | Next.js API Routes | 无需单独起服务，与前端同项目 |
| 数据库 | Supabase (PostgreSQL) | 免费云端，自带管理界面 |
| ORM | Prisma | 用 TS 定义表结构，自动建表 + 生成类型 |
| 测试 | Vitest | 配置简单，与 TS 天然搭配 |
| 部署 | Vercel | Next.js 官方平台，连 GitHub 一键上线 |

允许替代：后端可换 NestJS/Express，但默认走 Next.js API Routes。

### 1.1 数据库选型理由（Supabase）

首要原因：**题目技术要求直接点名** "数据库：Supabase / Prisma + PostgreSQL"，跟随评审建议的栈本身是隐性加分。其他原因：

- **就是标准 PostgreSQL**：满足题目对 Postgres 的要求，非"类 Postgres"。
- **免费额度够用**：挑战项目数据量在免费层内。
- **自带可视化后台**：建表后可在网页直接查看表与数据，便于排查（对快速开发友好）。
- **与 Prisma 官方适配**：Supabase 提供官方 Prisma 接入文档，坑少。
- **托管省心**：云端数据库，免去本机装配 Postgres 的环境成本。

### 1.2 考虑过的替代方案

| 选项 | 结论 |
|------|------|
| **Neon**（托管 Postgres, serverless）| 唯一可平替；但题目未点名，且缺可视化后台，无理由替换 |
| **Vercel Postgres** | 能用，与题目指定无关，无优势 |
| **Railway / Render Postgres** | 免费额度/休眠策略不如 Supabase 友好 |
| **本机 Docker Postgres** | 新手成本高，还需单独解决线上部署时的数据库 |
| **PlanetScale(MySQL) / MongoDB** | 非 PostgreSQL，不符合题目要求，排除 |

结论：采用 Supabase。理由优先级：题目指定 → 免费+可视化后台 → Prisma 适配好。

## 2. 系统架构

```
[用户浏览器] → [Next.js 前端页面]
                     ↓ fetch 调用
              [Next.js API Routes]   业务逻辑：会话/保存/计算/鉴权/支付
                     ↓ Prisma
              [Supabase PostgreSQL]  三张表：users / assessments / subscriptions
```

## 3. API 清单

约定：所有请求/响应体为 JSON；错误返回 `{ error: string }` + 合适状态码。

| 方法 | 路径 | 作用 | 鉴权 | 关键出参 |
|------|------|------|------|----------|
| POST | `/api/session` | 创建用户/会话 | 无 | `{ userId }` |
| POST | `/api/assessments` | 新建一次测评 | 无 | `{ assessmentId }` |
| PATCH | `/api/assessments/:id` | 分步保存增量数据 | 无 | `{ ok: true, currentStep }` |
| GET | `/api/assessments/:id` | 进度恢复 | 无 | 已填字段 + `currentStep` + `status` |
| POST | `/api/assessments/:id/submit` | 提交并触发计算 | 无 | `{ status: "completed" }` |
| GET | `/api/assessments/:id/result` | 结果页，差异化返回 | 校验订阅 | 会员=完整 / 非会员=脱敏 |
| POST | `/api/pay` | 模拟支付回调 | 无 | `{ status: "active" }` |

请求体示例：
- `POST /api/assessments` → body `{ "userId": "..." }`
- `PATCH /api/assessments/:id` → body `{ "step": 3, "height_cm": 175, "weight_kg": 70 }`
- `POST /api/pay` → body `{ "userId": "..." }`

结果差异化规则：
- 非会员：返回 `bmi`、`recommended_calories` 等基础字段；**隐藏** `target_date` 等被保护字段，附 `locked: true` + 付费提示。
- 会员：返回全部字段。

## 4. 数据校验规则（防非法注入 / 边界）

| 字段 | 合法范围 |
|------|----------|
| age | 整数，10–100 |
| height_cm | 数字，80–250 |
| weight_kg | 数字，20–400 |
| target_weight_kg | 数字，20–400，且与当前体重差距合理 |
| gender / goal / workout_frequency | 只接受预定义枚举值 |

非法输入一律返回 400 + 明确错误信息，且**必须有测试覆盖**。

## 5. 健康评估算法（核心逻辑，单独文件便于测试）

- **BMI** = `weight_kg / (height_m ^ 2)`
- **建议摄入量**：用简化公式（如基于 BMR + 活动系数），文档中写明所用公式来源。
- **目标预测日期**：根据当前体重、目标体重、合理周减重速率估算达成日期。

算法放在 `lib/health.ts` 之类的纯函数文件，不依赖数据库，便于单元测试。

## 6. 测试策略

| 层 | 覆盖内容 | 框架 |
|----|----------|------|
| 单元 | 健康算法（含极端/缺失/非法：身高体重年龄、目标体重不合理） | Vitest |
| 集成 | 分步保存 + 进度恢复（中断恢复、乱序、重复提交、并发更新） | Vitest |
| 鉴权 | 非会员脱敏 vs 会员完整（确保非会员拿不到被保护字段） | Vitest |
| 端到端 | `/pay` 回调后，结果从"脱敏"变"完整" | Vitest / Playwright |

一键运行：`npm test`。加分：GitHub Actions CI，README 贴通过状态。
README 需说明：覆盖了哪些场景、为什么、哪些暂未覆盖及原因。

## 7. 部署

- 推 GitHub → Vercel 连仓库自动部署。
- Supabase 连接串等敏感信息放 Vercel 环境变量，不进仓库。
- 交付一个**已支付的测试 sessionId**，供评审直接对比付费前后差异。
