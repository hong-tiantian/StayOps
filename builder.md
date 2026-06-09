# builder.md — Google Cloud Agent Builder 接入进度

> **用途:** 实时记录"把 StayOps 的 agent 编排迁移到 Google Cloud Agent Builder"这件事的目标、决策和进度。
> 这是 `AGENTS.md` 顶部 OPEN DECISION（🟡 *Google Cloud Agent Builder / ADK cloud submission path not done yet*）的执行文档。
> **最后更新:** 2026-06-08

---

## 0. 为什么做这件事（目标）

比赛（Google Cloud Rapid Agent Hackathon，**截止 2026-06-11 14:00 PT**）Stage One 硬性要求：

1. ✅ **用 Gemini** 做模型 —— 已有（`@google/genai`，`src/lib/gemini.ts`）。
2. 🟡 **用 Google Cloud Agent Builder / ADK 做编排（managed orchestration path）** —— 本地链路已跑通，Cloud Run 部署和提交材料仍待完成。
3. 🟡 **集成一个 partner 的 MCP** —— 选了 Arize/Phoenix，代码里有，待确认"够分量"。
4. ⬜ 提交物：公开 repo + OSI license（已有 MIT）+ **托管 URL** + 3 分钟 demo 视频。

**当前缺口精确定位：**
```
fallback: Next.js API route ──直接调──> Gemini API
                                      ↑ 编排是手写 for 循环 (src/lib/agent/promiseAgent.ts)
primary:  Next.js API route ──调用──> ADK Agent (本地已跑通；目标 Cloud Run)
                                      ↑ 内部再调 Gemini + 现有工具 + Arize MCP
```
中间"用 Agent Builder/ADK 框架编排"这一层已在本地实现；剩余缺口是云端部署、提交文档、Arize trace 关联和最终核验。工具（`agentTools.ts`）、确定性兜底（`policy.ts`）、Arize 追踪全部保留。

---

## 1. 关键决策（已定）

| 决策点 | 选择 | 理由 |
|--------|------|------|
| **Agent 语言** | **ADK-TS（TypeScript）** | 最大复用现有工具逻辑/数据；与 Next.js 同语言；避开 Agent Engine 对 TS 的部署不确定性 |
| **部署形态** | **ADK 独立服务**（`agent/` 单独 package）→ Cloud Run；Next.js 经 HTTP 调用 | `@google/adk@1.2.0` 自带 express/ORM/storage 等重依赖，且要 `@google/genai@^1.x`（应用是 2.x）。塞进 Next.js 打包风险高；ADK 本就设计为独立服务（`adk deploy cloud_run`） |
| **工具/数据归属** | **单一真相：留在 Next.js**；agent 工具是瘦 HTTP 包装，回调 Next.js `/api/tools/*` | 避免 `tools.ts`/`/data` 复制成两份（用户提出的可维护性顾虑）。逻辑+数据永远只有一份；agent 只负责思考+编排 |
| **托管方式** | **Cloud Run** | 比赛要求的 Google Cloud 托管（**禁止 Vercel**） |
| **确定性兜底** | **保留 `policy.ts`** | Gemini/Agent 挂了仍能演示；是 demo 的"可验证保险" |
| **Partner MCP** | Arize/Phoenix | 已有追踪，阶段 2 评估是否需让它真正参与 agent 决策/自检 |

> 合规依据：ADK（Agent Development Kit）就是 Agent Builder 的官方开发框架。agent 跑在 **ADK 运行时**（不再是手写 for 循环）= 满足 "built with Agent Builder / managed orchestration"。

