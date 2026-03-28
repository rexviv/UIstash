# UIstash — Quiet Editorial Design Specification

## 1. Philosophy

UIstash is a personal archive tool for design inspiration. The interface should feel like a premium notebook — quiet, focused, and refined. It does not announce itself; it gets out of the way and lets the archived content breathe. The aesthetic draws from editorial print design, Japanese minimalism, and the restrained UI language of tools like Linear, Notion (in focused mode), and Raycast.

**Core principle**: every pixel of chrome should earn its place. If something can be removed without losing function, it should be.

---

## 2. Color System

### Design Tokens (CSS Variables)

```css
:root {
  /* Backgrounds — warm off-white, never pure white */
  --bg-base:       #f7f5f2;   /* page canvas */
  --bg-subtle:     #f2f0ec;   /* card hover, subtle contrast */
  --bg-elevated:   #ffffff;   /* elevated surfaces: dialogs, selected cards */
  --bg-sunken:     #eeece8;   /* inset wells, input backgrounds */

  /* Ink — warm near-black hierarchy */
  --ink-primary:   #1a1916;   /* headings, primary text */
  --ink-secondary: #5c5952;   /* body text, labels */
  --ink-tertiary:  #9a9590;   /* placeholders, muted metadata */
  --ink-ghost:     #c8c4be;   /* disabled, very subtle */

  /* Borders — barely-there lines */
  --border-default: rgba(26, 25, 22, 0.08);
  --border-subtle:  rgba(26, 25, 22, 0.04);
  --border-strong:  rgba(26, 25, 22, 0.14);

  /* Accent — restrained warm amber */
  --accent:        #c4a882;   /* primary action, selected state */
  --accent-soft:   rgba(196, 168, 130, 0.12);
  --accent-hover:  #b39670;

  /* Semantic */
  --danger:        #b44a3a;
  --danger-soft:   rgba(180, 74, 58, 0.08);
  --success:       #4a7c5a;
  --success-soft:  rgba(74, 124, 90, 0.1);

  /* Shadows — very soft, warm-tinted, only on elevated surfaces */
  --shadow-sm:  0 1px 3px rgba(26, 25, 22, 0.04);
  --shadow-md:  0 4px 16px rgba(26, 25, 22, 0.06);
  --shadow-lg:  0 12px 40px rgba(26, 25, 22, 0.08);

  /* Radius */
  --radius-sm:  8px;
  --radius-md:  12px;
  --radius-lg:  16px;

  /* Typography */
  --font-sans: "Inter", "PingFang SC", "Microsoft YaHei", -apple-system, sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", monospace;
}
```

### Color Usage Rules

| Token | Usage |
|---|---|
| `--bg-base` | Page background, dashboard canvas |
| `--bg-subtle` | Hover states, secondary surfaces |
| `--bg-elevated` | Dialogs, popovers, selected cards |
| `--bg-sunken` | Input fields, textarea backgrounds |
| `--ink-primary` | All headings (h1, h2, h3), primary labels |
| `--ink-secondary` | Body text, descriptions, metadata |
| `--ink-tertiary` | Placeholders, timestamps, counts |
| `--border-default` | Card outlines, input borders, dividers |
| `--accent` | Primary button backgrounds, active tag highlights |
| `--accent-soft` | Tag chip backgrounds when selected |

**What to remove**: All warm beige/cream hex values like `#f8f3ec`, `#efe5d7`, `#8d7865`, `#67584c`, `#3f3127`, `#2e241d`. These warm brown tones dominate the current palette and make the UI feel dated and heavy. The new palette is cooler, lighter, and more neutral with only a whisper of warmth from the accent.

---

## 3. Typography System

### Font Stack
```css
--font-sans: "Inter", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
--font-mono: "JetBrains Mono", "SF Mono", monospace;
```

Inter is the single approved typeface. It is a clean, professional variable font with excellent legibility at small sizes and a refined weight spectrum. No decorative serif headings — all headings use Inter with weight and tracking to establish hierarchy.

### Type Scale

