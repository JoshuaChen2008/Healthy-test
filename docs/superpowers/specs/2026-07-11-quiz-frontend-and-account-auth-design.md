# 设计:测评前端 UI + 账号鉴权系统

> 状态:已批准，待转为实施计划
> 背景:挑战原文说"UI 不是考查重点，能跑即可"，此前只做了 7 个后端接口 + 默认 Next.js 模板首页。
> 现在要做成"能长期真实使用的产品"，因此补一套真实可用的前端 UI，并在此过程中把付费墙从"知道 UUID 就能访问"升级为真实账号鉴权。

## 0. 目标与非目标

**目标：**
- 一个真实可点的测评 funnel：落地页 → quiz 式分步填写 → 结果页（脱敏/完整）→ 付费解锁。
- 付费解锁改为依赖真实账号（邮箱+密码），而不是"知道 assessmentId 就能看"。
- 同一账号在不同设备登录后，历史测评自动可见且已解锁（账号级解锁的真正落地）。

**非目标（本轮明确不做，属于主动裁剪，不是遗漏）：**
- 不做"历史测评列表/仪表盘"页面。登录后用户能看到的仍然只是"当前手上这条 assessment 的结果页"，无法主动浏览自己所有历史记录（除非记得/保存过对应 URL）。这是刻意的范围裁剪，为了不再新增一个"列出我的 assessments"接口；如果以后要做，属于独立的下一期功能。
- 不做"忘记密码"找回流程。
- 不做邮箱验证（注册即生效，不发验证邮件）。
- 不支持第三方登录（Google/微信等），只有邮箱+密码一种方式。
- 不做多语言/国际化。

## 1. 页面结构

- `/`——落地页，替换现有默认模板首页，介绍产品 + "开始测评"按钮。
- `/quiz`——核心向导，quiz 式一屏一题，共 7 屏，顺序：性别 → 目标 → 年龄 → 身高 → 体重 → 目标体重 → 运动频率。每屏顶部一条进度条。这 7 个字段严格对应 `lib/health.ts` 算法真正需要的输入，不多不少。
- `/result/[assessmentId]`——结果页，同时承担付费墙角色。

视觉方向：清新现代健康 App 风（大圆角、柔和色彩、绿色系为主、大字号、移动端优先），具体调色板/字体在实施阶段用 ui-ux-pro-max 技能确定。

技术方案：单页面 SPA 式向导（`/quiz` 内部用 React state 管理当前第几题，不做每题一个 URL 的路由拆分），理由：
- 过渡最流畅，最贴合"一屏一个问题"的沉浸感。
- 已经能满足"中断恢复"需求：每答完一题就调一次 PATCH 真实存库，不是等到最后一次性提交。
- 避免 Next.js 16（本项目锁定版本）动态路由 API 与训练数据存在真实差异这一风险面（`AGENTS.md` 已明确警告，且我们写后端接口时已踩过"参数是 Promise 异步"的坑）。

所有页面都是 Client Component，通过 `fetch` 调用现有的 JSON API 路由，不使用 Server Component 数据获取或 Server Actions——前后端保持清晰解耦，后端已有独立测试覆盖。

## 2. 身份与进度恢复

匿名阶段（未登录，测评填写全程）：
1. 首次进入 `/quiz`：先调 `GET /api/auth/me` 判断是否已登录。
   - **已登录**：新建测评直接用登录账号的 `userId`（不再生成匿名身份），这次测评从一开始就挂在真实账号下。
   - **未登录**：检查 `localStorage` 有没有存过匿名 `userId`；没有则调 `POST /api/session` 生成一个，存入 `localStorage`。
2. 检查 `localStorage`（或已登录账号）名下有没有"未完成的 `assessmentId`"：
   - 没有 → 调 `POST /api/assessments` 新建一条，从第 0 屏开始。
   - 有 → 调 `GET /api/assessments/:id` 拿回已存字段和 `currentStep`，跳到对应屏继续填，已填内容预填回显。