> **2026-06-08 架构调整①：** 原计划"ADK 跑在 Next.js 进程内"。`npm view @google/adk` 显示它依赖 express/@mikro-orm/@google-cloud-storage/winston 等重组件，且需 `@google/genai@^1.37`（与应用的 `^2.8` 大版本不同）。结论：改为 **ADK 独立服务**，避免污染 Next.js 打包。
>
> **2026-06-08 架构调整②（避免数据/逻辑复制）：** agent 服务**不**自带工具逻辑和 CSV。改为：Next.js 暴露内部接口 `/api/tools/*`（薄包装现有 `ToolRunner`，不改 `ToolRunner` 本身）；agent 的 5 个 `FunctionTool` 在 `execute` 里只 `fetch` 回调该接口。**工具逻辑 + 数据永远只有一份，留在 Next.js。** 代价：每次工具调用多一跳 HTTP（毫秒级）。

---

## 2. 不可破坏的不变量（来自 AGENTS.md，迁移中严守）

- 🚨 **TASK-103 永远 open，TASK-102 due 14:00** —— 故意的 bug，complaint-trace demo 靠它们。**绝不"修复"**。
- 固定 case：`BKG-2026-0718-ACME`，**恰好 6 个 promise**，不增不减。
- 状态/类型枚举不改名；`DEMO_NOW = 2026-07-18T10:00:00Z` 不变。
- 首轮分类目标不变（早到→`cannot_confirm`，安静大床→`at_risk`，早餐&投影→`verifiable`，接送&发票→`missing_info`）。
- 改动只落在 **Amber 后端半区**：`src/lib/agent/**`、新建 agent 目录、部署配置。不碰队友 UI。

---

## 3. 分阶段进度

> 状态图例：⬜ 未开始 · 🟡 进行中 · ✅ 完成 · ⚠️ 卡住

### 阶段 0 — 配置 GCP　【🟡 收尾，仅差 ADC】
- [x] 0.1 装 `gcloud` CLI（winget，Cloud SDK 571.0.0，路径 `%LOCALAPPDATA%\Google\Cloud SDK`）
- [x] 0.2a `gcloud auth login` ✅（账号 `tiantianhong23@gmail.com`）
- [ ] 0.2b `gcloud auth application-default login`（**用户待补跑**，ADK 运行时调 Vertex AI 要它）
- [x] 0.3 建 Project（`stayops-498807`）+ 关联 Billing（`01763A-E0192F-437F75`，billingEnabled=true）
- [x] 0.4 启用 API：aiplatform / run / cloudbuild / artifactregistry ✅；region=`us-central1`

### 阶段 1 — 本地跑通 ADK-TS agent　【🟡 进行中】
- [x] 调研 ADK-TS API：`LlmAgent` + `FunctionTool`(Zod schema) + Vertex 用环境变量（`@google/adk@1.2.0`）
- [x] agent 项目脚手架：`adk create` 生成 `agent/promise_agent/`（自带 .env 配好 Vertex/ADC + node_modules）
- [x] Next.js 后端新增 `/api/tools/[tool]/route.ts`（薄包装 `ToolRunner`+`dispatchTool`，**不改** ToolRunner）— typecheck 通过
- [x] agent 定义 5 个 `FunctionTool`，`execute` 里 `fetch` 回调 `/api/tools/*`（**不复制逻辑/数据**）— typecheck 通过
- [x] 定义 `rootAgent`（LlmAgent，gemini-3.5-flash）；ADC 凭证已就绪
- [x] **本地跑通** ✅：root `npm run dev` + `agent/promise_agent` `npm run cli`；5 个工具全部 POST `/api/tools/*` 返回 200，取到真实 CSV 数据；Vertex Gemini 连通（ADC OK）
- [x] 校验 6 个 promise 分类：**5/6 完全命中**验收目标。唯一差异=安静大床房 agent 判 `conflict`（期望 `at_risk`）——LLM 发现"早到 vs 安静远电梯房"的真实时间冲突，属合理推理差异，**留给 `policy.ts` 裁决收敛**，非 bug。
- [ ] Next.js 侧保留 `policy.ts` 兜底（阶段2 接线时处理）