| Token | Size | Weight | Line Height | Tracking | Usage |
|---|---|---|---|---|---|
| `--text-2xs` | 10px | 500 | 1.4 | 0.08em | Overlapping labels, very small metadata |
| `--text-xs` | 11px | 500 | 1.4 | 0.08em | Uppercase category labels, timestamps |
| `--text-sm` | 13px | 400 | 1.55 | 0 | Body text, descriptions |
| `--text-base` | 14px | 400 | 1.6 | 0 | Primary body, note text |
| `--text-md` | 16px | 500 | 1.4 | -0.01em | Card titles, section headings |
| `--text-lg` | 18px | 600 | 1.3 | -0.02em | Page names in detail panel |
| `--text-xl` | 22px | 600 | 1.2 | -0.03em | Selected page title |
| `--text-2xl` | 28px | 700 | 1.1 | -0.04em | Popup logo heading |
| `--text-3xl` | 36px | 700 | 1.0 | -0.05em | Dashboard main heading |

### Typography Rules
- **No serif headings** — current `font-serif text-[30px] tracking-[-0.05em]` must be replaced with `font-sans font-bold text-[28px] tracking-[-0.04em]`
- **Labels**: uppercase labels use `--text-xs`, weight 500, letter-spacing 0.08em, color `--ink-tertiary`
- **Body**: `--text-sm` (13px), color `--ink-secondary`
- **Headings**: weight 600–700, tight tracking (-0.02em to -0.04em), color `--ink-primary`
- **Line heights**: tighter for large headings (1.0–1.2), comfortable for body (1.5–1.6)

---

## 4. Spacing System

Base unit: **4px**. All spacing is a multiple of 4.

| Token | Value | Usage |
|---|---|---|
| `--space-1` | 4px | Tight gaps, icon padding |
| `--space-2` | 8px | Default internal padding |
| `--space-3` | 12px | Between related elements |
| `--space-4` | 16px | Standard padding/gap |
| `--space-5` | 20px | Card padding |
| `--space-6` | 24px | Section gaps |
| `--space-8` | 32px | Large section separation |
| `--space-10` | 40px | Page-level breathing room |

### Padding Standards
- **Card padding**: 20px (`--space-5`) on all sides
- **Section gaps**: 24px between major sections
- **Input padding**: 12px horizontal, 10px vertical
- **Button padding**: 14px horizontal, 10px vertical (default size)

---

## 5. Component Redesign

### 5.1 Button

**Current**: Heavy rounded corners (15px+), warm brown borders, beige fills, strong shadows, serif-adjacent weight.

**Redesigned**:
```css
/* Default (primary action) */
background: var(--ink-primary);
color: var(--bg-base);
border: none;
border-radius: var(--radius-sm);      /* 8px — much tighter */
padding: 10px 16px;
font-size: var(--text-sm);
font-weight: 500;
box-shadow: var(--shadow-sm);
transition: all 150ms ease-out;

/* Hover */
background: #2d2c29;
box-shadow: var(--shadow-md);

/* Secondary */
background: transparent;
color: var(--ink-secondary);
border: 1px solid var(--border-default);
box-shadow: none;

/* Ghost */
background: transparent;
border: none;
color: var(--ink-secondary);

/* Icon button (size="icon") */
size: 32px × 32px;
border-radius: var(--radius-sm);
```

**Key changes**: Reduce corner radius from 15px to 8px. Remove warm brown borders and beige fills from default/secondary. Use `--ink-primary` (near-black) for primary button. Make ghost genuinely ghosted (no background on hover, just subtle opacity shift). Icon buttons should be 32px square, not 40px.

**Animation**: 150ms ease-out for all transitions. No `translateY` or active press effects — those feel mechanical.

### 5.2 Badge

**Current**: Full pill shape (rounded-full), warm beige fill, brown text, color-dot prefix.