3. 每答完一屏，先调 `PATCH`（带该屏字段 + 新 `currentStep`），成功后再切下一屏——先存库确认成功，再切屏，避免"看起来填了但没存住"。
4. 最后一屏提交后调 `POST /submit`，成功后清掉 `localStorage` 里的"未完成"标记，跳转到 `/result/[assessmentId]`。

"再测一次"：清掉 `localStorage` 里的 assessmentId（保留 `userId`/登录态），回到 `/quiz`，重新走一遍 `POST /api/assessments`。

## 3. 结果页 / 付费墙

`/result/[assessmentId]` 加载时调 `GET /api/assessments/:id/result`：

- **未登录**：无论该测评背后账号是否已付费，一律返回脱敏版（`membership: "free"`，`targetDate` 锁定，附 `upsell` 文案）。
- **已登录但不是本条测评所属账号**：同样返回脱敏版。
- **已登录且是本条测评所属账号且该账号 `subscription.status = active`**：返回完整版。

点击"解锁完整结果"：
1. 先调 `GET /api/auth/me` 确认登录状态。
2. **已登录** → 直接调 `POST /api/pay` → 成功后原地重新拉一次 result 数据刷新页面（不整页跳转）。
3. **未登录** → 弹出登录/注册浮层（不离开结果页），"注册"/"登录"两个标签：
   - 注册：邮箱+密码 → `POST /api/auth/signup`（带当前匿名 `userId`）→ 成功后自动接着调 `POST /api/pay` → 关浮层、刷新结果。邮箱已占用（409）→ 提示"已注册，要不要直接登录"，一键切标签并带过邮箱。
   - 登录：邮箱+密码 → `POST /api/auth/login` → 后端做账号过户（见第 5 节）→ 成功后自动接着调 `POST /api/pay` → 关浮层、刷新结果。密码错（401）→ 就近提示。

`/quiz`、`/result` 页顶部有一条登录状态提示：已登录显示邮箱 + "退出登录"按钮（调 `POST /api/auth/logout`），未登录不显示。

**边界情况**：直接访问未提交的 `assessmentId` 对应的 `/result` 页，后端返回 409——前端显示"这次测评还没完成"提示 + 返回 `/quiz` 继续填写的按钮，不白屏不报错。

## 4. 错误处理

- **单屏校验错误**（如年龄超范围）：PATCH 返回 400 时，就近显示在当前输入框下方，不切屏，不用全局弹窗打断心流。
- **本地存的匿名 id 失效**（404）：静默清空 `localStorage`，当新用户重新走一遍匿名建号流程，不报错吓用户。
- **网络请求失败**：当前屏显示"网络出错，请重试" + 重试按钮，不清空用户已填内容。
- **付费请求失败**：结果页维持"未解锁"状态，提示重试，不误报"已解锁"。
- **登录/注册报错**：401（密码错）、409（邮箱占用）均就近显示在浮层内，不清空已填的邮箱输入。

原则：能就近提示就不用全局弹窗，能保留已输入内容就不清空，能静默恢复就不报错打断。

## 5. 数据模型改动

`User` 表新增两个可空字段（可空是因为匿名用户本来就没有这两项，这个状态本身有意义）：

```prisma
model User {
  ...
  email        String?  @unique
  passwordHash String?  @map("password_hash")
  ...
}
```

新增 `Session` 表（数据库存储 session，而非 JWT）：

```prisma
model Session {
  id        String   @id @default(uuid()) @db.Uuid   // cookie 里存的值
  userId    String   @map("user_id") @db.Uuid
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  @@map("sessions")
}
```

密码用 `bcrypt` 存哈希（新增依赖），不存明文。密码最小长度 8 位（不额外要求大小写/符号组合，避免过度设计）。`Session` 过期时间设为 30 天（cookie 与数据库行的过期时间一致）。

