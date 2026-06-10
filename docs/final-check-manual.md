# StayOps Final Check Manual

> 用途：给项目 owner 或后续 agent 做最后带读、自查和提交前验收。
>
> 语言策略：快速理解用中文；代码名、字段名、路径、API、status、tool、MCP、ADK、Gemini、Arize/Phoenix 等保持英文。
>
> 重要：这个文档不是官方比赛规则本身。比赛最终提交前，仍要对照官方 submission page / Devpost / hackathon portal 做人工复核。本文件只记录当前项目应如何证明自己符合 `AGENTS.md` 和 repo 内现有决策。

---

## 0. 先记住一句话

StayOps 不是 guest chatbot，也不是 generic task manager。

它要证明的是：

```text
Gemini proposes.
Read-only tools provide evidence.
Deterministic policy decides the executable status.
Duty manager approves risky actions.
Arize/Phoenix records and reviews the trace.
```

如果一个改动、解释或 demo 不能服务这条链路，优先级就很低。

---

## 1. 使用方式

如果你把这个 manual 给另一个 agent，请直接要求它按这个格式工作：

```text
Follow docs/final-check-manual.md.
Do not refactor.
Do not change demo data.
Do not fix TASK-102 or TASK-103.
For each section, report:
1. files inspected
2. command/result checked
3. Good/Bad judgment
4. remaining risk
```

阅读时不要从全 repo 乱翻。先追一个 booking，再追一个 promise。

主线 booking 固定是：

```text
BKG-2026-0718-ACME
```

建议先追这个 promise：

```text
P-002 Quiet king room for VP away from elevators
```

因为它能串起 extraction、tool evidence、policy、manager approval、task failure、complaint trace 和 Arize trace。

---

## 2. 不要做的事

这些不是当前 DDL 前的重点。

- 不要做真实 login / auth / RBAC。
- 不要做 multi-tenant。
- 不要把 StayOps 做成 guest chatbot。
- 不要把 task board 做成 generic task manager。
- 不要改动 Acme main flow 的 6 个 promises。
- 不要把 `DEMO_NOW` 改成真实当前时间。
- 不要把 Arize/Phoenix 说成会改变 business decision。
- 不要部署到 Vercel。

可以展示 `Duty manager view` 这样的 persona label，但不要做真实权限系统。

---

## 3. 权威文件顺序

如果文档之间冲突，先按这个顺序理解（2026-06-10 团队决定：spec 为产品权威）：

1. `AGENTS.md`（协作规则与 demo 不变量）
2. `docs/00-spec.md`（**产品权威 / 第一资料** — 产品行为以它为准；spec 写错了先修 spec）
3. `docs/02-agent-design.md`
4. `agent-team-execution-plan.md` / `gmail-metrics-execution-plan.md`（施工记录；与 spec 冲突时更新它们）
5. `docs/05-mcp-arize.md`
6. 其他 README / docs（README 提交前最后统一修订）

当前关键事实：

- Partner bucket 是 `Arize/Phoenix`，不是 Fivetran。
- `agent/promise_agent/` 是 local ADK / Agent Builder service。
- `ADK_AGENT_URL` 配置后，Next.js audit path 优先走 ADK。
- 没有 ADK 时，fallback 到 in-app Gemini ReAct loop。
- Gemini 不可用时，fallback 到 deterministic rules。
- deterministic policy 仍然是最终 executable status 的裁判。
- Cloud Run deployment 是目标，Cloud deployment / final hosted URL 需要最终确认。

---

## 4. 最小执行链路

把系统压成 7 层看：

```text
Guest message / booking data
-> Info Analysis
-> Verification with tools
-> Safety Gate / deterministic policy
-> Manager-facing output
-> Task Planning / approval
-> Complaint trace / recovery
-> Arize/Phoenix trace + eval review
```

每一层只问四个问题：

```text
Input 是什么？
Tool 是什么？
Output 是什么？
谁兜底？
```

不要问“这个 agent 聪不聪明”。要问：

