# follow your codex

一个轻量、只读、本地运行的 Codex Token 用量仪表盘。

它读取 Codex 保存在 `~/.codex/sessions` 与 `~/.codex/archived_sessions` 中的 JSONL 会话元数据，展示 Token 使用趋势、输入/缓存/输出构成、5 小时与周额度窗口、上下文占用、项目/模型排行、每日明细和时间分布。它不会使用对话正文，不需要 API Key，不修改 Codex 配置，也不会发送遥测。

## 特点

- 零第三方运行时依赖：使用 Node.js 24+，原生支持 Zstandard 压缩历史日志
- 本地网页仪表盘，仅监听 `127.0.0.1`
- 1 天、7 天、30 天和全部历史趋势；1 天视图自动保留最近 7 天作为图表参照
- 输入、缓存输入、输出与推理 Token 构成，支持堆叠趋势图
- 最新的 Codex 主/次额度窗口和重置倒计时
- 日均、周期环比、活跃天数、连续活跃、高峰日期和 30 日趋势预测
- 星期 × 小时活跃热力图，快速发现高消耗时段
- 项目、模型和每日用量明细；已适配 GPT-6 Astra、GPT-6 Sol、GPT-6.1 Sol 与 GPT-6 Luna
- CSV、Markdown 与 JSON 本地导出
- 文件级内存缓存，自动刷新时只重读发生变化的日志
- 损坏或正在写入的 JSONL 行会被安全忽略

## 设计取舍

新版首页仅统计 GPT / Codex 的 Token 与美元 API 等值花费，右侧显示额度状态，下方提供轻量统计卡片和平滑面积曲线。DeepSeek、MiMo、GLM、Qwen 事件会在进入仪表盘统计、排行、趋势与导出前过滤。API 等值花费按模型的非缓存输入、缓存输入和输出分别计算；标准短上下文参考单价核对于 2026-10-03，来源为 OpenAI 官方价格页。GPT-6 Astra、GPT-6 Sol、GPT-6.1 Sol、GPT-6 Luna 已使用对应规则。不包含阶梯长上下文、快速模式、工具附加费、活动优惠或区域附加费；未精确匹配模型会保留用量、但不计入金额。计价规则位于 src/pricing.js。

`codex-auto-review` 是 Codex 的内部自动审查路由。它没有公开的路由专属单价，因此仪表盘以 GPT-5.3-Codex 标准 API 单价作“代理估算”并明确标记；这不是自动审查的实付账单。

v0.4 综合参考了 HUSSEL 的简洁侧栏与额度优先布局、Codex Usage Desktop 的多维明细和导出能力，以及 CodexScope 的时间分桶与累计差分思路。实现仍保持单进程、零第三方运行时依赖，不引入代理、账号登录、云同步或不可验证的订阅费用换算。

## Windows 使用

桌面快捷方式 **Follow Your Codex - Token Meter** 使用无窗口启动器，不显示 CMD。关闭该次服务的最后一个仪表盘页面后约 8 秒自动退出；刷新和多个页面受到保护。后台页面通过持续连接保活，若浏览器崩溃或丢弃页面、连接断开，也会触发退出。启动后两分钟内未成功打开页面会自动退出。

此行为仅适用于桌面快捷方式（或 `node server.js --desktop`）启动的服务。之前从命令窗口启动的旧服务仍需手动关闭一次。

双击 `start-follow-your-codex.cmd`。浏览器会自动打开：

```text
http://127.0.0.1:17321
```

也可以从终端运行：

```powershell
npm start
```

如果 Codex 数据不在默认位置：

```powershell
node server.js --codex-home "D:\path\to\.codex"
```

指定端口或不自动打开浏览器：

```powershell
node server.js --port 18080 --no-open
```

## 数据口径

v0.5.1 同时读取 `.jsonl` 和更新后压缩保存的 `.jsonl.zst` 历史记录，原始文件保持只读。解压或读取失败会在页面提示统计不完整，不再静默忽略。压缩与未压缩的同一会话副本会去重。首次全量扫描需解压历史文件，后续刷新复用文件缓存。

v0.5.0 兼容新版 `token_usage_record`。按回合优先使用其逐次 `usage`，旧回合回退到 `token_count`，避免将两种格式的不同累计基准混算。响应 ID 用于新版记录去重；同一会话的分段日志会合并，归档副本不会重复累加。活动会话与归档会话均参与全部历史统计。

如果历史记录未显示，请先选择“全部”，确认 `--codex-home` 指向原 Codex 数据目录。此工具只能统计磁盘上仍存在的用量记录，无法还原已删除或未同步到本机的记录。

Codex 的 `token_count` 事件通常同时包含单次用量和会话累计用量。follow your codex 优先使用累计值的差分，首次事件使用单次用量作为回退，从而避免把同一会话的累计快照重复相加。

缓存 Token 通常已经包含在输入 Token 中，因此构成图展示“非缓存输入 + 缓存输入 + 输出”；推理输出单独列出，不重复加入总量。

额度数据来自最近一次包含 `rate_limits` 的本地 Codex 事件，因此与最后一次 Codex 活动一样新。该工具不会读取 `auth.json` 或请求 OpenAI/ChatGPT 接口。

“30 日趋势预测”按最近 7 个自然日的平均 Token 推算，只用于观察消耗趋势，不代表账单金额或官方套餐额度。热力图、活跃时段和周期环比均使用本机时区。

## 隐私

解析器只处理以下元数据记录：

- `session_meta`：仅使用会话 ID 和工作目录的最后一级名称
- `turn_context`：仅使用模型名和工作目录的最后一级名称
- `event_msg/token_count`：仅使用 Token、上下文和额度元数据
- `token_usage_record`：仅使用逐次 Token 与响应 ID，用于兼容与去重

提示词、回复、工具输出和文件内容事件会被直接忽略。仪表盘服务器只绑定本机回环地址。

## 测试

```powershell
npm test
```

## 开源说明

本项目采用 MIT License。v0.2 综合研究了 HUSSEL、Codex Usage Desktop 和 CodexScope 的信息架构与统计功能，并保持独立、零依赖实现；完整致谢见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