**Redesigned**:
```css
/* Default badge */
display: inline-flex;
align-items: center;
gap: 6px;
padding: 4px 10px;
border-radius: 20px;              /* still rounded but not full circle */
border: 1px solid var(--border-default);
background: var(--bg-sunken);
color: var(--ink-secondary);
font-size: var(--text-xs);
font-weight: 500;

/* Accent badge (active/selected state) */
background: var(--accent-soft);
border-color: rgba(196, 168, 130, 0.2);
color: var(--ink-primary);

/* Danger badge */
background: var(--danger-soft);
border-color: rgba(180, 74, 58, 0.15);
color: var(--danger);
```

**Key changes**: Replace `rounded-full` with a gentler `border-radius: 20px`. Shift from warm beige fill to `--bg-sunken` (neutral gray-beige). Use accent soft for selected/active state.

### 5.3 Card

**Current**: Heavy `border-radius: 24px`, warm semi-transparent fills with gradient overlays, large drop shadows.

**Redesigned**:
```css
Card {
  border-radius: var(--radius-lg);  /* 16px */
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-sm);      /* very subtle */
}

/* Hover (if interactive) */
background: var(--bg-subtle);
box-shadow: var(--shadow-md);

/* Selected state */
border-color: var(--border-strong);
box-shadow: var(--shadow-md);
```

**Key changes**: Reduce radius from 24px to 16px. Remove gradient overlays and radial gradient decorations entirely — they add visual noise. Use a clean, flat white background. Reduce shadow intensity.

### 5.4 Input & Textarea

**Current**: 15px radius, inset shadow, warm semi-transparent fill, complex focus ring.

**Redesigned**:
```css
Input {
  width: 100%;
  height: 38px;
  padding: 0 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: var(--bg-sunken);
  color: var(--ink-primary);
  font-size: var(--text-sm);
  outline: none;
  transition: border-color 150ms, background 150ms, box-shadow 150ms;
}

Input::placeholder {
  color: var(--ink-ghost);
}

Input:focus {
  border-color: var(--border-strong);
  background: var(--bg-elevated);
  box-shadow: 0 0 0 3px rgba(196, 168, 130, 0.12);
}

Textarea {
  /* Same as Input but multi-line, min-height: 100px */
  padding: 12px 14px;
  min-height: 100px;
  resize: vertical;
  line-height: 1.6;
}
```

**Key changes**: Replace warm semi-transparent fills with neutral `--bg-sunken`. Remove inset shadow. Simplify focus state to a soft amber ring (matching accent color). Input height 38px (slightly taller than current ~40px but cleaner).

### 5.5 Separator

**Current**: 1px line with warm semi-transparent brown.

**Redesigned**:
```css
Separator {
  background: var(--border-default);  /* 1px solid rgba(26,25,22,0.08) */
  height: 1px;
  width: 100%;
}
```

No change to structure — just update the color reference.

### 5.6 Dialog

**Redesigned**:
```css
DialogOverlay {
  background: rgba(247, 245, 242, 0.75);
  backdrop-filter: blur(8px);
}

DialogContent {
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-lg);
  padding: 28px;
}
```

**Key changes**: Remove warm brown overlay tint. Replace with neutral warm off-white. Remove complex border color — use `--border-default`.

### 5.7 Dropdown Menu

**Redesigned**:
```css
DropdownMenuContent {
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-md);
  padding: 6px;
  min-width: 180px;
}

DropdownMenuItem {
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--ink-secondary);
  transition: background 100ms;
}

DropdownMenuItem[data-highlighted] {
  background: var(--bg-subtle);
  color: var(--ink-primary);
}

DropdownMenuItem[variant="destructive"] {
  color: var(--danger);
}
```

### 5.8 ScrollArea

**Current**: Custom scrollbar with warm brown thumb.

**Redesigned**:
```css
ScrollAreaScrollbar {
  width: 4px;
  padding: 0;
}

ScrollAreaThumb {
  background: rgba(26, 25, 22, 0.12);
  border-radius: 2px;
}

ScrollAreaThumb:hover {
  background: rgba(26, 25, 22, 0.2);
}
```

**Key changes**: Thinner scrollbar (4px vs 10px), neutral color instead of warm brown.

---

## 6. Popup Redesign (`src/popup/main.tsx`)