```text
它有没有拿到正确 context？
它有没有调用正确 tool？
它有没有输出稳定结构？
它有没有被 policy 约束？
trace 和 eval 能不能证明它没有 overpromise？
```

---

## 5. 本地运行检查

### 5.1 安装和基础检查

在 repo 根目录：

```bash
npm install
npm run typecheck
npm run build
```

Good:

- `npm run typecheck` pass。
- `npm run build` pass。

Bad:

- TypeScript error。
- Next build error。
- build 依赖缺失。

说明：

- 文档-only 改动理论上不影响 typecheck，但最终提交前仍建议跑。

### 5.2 启动 Next.js app

Terminal A：

```bash
npm run dev
```

默认地址：

```text
http://localhost:3000
```

Good:

- 页面能打开。
- 默认 booking 是 `BKG-2026-0718-ACME`。
- UI 展示 promise ledger、manager briefing、task board、complaint trace。

Bad:

- 页面打不开。
- 页面只像 marketing page，没有实际 workflow。
- Acme booking 不存在。

### 5.3 启动 ADK service

Terminal B：

```bash
cd agent/promise_agent
npm install
npm start
```

默认 ADK service：

```text
http://localhost:8080
```

然后在 Next.js app 的环境里配置：

```bash
ADK_AGENT_URL=http://localhost:8080
```

Good:

- `agent/promise_agent/server.ts` 能启动。
- Next.js audit 结果里的 `reasoning_source` 是 `adk`。
- ADK 返回 `proposals` 和实际 `tool_calls`。

Acceptable fallback:

- 如果本地 ADC / Vertex / quota 未配置，`reasoning_source` 可能降级为 `gemini` 或 `rules`。
- 但最终提交前必须至少能证明 Gemini / ADK path 真实跑通过，不要只展示 rule engine。

Bad:

- 永远只有 `reasoning_source: "rules"`，但对外声称已用 Agent Builder。
- ADK service 只是空壳，没有 tool calls。

---

## 6. API 自查

### 6.1 Audit API

看文件：

```text
src/app/api/audit/[booking_id]/route.ts
src/lib/classifier.ts
src/lib/agent/adkClient.ts
src/lib/agent/promiseAgent.ts
src/lib/agent/policy.ts
```

运行：

```bash
curl -s -X POST "http://localhost:3000/api/audit/BKG-2026-0718-ACME?force=1"
```

如果 shell 不方便读 JSON，可以让 agent 或浏览器只检查这些字段：

```text
booking_id
reasoning_source
info_analysis
agent_trace
decisions
task_plan
tool_calls
```

Good:

- `booking_id` 是 `BKG-2026-0718-ACME`。
- `reasoning_source` 是 `adk`、`gemini` 或 `rules` 之一。
- final response 有 exactly 6 main decisions。
- `info_analysis.basic_info_status` 应该是 `complete`。
- `agent_trace` 至少包含 Info Analysis、Verification Agent、Safety Gate、Task Planning、Recovery、Arize Audit 这些 stage。
- `tool_calls` 不是空数组，除非处于完全离线 fallback。

Bad:

- response shape 改了但 `src/lib/types.ts` 没同步。
- `decisions` 少于或多于 Acme main flow 的 6 个。
- `agent_trace` 只是假文案，和实际执行完全无关。
- `tool_calls` 缺失，无法说明 evidence 来源。

### 6.2 Complaint Trace API

看文件：

```text
src/app/api/complaints/trace/route.ts
src/lib/recovery.ts
data/ops_tasks.csv
```

运行：

```bash
curl -s -X POST "http://localhost:3000/api/complaints/trace" \
  -H "Content-Type: application/json" \
  -d "{\"booking_id\":\"BKG-2026-0718-ACME\",\"complaint_text\":\"The VP was promised a quiet king room, but was placed near the elevator, and the projector was not ready when the meeting started.\"}"
```

Good:

- Trace 匹配 `P-002` 和 `P-004`。
- `P-002` linked task 是 `TASK-103`。
- `P-004` linked task 是 `TASK-102`。
- Recovery plan 能说明 quiet room failure 和 projector due-time failure。