**关键设计取舍（详细理由见对话记录，此处摘要）：**
- email/passwordHash 放在 `User` 表而非独立 `Credential` 表：当前只有一种登录方式，1:1 可选关系，独立表只多一次 join 换不来好处（YAGNI）。
- Session 用数据库表而非 JWT：退出登录需要"真失效"（删行即失效，JWT 到期前天然有效，除非额外维护作废名单）；与项目现有"全部状态走 Prisma"的风格一致；不需要引入签名密钥管理。
- 密码哈希用 bcrypt 而非手搓 SHA 系哈希：通用哈希函数刻意设计得"快"，正是密码哈希最忌讳的属性，绝对不能用。bcrypt vs argon2（更新的 OWASP 推荐算法）之间选了 bcrypt 主要因为依赖安装更省心；这条不是原则问题，可反悔。
- Cookie 存随机 session id 而非直接存 `userId`：直接存 `userId` 等于把"知道值就能访问"的老问题从 URL 搬进 cookie，退出登录做不到真正失效，违背"完整级鉴权"的初衷。

## 6. 接口改动清单 + 鉴权边界

**保持不变、依然匿名可用：**
- `POST /api/session`、`POST /api/assessments`、`PATCH /api/assessments/:id`、`GET /api/assessments/:id`、`POST /api/assessments/:id/submit`

**行为改变：**
- `GET /api/assessments/:id/result`——脱敏/完整判断现在同时依赖"登录状态 + 是否为本人账号 + 订阅状态"三者（见第 3 节），不再只看订阅状态。
- `POST /api/pay`——必须带有效登录 cookie，不再接收 body 里的 `userId`；未登录返回 401。

**新增：**
- `POST /api/auth/signup` `{ email, password }`——把邮箱密码焊在当前浏览器的匿名 `userId` 上（请求带当前 `userId`）。email 已占用 → 409。成功签发登录 cookie。
- `POST /api/auth/login` `{ email, password }`——校验密码；若当前浏览器带着未认领的匿名 `userId` 且与登录账号不同，将该匿名 `userId` 名下的测评过户到登录账号（`Assessment.userId` 改写）。过户后原匿名 `User` 行会变成零测评的孤儿行，**不做清理**（留着无害，不影响任何功能，避免为一个纯粹的存储整洁问题增加删除逻辑和相应测试）。成功签发登录 cookie。
- `POST /api/auth/logout`——删除对应 `Session` 行，清 cookie。
- `GET /api/auth/me`——返回当前登录账号 `{ userId, email }`；未登录 401。

## 7. 对已完成工作的影响（诚实交代，非可选项）

以下改动是本次功能扩展**必须连带完成**的部分，不是可以事后再补的边角料：

- `tests/result.auth.test.ts`：现有断言只看订阅状态，需要重写为覆盖"未登录/登录非本人/登录本人已订阅"三种组合。
- `tests/funnel.e2e.test.ts`：现有 `POST /api/pay` 直接传 `{userId}`，机制改变后这一步会直接失败，需要先插入注册/登录拿 cookie 的步骤。
- `tests/helpers.ts`：新增"注册/登录拿 cookie、构造带 cookie 的 Request"等公共方法。
- 新增 `tests/auth.integration.test.ts`：覆盖邮箱重复 409、密码错 401、过户逻辑、退出登录后 session 真失效。
- `docs/api.md`：补 4 个新接口文档，更新 `result`/`pay` 的鉴权说明。
- `README.md`：现有"已支付测试 userId"演示基于旧的无需登录 pay 方式，机制变化后要重做，改为提供一个测试账号的邮箱+密码供评审登录查看。
- 部署后需要重新完整走查一遍线上 funnel（之前基于旧机制录的 curl 演示不再适用）。
- `docs/tech-design.md` 第 3 节（API 清单）和 schema 相关描述会过时，需要同步更新。

## 8. 测试计划（新增部分）

- **集成**：signup（邮箱重复 409）、login（密码错 401、过户成功、未过户场景不误触发）、logout（session 真失效）。
- **鉴权（重写）**：未登录看 result → 永远脱敏；登录非本人 → 脱敏；登录本人已订阅 → 完整。
- **端到端（重写）**：匿名填测评 → 点付费 → 弹注册 → 注册成功自动付费解锁 → 退出登录再登录 → 依然能看到该测评已解锁。
- **手动浏览器验证**（部署后）：至少走一遍"换设备登录同一账号，历史测评自动解锁"这个核心场景。
