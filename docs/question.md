**Q1.** 一个新用户从打开页面到"付费解锁完整结果"，后端一共被调用了哪几个接口？按顺序列出来，并说明**每个接口产出的那个 id 是干嘛的**（`userId` 和 `assessmentId` 分别在后面哪些请求里被用到）。

A:

session 的POST接口 -> assessment的POST接口 -> assessment的PATCH接口 -> submit 的POST接口 -> result GET接口 

session接口产出userID，因为session的业务是创建一个新用户，assessment POST是根据userID在assessments表创建对应assessment数据，PATCH接口则是分步保存body提交assessment数据，submit的POST是根据assessmentID查assessment,然后计算bmi和健康值等数据返回，result 的GET接口是根据assessmentID查询assessment表，拿到userID，然后根据UserID查询subscription表的对应user的数据，再根据subscription.status的状态返回对应结果，没付费的时候状态是free，走Pay的POST接口付费以后会把subscription.status的状态更新为active，然后再次调用result GET接口，获取付费后的完整数据内容

**Q2.** 数据库为什么是 `users`、`assessments`、`subscriptions` **三张表**而不是一张大表？把它们的关系说清楚：为什么一个 user 能对多个 assessment，而 subscription 却是一个 user 只有一条？

users是用户信息，一般存着userID，邮箱等数据，assessments是用户信息对应的身体数据，subscription是用户信息对应的订阅状态，因为业务上设计一个user可以有多个健康数据，但是订阅状态只会存在一个，一个用户不可能有多个订阅状态

**Q3.** `assessments` 表里几乎所有字段（age、heightCm、gender…）都是**可空**的。这个"可空"设计，直接支撑了 PRD 里的哪个功能？如果这些字段设成"不可空/必填"，哪个功能会立刻崩掉，为什么？

可空设计支撑了PRD里面的分步保存功能，如果不可空/必填，则分步保存的功能会崩掉，因为新建 assessment 时，一行数据里**绝大多数列都还是空的**（用户才填第 1 步）。如果这些列是 `NOT NULL`（必填），数据库在 **INSERT 那一刻就直接拒绝**——因为必填列没值，这条"半成品"记录根本存不进去。可空 = 允许"残缺的行"先存在、以后慢慢补。

**Q4.** PATCH 分步保存时，`answers` 字段是**合并**而不是**覆盖**。举个具体例子：用户第 3 步存了 `{sleep_hours: "6_7"}`，第 5 步存 `{diet: "balanced"}`。如果 Codex 当初写成"覆盖"，最后数据库里会剩下什么？这会导致什么后果？

最后只会剩下diet:"balance"，导致用户信息必须一次性填完，否则中途修改会导致用户老信息被新选项抹去，只剩下新选项，失去业务功能

**Q5.** `target_date`（目标达成日期）是"被保护字段"。用大白话说：**为什么偏偏是这个字段要藏起来**，而 `bmi` 就可以直接给非会员看？这背后的商业逻辑是什么？

1.直接原因，target_date的隐藏是目标网站的设计，这里是模仿目标网站的思路

2.可以通过展示bmi信息告诉用户如果订阅了我们的计划，可以在预期目标内达成效果，提高用户消费意愿

**Q6.** 订阅是"账号级别"的。意思是：用户 A 付了一次钱，他**之前做过的 3 次测评**结果会怎样？他**之后再做的第 4 次**测评呢？为什么代码能做到这点？（提示：想想 result 接口是拿什么去查订阅状态的）

1.前三次测评结果可以正常查看对应的付费内容测评，第四次也可以，因为result的GET接口是获取用户对应的订阅状态来选择要展示哪些内容，而不是跟着assessment内容走，是解耦的