Bad:

- 投诉只生成泛泛 apology。
- 没有映射到具体 promise。
- 没有映射到具体 task。
- 把 `TASK-102` 或 `TASK-103` 当 bug 修掉了。

---

## 7. Golden Case 检查

Acme main flow 必须保持 exactly 6 promises。

看文件：

```text
data/promise_ledger.csv
evals/goldens.json
src/lib/evaluation/metrics.ts
scripts/eval.mjs
```

预期结果：

| Promise | Expected status | Why |
| --- | --- | --- |
| `P-001` early check-in | `cannot_confirm` | 12-room group early arrival cannot be guaranteed from current readiness. |
| `P-002` quiet king room | `at_risk` | Quiet-zone king inventory is limited; manager approval and room lock are needed. |
| `P-003` gluten-free breakfast | `verifiable` | SOP supports execution if F&B is notified by deadline. |
| `P-004` projector | `verifiable` | MR-BLUE has projector, but task due time must be checked later. |
| `P-005` airport transfer | `missing_info` | Flight number / arrival time / passenger count / phone are missing. |
| `P-006` company invoice | `missing_info` | Billing contact / tax ID / billing address are missing. |

Run eval：

```bash
npm run eval
```

Good:

- Status accuracy pass。
- Unsafe overpromise count 是 `0`。
- Missing-info recall pass。
- Tool coverage reasonable。
- Complaint trace 检查能命中 quiet room 和 projector due time。
- Phoenix trace present 最好为 true；如果本地未配置 Phoenix，可在 final submission 前补测。

Bad:

- `P-001` 或 `P-005` / `P-006` 被标成 `verifiable`。
- `P-002` 被直接标成 `verifiable` 且没有 manager approval / room lock 约束。
- `P-004` 不再能触发 later complaint due-time failure。
- `unsafe_overpromise_count > 0`。

---

## 8. 单个 Promise 带读：P-002 Quiet King Room

这是最适合带你理解系统的一条线。

### 8.1 数据源

看：

```text
data/messages.csv
data/reservations.csv
data/room_inventory.csv
data/room_readiness.csv
data/hotel_sop.csv
data/promise_ledger.csv
data/approval_records.csv
data/ops_tasks.csv
```

你要确认：

- Guest message 里确实提到 VP quiet king room away from elevators。
- `promise_ledger.csv` 里 `P-002` status 是 `at_risk`。
- `rule_key` / compatibility `category` 是 `quiet_room`。
- `approval_records.csv` 有 historical approval evidence。
- `ops_tasks.csv` 里 `TASK-103` 是 front desk room-locking task。
- `TASK-103` 必须保持 `open`。

Good:

```text
P-002 -> at_risk -> approval required -> TASK-103 -> open -> complaint trace failure
```

Bad:

```text
P-002 -> verifiable automatically
TASK-103 -> completed
complaint trace cannot find room-lock failure
```

### 8.2 Info Analysis

看：

```text
src/lib/infoAnalysis.ts
src/lib/types.ts
```

你要确认：

- `P-002` 被识别为 extra item。
- 它有 `domain`、`subtype`、`rule_key`、`verification_route`。
- `rule_key` 应该落到 `quiet_room`。
- 不要把 `category` 当完整业务 taxonomy；它目前是兼容字段，实际作用接近 `rule_key`。

Good:

- Info Analysis 只做 extraction / structuring。
- 不在这一层直接承诺可以执行。

Bad:

- Info Analysis 直接说 guest promise is guaranteed。
- 没有 source quote 或无法追溯到 message。

### 8.3 Verification With Tools

看：

```text
src/lib/tools.ts
src/lib/agent/agentTools.ts
```

Expected tools:

```text
check_data_freshness
retrieve_sop
check_room_readiness
get_reservation
```

你要确认：

- Tool 是 read-only。
- Tool 返回的是 evidence，不是最终业务拍板。
- Model 不应该调用 write action 创建任务。

Good:

- Gemini / ADK 调 tool 查 room readiness、SOP、reservation。
- Tool call 出现在 `tool_calls` 或 Phoenix trace。

Bad:

- Model 不查工具直接判断。
- Tool 返回字段经常变，导致 UI / eval 不稳定。
- Model 能直接调用 `create_ops_task` 这类写操作。

### 8.4 Safety Gate / Policy

看：

```text
src/lib/agent/policy.ts
src/lib/classifier.ts
```

你要确认：

- Gemini / ADK 只能 propose。
- final executable status 来自 deterministic policy。
- Quiet king room 在 manager approval + actual room lock 前保持 `at_risk`。

Good:

```text
Gemini proposal may say feasible.
Policy adjudicates final status = at_risk.
approval_required = true.
```

Bad:

```text
Gemini proposal directly overwrites policy.
Policy lets P-002 become verifiable without room lock.
```

### 8.5 Task / Approval

看：

```text
src/lib/taskPlanner.ts
src/app/api/promises/[promise_id]/approve/route.ts
src/lib/store/db.ts
src/lib/learning/feedbackStore.ts
```

你要确认：

- Runtime manager approvals 和 historical approval records 是两件事。
- Historical approvals 用于 complaint trace evidence。
- Runtime approval 可以记录 feedback / learning。
- `TASK-103` intentionally remains open。

Good:

- UI 可以展示 manager approval。
- Feedback summary 可被 Arize self-review 使用。
- 但 demo failure 仍然保留。

Bad:

- 用户点 approve 后把 `TASK-103` 自动完成。
- approval record 和 actual task completion 混为一谈。

### 8.6 Complaint Trace

看：

```text
src/lib/recovery.ts
src/components/ComplaintRecovery.tsx
src/components/PromiseDetailDrawer.tsx
src/components/TimelineView.tsx
src/components/HotelMap.tsx
```

你要确认：

- Complaint text 映射到 `quiet_room` / `P-002`。
- Trace 找到 `TASK-103`。
- Failure point 是 task open / room placed near elevator。
- Recovery plan 有 internal corrective action，不只是客套回复。

Good:

```text
Complaint -> P-002 -> APR-001 -> TASK-103 open -> failure point
```

Bad:

```text
Complaint -> generic apology
No task id
No root cause
```

---

## 9. Multi-agent / Agent Team 自查

不要纠结是不是“很多个真实进程中的 agent”。当前可以准确表述为：

```text
agent team workflow
```

Gemini / ADK 在不同 stage 扮演不同责任角色，但每个 stage 必须有明确边界。

| Stage | 责任 | 不该做 |
| --- | --- | --- |
| `Info Analysis` | Extract promises, classify basic/extra info, assign `rule_key` / route | 不直接 guarantee |
| `Verification Agent` | Call read-only tools, gather evidence | 不创建任务 |
| `Safety Gate` | Apply deterministic policy, prevent overpromise | 不让 LLM 绕过规则 |
| `Task Planning Agent` | Propose handoff/follow-up/approval next actions | 不修改 seeded failure tasks |
| `Evaluation & Recovery` | After complaint, trace failure | 不作为初始分类 |
| `Arize Monitoring / Audit` | Trace / self-review / evidence audit | 不改变 decision |

Good:

- 每个 stage 在 `agent_trace` 里有状态。
- 每个 stage 的 output 能和 response 字段对应。
- UI 里展示的是 manager-relevant summary，而不是模型内心戏。

Bad:

- “multi-agent” 只是 marketing copy。
- stage 没有输入输出边界。
- 所有 decision 都来自 prompt 文本，没有 tool/policy/eval 证据。

---

## 10. Arize/Phoenix MCP 检查

目标不是贴一个 “synced” badge，而是证明：

```text
The agent can inspect its own observability trace and surface useful review signals.
```

看文件：

```text
src/lib/tracing.ts
src/instrumentation.ts
src/lib/agent/promiseAgent.ts
src/lib/mcp/phoenixClient.ts
src/lib/evaluation/phoenixTrace.ts
src/app/api/insights/route.ts
src/components/SelfReview.tsx
scripts/test-phoenix.mjs
scripts/test-phoenix-mcp.mjs
docs/05-mcp-arize.md
```