**Dimensions**: Keep 392x600px.

### Current Problems
- 30px border radius on outer card — too soft, dates the UI
- `font-serif` for "UIstash" heading — inconsistent with sans-serif system
- Warm beige gradient backgrounds on sections — decorative, not functional
- Multiple overlapping badges with status text — hard to scan
- Multiple nested rounded containers (card within card) — visual weight
- Settings icon button in corner — unnecessary given the gear is small

### Redesigned Layout

```
┌─────────────────────────────────────┐
│ HEADER (no card, just layout)       │
│  "UIstash"        [⚙ settings icon] │
│  Status badge   Tag count badge    │
├─────────────────────────────────────┤
│ PAGE CARD (flat, minimal)           │
│  Meta label (URL host)              │
│  Page title (2 lines max)           │
│  Source line (host + time)          │
│  [Open Dashboard →]                │
├─────────────────────────────────────┤
│ TAGS SECTION                        │
│  "Tags" label                       │
│  Tag chips in flex wrap            │
│  Input field for new tags          │
├─────────────────────────────────────┤
│ NOTE SECTION                        │
│  Textarea (grows to fill space)    │
├─────────────────────────────────────┤
│ FOOTER ACTIONS (minimal)            │
│  [Cancel]  [Save Page →]           │
└─────────────────────────────────────┘
```

### Specific Changes
1. **Outer card**: Replace `rounded-[30px] border-[rgba(110,92,74,0.12)] bg-[rgba(255,251,246,0.84)] shadow-[0_22px_50px_rgba(86,66,46,0.08)]` with `rounded-[16px] border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-[var(--shadow-md)]`
2. **Header**: No card, just direct layout. "UIstash" in `font-sans font-bold text-[24px] tracking-[-0.04em] color-[var(--ink-primary)]`. "Quiet Archive" label removed — it is pretentious and adds noise.
3. **Status area**: Single status badge using semantic color (green for connected, amber for pending, gray for missing). Count badge for queue items.
4. **Page section**: Remove gradient background, remove inner border, remove inset shadow. Just a clean section with `--text-xs` uppercase label, large title, muted source line.
5. **Tags**: Remove custom tag color dots from button — just text chips with soft background. Keep the color dot as a 6px dot before the name.
6. **Textarea**: Fill remaining vertical space with `flex-1`. `min-h-[100px]`.
7. **Footer**: Two buttons side by side — secondary/ghost left, primary right. No more "Save Current Page" verbose label, just "Save" with an arrow.
8. **Background**: No more radial gradient background on the body. Just `var(--bg-base)`.

---

## 7. Dashboard Redesign (`src/dashboard/App.tsx`)

**Layout**: Keep 3-column structure (268px sidebar | flexible main | 420px detail panel), but tighten everything.

### Sidebar (268px)

**Current problems**: Serif "UIstash" heading at 40px is oversized. Badge cluster at top is colorful but noisy. "Index" section with icon circle and description is decorative filler. Settings dialog buried in footer.

**Redesigned**:
```jsx
// Sidebar structure:
<aside className="flex flex-col gap-6 p-5 rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)]">

  // Header block — no card wrapper, just vertical stack
  <div>
    <h1 className="font-sans font-bold text-[22px] tracking-[-0.04em] color-[var(--ink-primary)]">UIstash</h1>
    <p className="mt-1 text-[var(--text-sm)] color-[var(--ink-tertiary)]">Personal Archive</p>
  </div>

  // Status row — minimal
  <div className="flex items-center gap-2">
    <span className="size-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
    <span className="text-[var(--text-xs)] color-[var(--ink-tertiary)]">{directoryStatusLabel}</span>
    <span className="text-[var(--text-xs)] color-[var(--ink-ghost)]">·</span>
    <span className="text-[var(--text-xs)] color-[var(--ink-tertiary)]">{pages.length} pages</span>
  </div>

  // Tags section — tight list, no decorative wrapper
  <div className="flex flex-col gap-1">
    <p className="text-[var(--text-xs)] font-medium uppercase tracking-[0.08em] color-[var(--ink-tertiary)] mb-2">Tags</p>
    <Button variant={!selectedTagId ? "accent" : "ghost"} size="sm" className="justify-between">
      <span>All pages</span>
      <span className="text-[var(--ink-ghost)]">{pages.length}</span>
    </Button>
    {tags.map(tag => (
      <Button
        key={tag.id}
        variant={selectedTagId === tag.id ? "accent" : "ghost"}
        size="sm"
        className="justify-between"
      >
        <span className="flex items-center gap-2">
          <span className="size-1.5 rounded-full" style={{ background: tag.color }} />
          {tag.name}
        </span>
        <span className="text-[var(--ink-ghost)]">{count}</span>
      </Button>
    ))}
  </div>

  // Settings at bottom — minimal link style
  <Button variant="ghost" size="sm" className="text-[var(--ink-tertiary)] mt-auto" onClick={() => setSettingsOpen(true)}>
    <Settings2 className="size-3.5" />
    Settings
  </Button>
</aside>
```

