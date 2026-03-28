# Editorial Workbench UI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 UIstash 重构为统一的 `Editorial Workbench` 视觉系统，并将该系统落到 `popup` 与 `dashboard`，同时保持现有归档业务流程不变。

**Architecture:** 先统一全局视觉 token 和基础 UI 组件外观，再分别重构 `popup` 和 `dashboard` 的布局与层级。实现时尽量复用现有业务逻辑，只调整结构、文案层级和样式表达，避免数据流与本地存储逻辑变更。

**Tech Stack:** React 19、TypeScript、Vite、Tailwind CSS 4、Vitest、Chrome Extension

---

### Task 1: 统一视觉基线与基础组件

**Files:**
- Modify: `D:/Data/projects/UIstash/src/styles/globals.css`
- Modify: `D:/Data/projects/UIstash/src/components/ui/button.tsx`
- Modify: `D:/Data/projects/UIstash/src/components/ui/card.tsx`
- Modify: `D:/Data/projects/UIstash/src/components/ui/badge.tsx`
- Modify: `D:/Data/projects/UIstash/src/components/ui/input.tsx`
- Modify: `D:/Data/projects/UIstash/src/components/ui/textarea.tsx`
- Modify: `D:/Data/projects/UIstash/src/components/ui/separator.tsx`

- [ ] 定义新的页面背景、面板、文字、边界和强调色 token，并统一 `body` 背景与全局字体语气。
- [ ] 调整 `Button`、`Card`、`Badge`、`Input`、`Textarea`、`Separator` 的视觉风格，使其符合“纸感档案 + 编辑工作台”的基线。
- [ ] 保持组件 API 不变，避免影响现有业务逻辑调用。

### Task 2: 重构 popup 为快速归档台

**Files:**
- Modify: `D:/Data/projects/UIstash/src/popup/main.tsx`

- [ ] 保留当前数据读取与保存流程，只重构布局和视觉层级。
- [ ] 将 popup 收束为“品牌头部 + 当前网页摘要 + 标签编辑区 + 备注区 + 唯一主动作”的结构。
- [ ] 强化当前页面状态、归档状态和保存按钮，弱化次要容器嵌套。

### Task 3: 重构 dashboard 为编辑工作台

**Files:**
- Modify: `D:/Data/projects/UIstash/src/dashboard/App.tsx`

- [ ] 保持三栏信息架构，但明确区分为“索引栏 / 浏览区 / 检查器”。
- [ ] 降低卡片堆叠感，提升缩略图、选中项与当前页面详情的舞台感。
- [ ] 统一页面标题、搜索、筛选、标签、版本操作的视觉语气。

### Task 4: 为可回归行为补最小测试覆盖

**Files:**
- Create: `D:/Data/projects/UIstash/src/tests/popup.test.tsx`
- Test: `D:/Data/projects/UIstash/src/tests/dialog.test.tsx`

- [ ] 为 popup 中可稳定验证的纯逻辑或渲染结构补充最小测试。
- [ ] 如果重构中抽出纯函数或可测试组件，优先覆盖它们，而不是为纯视觉细节写脆弱测试。

### Task 5: 验证、构建与交付

**Files:**
- Modify: `D:/Data/projects/UIstash/RUN.md`（仅在需要补充更清晰的 Chrome 加载说明时）

- [ ] 运行 `npm run test`，确认测试通过。
- [ ] 运行 `npm run build`，确认扩展构建成功并输出到 `dist/`。
- [ ] 检查最终可直接在 Chrome 通过 `Load unpacked` 加载 `dist/`。
- [ ] 输出简明的 Chrome 加载步骤，直接指向 `D:/Data/projects/UIstash/dist`。
