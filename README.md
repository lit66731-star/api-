# 灯塔（Lighthouse）

SillyTavern 扩展：**API 中转站管理**。统一维护你用的中转站列表，后续在此之上逐步补齐读密钥、代发余额/模型请求、验真（防模型偷换/掺水）。

## 功能

- **中转站列表管理**（v0.1.0 已完成）：添加 / 编辑 / 删除中转站，字段为名称、Base URL、备注，本地持久化。

## 规划（逐块推进）

1. ✅ 中转站列表管理
2. ⬜ 读密钥 —— 读酒馆已保存的 API key
3. ⬜ 代发余额 / 模型请求 —— 服务端代理转发，绕 CORS + 隐藏 key
4. ⬜ 验真 —— 防模型偷换 / 掺水

## 安装

把本目录放进 SillyTavern 的 `public/scripts/extensions/third-party/lighthouse/`，在「扩展」菜单开启「灯塔」即可。

## 结构

- `manifest.json` —— 扩展清单（name = `lighthouse`）
- `index.js` —— 前端面板逻辑
- `style.css` —— 面板样式（深夜 + 灯塔光束配色）
