# UIstash — Gallery Editorial Design Specification

> **状态:** 当前实现版本（Gallery Editorial）
> **设计愿景:** "设计师的私人画廊" — 像翻阅一本精心编排的视觉杂志，暖灰底色让截图成为绝对主角

---

## Design Language

### 调色板

| 角色 | 色值 | 用途 |
|------|------|------|
| 背景 | `#f5f3f0` | 主背景，暖白灰（画布感） |
| 卡片底 | `#ffffff` | 缩略图卡片白色底 |
| 主文字 | `#1a1a1a` | 标题、重要信息 |
| 次文字 | `#6b6b6b` | 正文、描述 |
| 辅助灰 | `#b0aca6` | 边界线、次要元素 |
| 主色调 | `#2a2a2a` | 深炭灰，强调元素 |
| 点缀色 | `#e85d4c` | 重要操作、存档按钮、未读标记 |

### Typography

- **标题**: Playfair Display（衬线，杂志编辑感）— `.font-serif`
- **正文/UI**: Inter（清晰无衬线）— 默认
- **元信息/域名/时间**: JetBrains Mono（等宽，精确技术感）— `.font-mono`

### 动效哲学

| 交互 | 动效 |
|------|------|
| 缩略图悬停 | `translateY(-8px) scale(1.02)` + holographic glow + 标题底部滑入 |
| 缩略图点击 | `scale(0.97)` 按压反馈 |
| 侧边抽屉打开 | `translateX(100%) → translateX(0)`，300ms ease-out |
| 按钮悬停 | 背景加深 + `translateY(-0.5)`，150ms |

---

## Layout

### Dashboard — 顶部工具条 + 网格画廊 + 侧边抽屉

```
┌──────────────────────────────────────────────────────────────┐
│  🌐 UIstash  [全部] [标签1] [标签2] [标签3]    🔍搜索    ⚙  │ ← 顶部工具条 h-14
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  截图1  │  │  截图２  │  │  截图３  │  │  截图４  │        │ ← 网格画廊
│  │  [标题] │  │  [标题] │  │  [标题] │  │  [标题] │        │   auto-fill minmax(220px)
│  │ ○ ○     │  │ ○       │  │ ○ ○ ○   │  │ ○       │        │   hover: 上浮+光晕+标题滑入
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                              │
│                                           ┌────────────────┐  │
│                                           │ ▓▓▓▓▓▓▓▓▓▓▓▓ │  │ ← 侧边抽屉 420px
│                                           │ ▓ 截图预览   ▓ │  │   全尺寸截图
│                                           │ 标题（衬线）   │  │   标题/标签/备注
│                                           │ ● 标签1 ● 标签2│  │   版本历史
└───────────────────────────────────────────┴────────────────┘  │
```

### Dashboard 组件

#### 顶部工具条
- 高度：56px（h-14）
- 背景：`rgba(255,255,255,0.88)` + backdrop-blur(20px)
- Logo：左侧，Globe 图标 + "UIstash" 衬线字
- 标签过滤器：胶囊按钮，选中态用标签颜色背景
- 搜索：右侧，带图标输入框
- 设置：最右侧图标按钮，打开 Dialog

#### 网格画廊
- 列数：响应式，`repeat(auto-fill, minmax(220px, 1fr))`
- 卡片：`card-base` class，白色背景，radius-16px
- 比例：保持原始截图比例，aspect-[4/3]
- 右下角：彩色标签圆点（每个标签一个圆点，颜色为标签指定色）
- Hover 效果：
  - `translateY(-8px) scale(1.02)` + `shadow-holographic`
  - 标题从底部滑入（`.title-slide` 覆盖层）

#### 侧边抽屉
- 宽度：420px
- 从右侧滑入，动效 300ms ease-out（`.drawer-enter`）
- 视觉重心：全尺寸截图占满抽屉
- 截图上方：底部渐变遮罩 + 截图操作按钮
- 截图下方：标题（衬线）+ 域名/时间 + 标签胶囊 + 备注 + 版本历史

### Popup — 截图预览 + 快速存档（392×600px）