### Main Content Area

**Current problems**: Header card has gradient background — decorative. Search input has search icon positioned with absolute, complex layout. Grid of page cards has 196px thumbnail columns that feel fixed and rigid.

**Redesigned**:
```jsx
<main className="flex flex-col gap-4 overflow-hidden rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)]">

  // Top bar — no card, just flex row
  <div className="flex items-end justify-between px-5 py-4 gap-4">
    <div>
      <p className="text-[var(--text-xs)] font-medium uppercase tracking-[0.08em] color-[var(--ink-tertiary)]">Browse</p>
      <h2 className="font-sans font-semibold text-[20px] tracking-[-0.03em] color-[var(--ink-primary)]">
        {selectedTagId ? tag.name : "All Pages"}
      </h2>
    </div>
    // Search — simple, inline
    <div className="relative">
      <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 color-[var(--ink-ghost)]" />
      <Input value={query} onChange={...} placeholder="Search..." className="pl-9 h-9" />
    </div>
  </div>

  // Results grid
  <ScrollArea className="flex-1 px-5 pb-5">
    <div className="grid gap-3">
      {results.map(result => (
        <PageCard key={result.page.id} result={result} selected={selectedPage?.id === result.page.id} />
      ))}
    </div>
  </ScrollArea>
</main>
```

### Page Card (within main grid)

**Current**: 24px radius card, 196px fixed thumbnail column, gradient overlay on thumbnail.

**Redesigned**:
```jsx
<button
  onClick={() => setSelectedPageId(result.page.id)}
  className={cn(
    "w-full text-left rounded-[12px] border transition-all duration-150",
    selected
      ? "border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-[var(--shadow-md)]"
      : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-subtle)] hover:border-[var(--border-strong)]"
  )}
>
  <div className="flex gap-4 p-4">
    // Thumbnail — smaller, cleaner
    <div className="w-[140px] h-[100px] rounded-[8px] overflow-hidden bg-[var(--bg-sunken)] flex-shrink-0">
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[var(--ink-ghost)] text-xs">No preview</div>
      )}
    </div>

    // Content — minimal
    <div className="flex-1 min-w-0 flex flex-col justify-between">
      <div>
        <h3 className="font-sans font-semibold text-[15px] tracking-[-0.02em] color-[var(--ink-primary)] line-clamp-2">
          {result.page.title}
        </h3>
        <p className="text-[var(--text-xs)] color-[var(--ink-tertiary)] mt-1">{safeHost(result.page.latestUrl)}</p>
      </div>
      <div className="flex items-center justify-between mt-2">
        <p className="text-[var(--text-xs)] color-[var(--ink-ghost)]">{latestVersion ? formatTime(latestVersion.capturedAt) : "No capture"}</p>
        <div className="flex gap-1.5">
          {result.tagNames.slice(0, 2).map(name => (
            <span key={name} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-sunken)] color-[var(--ink-tertiary)]">{name}</span>
          ))}
        </div>
      </div>
    </div>
  </div>
</button>
```

### Detail Panel (420px)

