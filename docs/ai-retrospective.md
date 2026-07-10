# AI 使用复盘

> 面向：睿迄科技 3 天全栈挑战交付清单第 6 项。
> 本文档回答「怎么用 AI 协作完成这个项目、遇到过什么问题、AI 的方案在哪些地方需要人工纠正」。

## 1. 总体分工

这个项目的 AI 协作分成两层，各司其职：

- **Claude（对话式协作）** 负责规划、拆解任务卡、review 代码/文档、执行 git 操作（提交、合并、推送、连 GitHub 远程）、排查 CI/部署故障、以及最终走查 funnel 验证功能。
- **Codex** 负责按任务卡把具体代码写出来：三张表 + Prisma schema、7 个接口、健康算法、四类自动化测试 + CI 配置、部署前的收尾（`postinstall`、`.env.example`、README 补全）。

流程是：PRD/tech-design 定好要做什么和技术选型 → 拆成 `docs/codex-tasks/01`–`05` 五张任务卡 → 逐张交给 Codex 执行 → 人工（配合 Claude）验收、修故障、部署、回填交付材料。

这个分工的原因很直接：Codex 更适合长时间独立写大段代码；把"验收 + 修故障 + 操作 GitHub/Vercel 这类需要账号权限、需要人工判断的动作"留给人 + Claude 的对话式协作，能更快发现问题、当场决策。

## 2. 案例：Vercel 部署失败的定位与修复

### 背景

任务卡 05 让 Codex 补上 Vercel 部署前必须有的东西，其中一条是加 `postinstall` 钩子：

```json
"postinstall": "prisma generate --generator client"
```

原因：Vercel 每次构建都是全新环境，`@prisma/client` 必须在装完依赖后重新生成，否则线上一调用接口就会报 `@prisma/client did not initialize` 之类的错误。这条修复在本地和 CI 上都验证通过。

### 出问题

部署到 Vercel 后，构建阶段直接失败，报错是：

```
▲ Next.js 16.2.10 (Turbopack)
  Creating an optimized production build ...
✓ Compiled successfully in 4.9s
  Running TypeScript ...
Failed to type check.
./app/api/assessments/[id]/route.ts:1:10
Type error: Module '"@prisma/client"' has no exported member 'Prisma'.
> 1 | import { Prisma } from "@prisma/client";
    |          ^
  2 |
  3 | import { prisma } from "@/lib/prisma";
  4 | import {
Next.js build worker exited with code: 1 and signal: null
Error: Command "npm run build" exited with 1
```

也就是说：代码本身（JS/TS 语法）编译通过了（`✓ Compiled successfully`），但**类型检查**这一步失败——TypeScript 认为 `@prisma/client` 这个包里根本没有 `Prisma` 这个导出成员。这说明只加 `postinstall` 这一步，Codex 给出的第一版方案**没有完全解决问题**。

### 定位与修复

把这段报错交给 Codex 后，它定位到根因：`@prisma/client` 这个 npm 包本身只是个"壳"，真正包含 `Prisma` 命名空间、各种 model 类型的代码是 **`prisma generate` 命令跑完之后才会写入**的。而 Vercel 的构建流程存在缓存机制——如果它判断依赖没有变化，可能会直接复用缓存的 `node_modules`，跳过重新安装依赖这一步，`postinstall` 钩子自然也就不会被触发，`@prisma/client` 就停留在"壳"的状态，没有真正生成过。`next build` 在这种状态下做 TypeScript 类型检查，自然找不到 `Prisma` 这个导出，直接报错。

修复方式（提交 [`2c08d1c`](https://github.com/JoshuaChen2008/Healthy-test/commit/2c08d1c3bd9847abd2b0835ea0b81e12a50027c3)）：把 `prisma generate --generator client` **直接写进 `build` 脚本本身**，和 `next build` 用 `&&` 串联：

```json
"build": "prisma generate --generator client && next build"
```

这样无论 `postinstall` 有没有真的跑过，只要触发构建，Prisma Client 一定会在 `next build` 之前重新生成一遍——双保险，不依赖 Vercel 缓存策略的不确定性。

### 验证

重新部署后，我（Claude）用 `Invoke-RestMethod` 对着线上地址 `https://healthy-test.vercel.app` **完整跑了一遍 funnel**：创建会话 → 建测评 → 分步填数据 → 提交计算 → 查看付费前的脱敏结果（确认没有真实 `targetDate`）→ 调用 `/api/pay` → 再查结果确认变成完整版（`targetDate` 真实值出现）。全部通过，证明修复生效、且付费墙的核心行为在真实生产环境里是对的，不只是本地/CI 环境凑巧能跑。

### 这件事教会我的东西

- **本地测试通过 + CI 跑绿 ≠ 线上一定能跑**：CI 用的是全新容器、每次都完整走一遍 `npm ci`，天然不会有 Vercel 那种"依赖缓存导致钩子被跳过"的问题。这次踩坑之前，我们默认"CI 绿了就该没问题了"，其实是想当然。
- **AI 给的第一版修复方案可能只解决了"典型情况"，没覆盖"部署平台自己的缓存行为"这种更隐蔽的边界情况**——需要拿到真实报错、让 AI 结合具体环境再定位一次，而不是看到第一次修复合理就直接采信。
- **验证要打到真实环境上**，不能只信"部署成功"的绿色提示。走一遍完整业务流程（尤其是这个项目最核心的"付费前后差异"）才算真正验证。

## 3. 另一个小例子：不轻信第一直觉，靠日志找真因

在给 GitHub Actions 配 CI 的过程中，也有一次类似的"先猜错、再用证据纠正"：

CI 第一次跑测试时失败，报 `Process completed with exit code 1`。第一反应是怀疑 CI 里写死的 `node-version: 20` 和项目用的 Prisma 7 版本不兼容。但没有直接改，而是先把失败步骤的**完整日志**拉出来看，发现真正的报错其实是：

```
Command failed: ".../mmdc" ...
Error: Failed to launch the browser process
No usable sandbox!
```

真因是 `prisma/schema.prisma` 里配置了一个 `generator erd`（用于生成数据库关系图 SVG），`prisma generate` 会把它一起触发，而它需要启动无头 Chromium 画图——GitHub Actions 的 Ubuntu runner 默认没有这个沙箱权限，导致整个命令失败，跟 Node 版本完全无关。

修复是把 CI 和后续 Vercel 的 `postinstall`/`build` 都改成 `prisma generate --generator client`，只生成程序运行需要的 Client，不去碰 ERD 生成器。

这个例子说明：**遇到报错先看完整日志，而不是凭经验猜一个"看起来合理"的原因就动手改**——猜的原因和日志里的真实原因完全是两回事。

## 4. 总结

- AI（Codex + Claude）承担了绝大部分代码编写、测试搭建、文档整理、部署排障的工作量，人工的主要精力放在**任务拆解、验收判断、账号相关操作、以及关键节点的真实环境验证**上。
- 全程没有出现"AI 的方案被推翻重做"的情况，但出现了**两次"第一版方案不完整、需要结合真实报错二次修正"**的情况（Vercel 部署缓存、CI 沙箱限制），这类问题的共同点是：**AI 的第一反应基于通用经验，而真因往往藏在具体运行环境的细节里**，必须拿到真实日志才能定位准确。