> **阶段1 结论（2026-06-09）：** ADK(Agent Builder)编排链路全程跑通 —— Vertex Gemini 推理 + ADK function-calling + 5 工具回调单一数据源(`/api/tools`) + 真实 CSV 证据。合规缺口"用 Agent Builder 编排"在本地已被真实验证。下一步=阶段2 接线 + outputSchema 收敛枚举 + policy 裁决 + Arize。

> 结构备注：真正的 agent 服务 = `agent/promise_agent/`（自带 node_modules）。外层 `agent/` 早期多余产物（package.json/lock/node_modules）已于 2026-06-09 清理，现仅余 `.gitignore` + `promise_agent/`。

### 阶段 2 — 接线 + 收敛 + Arize 自查　【🟡 接线已完成（队友 char-aaa），余 Arize】
- [x] **枚举收敛**：ADK 不能同时用 outputSchema + 工具，改用 **prompt 收敛**成标准枚举（`agent/promise_agent/server.ts`）
- [x] **Next.js 接 agent**：队友新增 `agent/promise_agent/server.ts`（express `POST /audit`）+ `src/lib/agent/adkClient.ts`；`classifier.ts` 把 **ADK 设为主编排**（`ADK_AGENT_URL` 配了走 ADK，否则回退 Gemini 循环 → policy）。policy 仍做最终裁决。
- [ ] **Arize 事后自查（设计已定，见下）** ← 阶段2 剩这一块

> **运行全栈（已变）：** ① 根 `npm run dev`(:3000) ② `agent/promise_agent` 里 `node --import tsx server.ts`(:8080) ③ Next.js 环境设 `ADK_AGENT_URL=http://localhost:8080` 激活 ADK 主编排。
> **合并记录（2026-06-09）：** merge `origin/char-aaa/main-work`（commits a975f97、014f243）。已核验：ACME 仍 6 条 promise、6 状态不变、TASK-102 due=14:00、TASK-103=open，不变量完好；ACME 行仅新增 `category` 列。

**Arize 自查设计（"够分量"的 MCP 用法，非装饰）：**
> agent 出完决策后，跑独立评估步骤（Gemini LLM-as-judge），对每条决策做 4 项检查 → 结论写入 Phoenix（标注/审计日志）→ 经理面板经 **phoenix-mcp** 读回 → 给未通过项打 ⚠️「建议人工复核」。**评估不改判定，只替经理把关**（human-in-control）。
> - 4 项检查：① 证据支撑（verifiable 是否有工具结果撑着）② 不乱承诺（是否违反 SOP 去保证）③ 尊重时效（数据 stale 时是否仍给保证）④ 缺失项完整（missing_info 是否列出缺哪些字段）
> - 自查记录数据形状：`{ promise, agent_status, self_review:[{check, verdict, reason}], needs_human_review }`
> - 成本/延迟（token/$/秒）从同一条 trace 经 MCP 读出，作观测卖点（非决策工具）
> - 现有 `api/insights` 的 `list-projects` 属"装饰档"，需升级为读回 per-decision 自查结论
> - ⚠️ 实现前先确认 phoenix-mcp 真实工具名（读 trace / 写标注），勿凭记忆
> - 反模式（不要做）：让 agent 在推理中途把 Arize 当工具调用 —— 更像凑数

### 阶段 3 — 部署前端 + 文档/提交物　【⬜ 未开始】
- [ ] Next.js 部署到 **Cloud Run**（⚠️ 不用 Vercel）→ 拿到公开托管 URL
- [~] 更新 README / 架构图，说明 Agent Builder 编排路径
- [ ] 录 3 分钟 demo 视频；确认 repo 公开 + MIT license
- [ ] 更新 `AGENTS.md` 里 🟡 OPEN DECISION：本地 ADK 已实现，Cloud Run/提交仍待完成

---

## 4. 环境信息（边做边填）