**Current problems**: Dense with nested cards. CardHeader > CardTitle > CardDescription pattern is overly hierarchical. Icon circles (rounded-full bg-[rgba(47,57,68,0.08)]) are decorative filler. Heavy padding creates visual weight.

**Redesigned**:
```jsx
<aside className="flex flex-col gap-4 overflow-hidden rounded-[16px] border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-[var(--shadow-sm)]">
  {selectedPage ? (
    <>
      // Page header — simple, no card wrapper
      <div className="px-5 pt-5 pb-0">
        <p className="text-[var(--text-xs)] font-medium uppercase tracking-[0.08em] color-[var(--ink-tertiary)] mb-2">Inspector</p>
        <h2 className="font-sans font-semibold text-[18px] tracking-[-0.02em] color-[var(--ink-primary)] line-clamp-2">
          {selectedPage.title}
        </h2>
        <a href={selectedPage.latestUrl} className="mt-1 text-[var(--text-xs)] color-[var(--ink-tertiary)] hover:color-[var(--ink-secondary)] flex items-center gap-1">
          {safeHost(selectedPage.latestUrl)}
          <ExternalLink className="size-2.5" />
        </a>
      </div>

      // Page note
      <div className="px-5">
        <p className="text-[var(--text-xs)] font-medium uppercase tracking-[0.08em] color-[var(--ink-tertiary)] mb-2">Note</p>
        <Textarea
          value={pageNoteDraft}
          onChange={...}
          onBlur={...}
          placeholder="Add a note..."
          className="min-h-[80px] text-[13px]"
        />
      </div>

      // Tags
      <div className="px-5">
        <p className="text-[var(--text-xs)] font-medium uppercase tracking-[0.08em] color-[var(--ink-tertiary)] mb-2">Tags</p>
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] transition-all duration-100",
                selectedPage.tagIds.includes(tag.id)
                  ? "bg-[var(--accent-soft)] border border-[rgba(196,168,130,0.2)] color-[var(--ink-primary)]"
                  : "bg-[var(--bg-sunken)] border border-transparent color-[var(--ink-tertiary)] hover:bg-[var(--bg-subtle)]"
              )}
            >
              <span className="size-1.5 rounded-full" style={{ background: tag.color }} />
              {tag.name}
            </button>
          ))}
        </div>
      </div>

      // Versions — scrollable
      <ScrollArea className="flex-1 px-5 pb-5">
        <div className="flex flex-col gap-3">
          {selectedVersions.map(version => (
            <VersionCard key={version.id} version={version} />
          ))}
        </div>
      </ScrollArea>

      // Delete action — subtle, at bottom
      <div className="px-5 pb-5">
        <Button variant="ghost" size="sm" className="text-[var(--danger)] w-full justify-center" onClick={handleDeletePage}>
          <Trash2 className="size-3.5" />
          Delete page
        </Button>
      </div>
    </>
  ) : (
    // Empty state
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <p className="text-[var(--text-sm)] color-[var(--ink-tertiary)]">Select a page to inspect</p>
    </div>
  )}
</aside>
```

---

## 8. Animation & Motion Philosophy

### Principles
1. **Purposeful only** — animations communicate state change, not decoration
2. **Fast by default** — 150ms for micro-interactions, 250ms for layout shifts
3. **Ease-out curves** — elements arrive, they do not bounce

### CSS Transition Defaults
```css
/* Micro-interactions (button hover, input focus) */
transition: all 150ms ease-out;

/* Layout changes (panel open/close, card selection) */
transition: all 200ms ease-out;

/* Dialog/modal entrance */
transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1);
```

### Specific Animation Rules
- **Button hover**: `background`, `box-shadow`, `border-color` only. No translate, no scale.
- **Card selection**: `border-color`, `box-shadow` change. No background flash.
- **Input focus**: `border-color` shift + soft accent ring fade-in (150ms).
- **Dialog open**: Fade in + scale from 0.96 to 1.0 (250ms, ease-out).
- **Dialog close**: Fade out + scale to 0.98 (150ms, ease-in).
- **Dropdown menu**: Fade in + translateY(-4px to 0) (150ms, ease-out).
- **No bounce**, no spring, no elastic — these feel playful, not premium.
- **No stagger animations** on list items — they make the UI feel slow and theatrical.