```
┌──────────────────────────────────────┐
│ 🌐 UIstash              [⚙]          │ ← 顶部栏
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │                                │  │
│  │         截图预览 (16:9)        │  │ ← Card, aspect-ratio: 16/9
│  │                                │  │
│  └────────────────────────────────┘  │
│                                      │
│  当前页面标题（衬线）                 │ ← font-serif
│  example.com · 2026年3月29日        │ ← font-mono
│                                      │
│  ● 设计资源  ● 灵感收集              │ ← 标签胶囊
│                                      │
│  [添加备注...]                       │ ← Textarea
│                                      │
│  [ 📥 存 档 ]                        │ ← 主按钮，点缀色底
└──────────────────────────────────────┘
```

---

## Component Inventory

### 缩略图卡片（Dashboard）
- **默认**：白色背景，`radius-16px`，`shadow-card`
- **悬停**：`translateY(-8px) scale(1.02)` + `shadow-holographic` + 标题滑入
- **选中**：边框 `ring-2 ring-[var(--accent)]`
- **加载中**：灰色占位 + ImageIcon 居中

### 标签胶囊
- **选中**：背景为标签色（实色），白色文字
- **未选中**：白色背景，`border-[var(--charcoal)]/15`，小圆点跟随标签色

### 主按钮（存档）
- 背景：`var(--accent)` `#e85d4c`
- 文字：白色，tracking-wide
- 悬停：`bg-[var(--accent-hover)]` + `shadow-[0_4px_16px_rgba(232,93,76,0.3)]` + `translateY(-0.5)`
- 按压：`scale(0.97)`

### Dialog（设置面板）
- 背景：`var(--bg-card)` 白色
- 圆角：`radius-xl` 24px
- 边框：`border-[var(--charcoal)]/10`
- 遮罩：`bg-black/20 backdrop-blur-sm`

---

## Design Tokens（CSS Custom Properties）

```css
/* 背景 */
--bg-canvas: #f5f3f0;
--bg-card: #ffffff;
--bg-toolbar: rgba(255, 255, 255, 0.88);

/* 文字 */
--text-primary: #1a1a1a;
--text-secondary: #6b6b6b;
--text-muted: #b0aca6;

/* 强调 */
--accent: #e85d4c;
--accent-hover: #d44a3a;
--accent-soft: rgba(232, 93, 76, 0.1);
--accent-glow: rgba(232, 93, 76, 0.2);

/* 炭灰 */
--charcoal: #2a2a2a;
--charcoal-hover: #1a1a1a;

/* 语义 */
--success: #5cb88a;
--success-soft: rgba(92, 184, 138, 0.12);
--danger: #e05c5c;
--danger-soft: rgba(224, 92, 92, 0.1);

/* 阴影 */
--shadow-card: 0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-hover: 0 12px 32px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.06);
--shadow-holographic: 0 0 40px rgba(232, 93, 76, 0.15), 0 16px 40px rgba(0, 0, 0, 0.1);
--shadow-drawer: -4px 0 24px rgba(0, 0, 0, 0.08);

/* 圆角 */
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 24px;
--radius-full: 9999px;

/* 过渡 */
--transition-fast: 150ms;
--transition-base: 200ms;
--transition-slow: 300ms;
--ease-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
```

---

## 功能保留

- 存档核心逻辑：`captureCurrentPage`、`scanLibrarySnapshot`、`searchPages`
- 文件系统操作：`readSnapshotFile`、`updatePageMetadataOnDisk`、`exportLibraryZip`
- 标签管理：`createTag`、`toggleTag`、`deleteTag`
- 版本历史：`handleOpenFile`、`handleDeleteVersion`
- 队列管理：`handleRetryQueue`、`handleDeleteQueueItem`
- 设置：`chooseDirectory`、`handleExport`
- 新标签页查看存档：`handleOpenPageInNewTab`（读取 `latestVersion.fullPngPath`）

---

## 实现优先级

1. **Phase 1**: globals.css 新配色 + 字体引入 + Dashboard 网格布局 ✅
2. **Phase 2**: UI 组件重写（button, badge, card, input, textarea, dialog, dropdown, scroll-area, separator）✅
3. **Phase 3**: Dashboard 重构（网格画廊 + 侧边抽屉）✅
4. **Phase 4**: Popup 重设计 ✅
5. **Phase 5**: SPEC.md 更新 ✅