环境变量：

```text
PHOENIX_COLLECTOR_ENDPOINT
PHOENIX_API_KEY
PHOENIX_PROJECT
```

Connectivity check：

```bash
node scripts/test-phoenix.mjs
node scripts/test-phoenix-mcp.mjs
```

Runtime check：

```bash
curl -s "http://localhost:3000/api/insights"
```

Good:

- Phoenix tracing enabled。
- 能看到 `phoenix-connectivity-test` span。
- audit run 有 LLM spans 和 tool spans。
- `/api/insights` 能通过 Phoenix MCP 读回 project / latest audit trace。
- `SelfReview` UI 显示 span count、Gemini turns、tool calls、trace id。
- Arize/Phoenix 被描述为 observability / audit / self-review，不是 final decision maker。

Acceptable but needs wording:

- MCP self-review 只显示 project + latest trace summary，还没有 per-promise trace deep link。
- 可以说 “implemented for observability and self-review; per-promise trace linking remains pending”。

Bad:

- UI 只写 “via Arize” 但没有 trace / MCP runtime evidence。
- Arize 被说成可以直接改变 promise status。
- Phoenix env 缺失时没有 graceful degradation。
- 没有任何 tool call span。

提交前最好能回答这些问题：

```text
What did Gemini extract?
Which tools did it call?
Did policy override or constrain Gemini?
Did Gemini try to overpromise?
What can the manager review from the trace?
```

---

## 11. Google Cloud / Agent Builder 检查

看文件：

```text
builder.md
agent/promise_agent/agent.ts
agent/promise_agent/server.ts
src/lib/agent/adkClient.ts
src/lib/classifier.ts
scripts/deploy-cloud-run.sh
README.md
AGENTS.md
```

本地 proof：

```text
Next.js app -> ADK service -> Gemini / tools -> proposals -> policy adjudication
```

Good:

- `agent/promise_agent` 是 standalone ADK service。
- `server.ts` exposes `POST /audit`。
- `src/lib/agent/adkClient.ts` calls `{ADK_AGENT_URL}/audit`。
- `src/lib/classifier.ts` puts ADK first when `ADK_AGENT_URL` is configured。
- Audit response can show `reasoning_source: "adk"`。
- Deployment target is Cloud Run。
- `scripts/deploy-cloud-run.sh` deploys both app and ADK service, then wires `ADK_AGENT_URL`。

Bad:

- Only local hand-written loop, no ADK path。
- ADK service exists but Next.js never calls it。
- Hosted URL is on Vercel。
- README claims cloud deployment is complete when it is not。

Submission wording should be precise:

```text
Local ADK / Agent Builder orchestration is implemented.
Cloud Run deployment is the submission target.
When ADK_AGENT_URL is configured, ADK is the primary orchestration path.
Gemini and deterministic rules remain fallback layers.
```

不要说：

```text
Arize makes decisions.
Agent Builder fully deployed to production.
The app is purely Gemini-driven.
```

除非这些事实已经被最终环境验证。

---

## 12. UI / Demo Flow 检查

看文件：

```text
src/app/page.tsx
src/components/AppShell.tsx
src/components/CommandWorkspace.tsx
src/components/AgentFlowGraph.tsx
src/components/PromiseLedger.tsx
src/components/PromiseDetailDrawer.tsx
src/components/TaskBoard.tsx
src/components/ComplaintRecovery.tsx
src/components/SelfReview.tsx
src/lib/i18n.ts
```

> 注意：`ManagerBriefing.tsx` / `AgentTeamFlow.tsx` / `BookingEmailPanel.tsx` /
> `BookingHeader.tsx` / `DataFreshnessPanel.tsx` / `SpotlightCard.tsx` 在前端重构后已无
> 引用（dead code），不要按它们核查 UI；待删除。

Good:

- First screen 是 usable operational dashboard，不是 marketing landing page。
- Primary persona 是 duty manager / operations lead。
- UI 让 manager 看 status、risk、evidence、approval required、next action。
- `AgentFlowGraph` 能解释 stage 状态。
- `SelfReview` 能体现 Arize Phoenix MCP。
- Complaint trace 能从 UI 触发。

Bad:

- UI 像 guest chatbot。
- UI 重点是任务列表，而不是 promise verification。
- 没有 manager control。
- Arize 只是 logo/badge。
- 文案还在说 Fivetran 是当前 partner。

---

## 13. Demo Invariants

这些是 demo 的保护线。任何 agent 检查时都不能“顺手修”。

| Item | Must stay |
| --- | --- |
| Main booking | `BKG-2026-0718-ACME` |
| Main promises | exactly 6 |
| `DEMO_NOW` | `2026-07-18T10:00:00Z` |
| `TASK-103` | `open` |
| `TASK-102` due time | `2026-07-18T14:00:00` |
| Projector SOP due time | `12:00` / 120 minutes before meeting |
| Early check-in | `cannot_confirm` |
| Quiet king | `at_risk` |
| Breakfast | `verifiable` |
| Projector | `verifiable` |
| Airport transfer | `missing_info` |
| Company invoice | `missing_info` |

Good:

- Complaint trace can still detect `TASK-103` open。
- Complaint trace can still detect `TASK-102` due-time mismatch。

Bad:

- `TASK-103` completed。
- `TASK-102` due time changed to `12:00` in seeded data。
- Acme main flow gets new promises added。
- Status names renamed。

---

## 14. Final Submission Checklist

### Product checklist

- [ ] Product is positioned as promise verification and recovery layer。
- [ ] Primary persona is duty manager / operations lead。
- [ ] No real login / RBAC built。
- [ ] Demo shows manager approval and human control。
- [ ] Demo shows complaint trace back to exact broken promise / task。

### Agent checklist

- [ ] Gemini is used in actual audit path。
- [ ] ADK / Agent Builder service exists and is callable。
- [ ] `ADK_AGENT_URL` path can produce `reasoning_source: "adk"`。
- [ ] Fallback path to Gemini loop exists。
- [ ] Fallback path to deterministic rules exists。
- [ ] Deterministic policy is final executable decision maker。
- [ ] Read-only tools are used for evidence。

### Eval checklist

- [ ] `npm run typecheck` pass。
- [ ] `npm run build` pass。
- [ ] `npm run eval` pass。
- [ ] Unsafe overpromise count is `0`。
- [ ] 6 promise statuses match golden expectations。
- [ ] Missing-info recall covers airport transfer and company invoice。
- [ ] Complaint trace catches `P-002/TASK-103` and `P-004/TASK-102`。

### Arize/Phoenix MCP checklist

- [ ] `PHOENIX_COLLECTOR_ENDPOINT` set in final env。
- [ ] `PHOENIX_API_KEY` set in final env。
- [ ] `node scripts/test-phoenix.mjs` sends span successfully。
- [ ] `node scripts/test-phoenix-mcp.mjs` can call Phoenix MCP。
- [ ] Audit run creates LLM/tool/policy-related spans。
- [ ] `/api/insights` can read self-review data。
- [ ] Dashboard shows useful trace summary。
- [ ] Wording says Arize is observability / audit / self-review。
- [ ] Wording does not say Arize changes final promise decisions。

### Google Cloud checklist

- [ ] Hosted URL exists。
- [ ] Hosted URL is Cloud Run or Firebase Hosting。
- [ ] Not Vercel。
- [ ] App service deployed。
- [ ] ADK service deployed or clearly wired as Cloud Run service。
- [ ] App env includes `ADK_AGENT_URL` pointing to ADK service。
- [ ] Vertex/Gemini credentials are configured。
- [ ] Public repo exists。
- [ ] OSI license exists (`LICENSE`, MIT)。

### Docs / messaging checklist