---

## 9. Global Styles (`src/styles/globals.css`)

Replace the entire `@layer base` block with:

```css
@layer base {
  :root {
    /* Color tokens */
    --bg-base:       #f7f5f2;
    --bg-subtle:     #f2f0ec;
    --bg-elevated:   #ffffff;
    --bg-sunken:     #eeece8;
    --ink-primary:   #1a1916;
    --ink-secondary: #5c5952;
    --ink-tertiary:  #9a9590;
    --ink-ghost:     #c8c4be;
    --border-default: rgba(26, 25, 22, 0.08);
    --border-subtle:  rgba(26, 25, 22, 0.04);
    --border-strong:  rgba(26, 25, 22, 0.14);
    --accent:        #c4a882;
    --accent-soft:   rgba(196, 168, 130, 0.12);
    --accent-hover:  #b39670;
    --danger:        #b44a3a;
    --danger-soft:   rgba(180, 74, 58, 0.08);
    --success:       #4a7c5a;
    --success-soft:  rgba(74, 124, 90, 0.1);
    --shadow-sm:  0 1px 3px rgba(26, 25, 22, 0.04);
    --shadow-md:  0 4px 16px rgba(26, 25, 22, 0.06);
    --shadow-lg:  0 12px 40px rgba(26, 25, 22, 0.08);
    --radius-sm:  8px;
    --radius-md:  12px;
    --radius-lg:  16px;

    /* Spacing */
    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 20px;
    --space-6: 24px;
    --space-8: 32px;
    --space-10: 40px;
  }

  * { box-sizing: border-box; }

  html, body, #root {
    min-height: 100%;
    height: 100%;
  }

  body {
    margin: 0;
    background: var(--bg-base);
    color: var(--ink-primary);
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
    font-size: 14px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    font-feature-settings: "liga" 1, "kern" 1;
  }

  button, input, textarea, select {
    font: inherit;
    color: inherit;
  }

  img {
    display: block;
    max-width: 100%;
  }

  ::selection {
    background: var(--accent-soft);
  }

  /* Smooth scrolling */
  html {
    scroll-behavior: smooth;
  }

  /* Custom scrollbar — thin, neutral */
  ::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(26, 25, 22, 0.12);
    border-radius: 2px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(26, 25, 22, 0.2);
  }
}
```

---

## 10. Implementation Priorities

### Phase 1 — Foundation (do first)
1. Update `globals.css` with new CSS variable system
2. Update `button.tsx` with new variants and sizes
3. Update `badge.tsx` with new visual language
4. Update `card.tsx` — remove gradients, reduce radius
5. Update `input.tsx` and `textarea.tsx` — neutral fills, accent focus ring

### Phase 2 — Popup
6. Strip all decorative gradients from `popup/main.tsx`
7. Replace serif heading with Inter
8. Flatten card structure — remove nested containers
9. Simplify status badges

### Phase 3 — Dashboard
10. Update `dialog.tsx` and `dropdown-menu.tsx` styling
11. Restructure sidebar — remove decorative wrappers
12. Simplify main area header — remove gradient card
13. Tighten page card layout — smaller thumbnails, cleaner typography
14. Flatten detail panel — remove nested cards, simplify hierarchy

### Phase 4 — Polish
15. Verify all hover/focus/active states
16. Tune animation durations
17. Ensure responsive breakpoints still work
18. Test keyboard navigation and focus states

---

## 11. Reference Mood

**Reference UI quality**: Linear (linear.app), Notion in focused mode, Raycast, Bear Notes, Craft

**What these tools have in common**:
- Near-white backgrounds, near-black text
- Single accent color used sparingly
- Generous whitespace in content areas, dense in functional areas
- Typography does all the hierarchy work — no gradients needed
- Animations are felt, not seen
- Every decorative element removed leaves the UI stronger