| 项 | 值 |
|----|----|
| Project ID | `stayops-498807`（默认 project 已设） |
| Region | `us-central1`（ai/region + run/region 已设） |
| Billing | `01763A-E0192F-437F75`（已关联，billingEnabled=true） |
| 登录账号 | `tiantianhong23@gmail.com` |
| gcloud 路径 | `C:\Users\Lenovo\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin` |
| Node | v22.20.0 |
| Agent endpoint | _（阶段 2 后填）_ |
| 托管 URL | _（阶段 3 后填）_ |

---

## 5. 待办 / 风险备忘

- ⚠️ **不能部署 Vercel**（比赛规则 + AGENTS.md）。
- 💡 黑客松 Devpost 资源页可能发 GCP credit 优惠券，先兑换省钱：https://rapid-agent.devpost.com/resources
- 🟡 Arize MCP "cosmetic synced badge 不算" —— 阶段 2 需确认其实质作用。
- 🟡 ADK-TS 较新，文档比 Python 薄；若 Cloud Run 部署撞墙，回退方案 = Python ADK + Agent Engine（代价：重写工具层，风险高）。

---

## 6. 参考链接

- 比赛主页：https://rapid-agent.devpost.com/
- ADK 文档：https://adk.dev/
- ADK-TS（官方）：https://github.com/google/adk-js
- ADK TS 入门：https://google.github.io/adk-docs/get-started/typescript/
- Agent Engine quickstart：https://cloud.google.com/agent-builder/agent-engine/quickstart-adk

---

## 7. 交接 / 新人上手（队友从 GitHub 拉下来后照做）

**仓库结构（本次新增）：**
```
src/app/api/tools/[tool]/route.ts   ← Next.js 内部工具接口（包装 ToolRunner，单一数据源）
agent/promise_agent/                ← 独立 ADK agent 服务（真正的 agent 在这）
  ├─ agent.ts   ← rootAgent + 5 个 FunctionTool（fetch 回调 /api/tools/*）
  ├─ .env       ← Vertex/ADC 配置（无密钥；project id 等，可按需改成自己的 project）
  └─ package.json
agent/.gitignore                    ← 忽略 agent 下所有 node_modules
builder.md                          ← 本文档（进度/决策/目标）
```
> 注：`node_modules` 不入库，拉下来后要自己装。外层 `agent/`（package.json/lock）是早期多余产物，真正服务是 `agent/promise_agent/`。

**① 装依赖（两处）：**
```powershell
# 主应用
cd <repo>
npm install
# ADK agent
cd agent/promise_agent
npm install
```

**② Google Cloud 准入（关键，二选一）：**
- **方案甲（推荐，最省事）：** 项目所有者把队友的 Google 账号加进 GCP 项目 `stayops-498807`
  （Console → IAM → 授予 `Vertex AI User` + `Cloud Run Admin`）。队友 `.env` 不用改。
- **方案乙：** 队友用自己的 GCP 项目 —— 自建 project、开 billing、`gcloud services enable aiplatform.googleapis.com run.googleapis.com ...`，
  然后把 `agent/promise_agent/.env` 的 `GOOGLE_CLOUD_PROJECT` 改成自己的。

**③ 本地登录（每台机器各自做一次）：**
```powershell
gcloud auth login
gcloud auth application-default login   # agent 调 Vertex 必须
```

**④ 跑起来（两个终端）：**
```powershell
# 终端 A：主应用（提供 /api/tools）
cd <repo> && npm run dev
# 终端 B：ADK agent
cd agent/promise_agent && npm run cli   # 或 npm run web 看可视化
```
然后把测试邮件“压成一行”粘进 agent（多行会被逐行截断）。预期：5 个工具全部 200，6 个 promise 输出 5/6 命中验收目标。

**⑤ 当前进度：** 阶段0、阶段1 已完成（见上）。**下一步从阶段 2 开始**：outputSchema 收敛枚举 → Next.js 调 agent + `policy.ts` 裁决 → Arize MCP 实质化 → 阶段3 部署 Cloud Run。