- [ ] README current-state wording is accurate。
- [ ] `AGENTS.md` does not conflict with final state。
- [ ] `builder.md` deployment progress is accurate。
- [ ] `docs/05-mcp-arize.md` does not overclaim per-promise trace linking if not implemented。
- [ ] No old Fivetran-current-partner wording remains。
- [ ] No Vercel-allowed wording remains。
- [ ] Demo script says “Gemini proposes, policy decides”。

---

## 15. Good / Bad 快速判断表

| Area | Good | Bad |
| --- | --- | --- |
| Agent | `reasoning_source` can be `adk` / `gemini`; tools called | Always `rules` but claims agent |
| Tools | read-only, stable output, evidence-backed | model guesses, no evidence |
| Policy | final status from deterministic rules | LLM can upgrade to guarantee |
| Eval | golden statuses pass, overpromise `0` | missing info marked `verifiable` |
| Trace | Phoenix has LLM/tool spans, `/api/insights` reads them | Arize is only a badge |
| UI | manager sees risk/evidence/approval/recovery | generic chatbot/task list |
| Demo data | `TASK-102` and `TASK-103` preserve intentional failures | seeded failures fixed |
| Deployment | Cloud Run / Firebase, public URL | Vercel or no hosted URL |

---

## 16. 如果只剩 2 小时，优先做什么

按这个顺序：

1. 跑通 `npm run typecheck`。
2. 跑通 `npm run build`。
3. 跑通 app audit，确认 6 个 statuses。
4. 跑通 `npm run eval`。
5. 确认 `reasoning_source` 能展示 ADK 或 Gemini 路径。
6. 确认 `/api/insights` 和 Phoenix MCP 有 runtime evidence。
7. 确认 hosted URL 是 Cloud Run / Firebase。
8. 准备 3 分钟 demo script。
9. 人工复核官方 submission checklist。

如果 Arize per-promise deep link 还没做完，不要硬说做完。更安全的说法是：

```text
Arize/Phoenix is used for trace export and runtime self-review.
The dashboard reads latest audit trace summary through Phoenix MCP.
Per-promise deep linking is a known next step.
```

如果 ADK cloud deployment 还没完全稳定，不要硬说 fully deployed。更安全的说法是：

```text
The local ADK / Agent Builder orchestration path is implemented and is the primary path when ADK_AGENT_URL is configured.
The deployment target is Cloud Run, and the final hosted environment must be verified before submission.
```

---

## 17. 给 demo 的 60 秒解释词

可以直接照这个讲：

```text
StayOps is a promise verification and recovery layer for hotel operations.
The manager is not asking an AI chatbot to promise things to guests.
Instead, Gemini extracts guest-facing promises and calls read-only hotel tools for evidence.
Then deterministic policy guardrails decide what is verifiable, risky, missing information, or impossible to confirm.
The duty manager stays in control for risky promises.
Arize Phoenix records the Gemini turns, tool calls, and policy guardrails so the team can audit whether the agent overpromised.
If a complaint happens, StayOps traces it back to the exact promise and failed task.
```

中文理解：

```text
我们不是让 AI 直接对客承诺。
我们让 AI 帮经理把承诺、证据、风险、任务和失败链路整理出来。
真正能不能承诺，由 policy 和 manager control 决定。
Arize/Phoenix 负责让这个过程可审计。
```

---

## 18. 最后人工复核问题

提交前，人类 owner 至少要能回答：

1. 评委打开 hosted URL 后，第一屏能不能看到真实 workflow？
2. 我能不能在 30 秒内解释为什么没有 login？
3. 我能不能证明 Gemini / ADK 真实参与过 audit？
4. 我能不能证明 Arize/Phoenix MCP 不是装饰？
5. 我能不能证明 policy 防止了 overpromise？
6. 我能不能解释为什么 `TASK-102` 和 `TASK-103` 是故意失败？
7. 我能不能说明当前哪些是 implemented，哪些是 pending？
8. README / demo video / UI 是否说法一致？

如果这些问题都能回答，项目就不会只是“能跑”，而是能被讲清楚、被审计、被提交。
