# UIstash — Terminal Editorial Design Specification

## Concept & Vision

A local-first web page archiving tool redesigned as a **command center for digital memory**. The aesthetic merges the precision of a Bloomberg terminal with the sophistication of high-end editorial design. The tool feels like it was built by obsessives, for obsessives — a serious instrument for people who take archiving seriously. Every pixel communicates: this is a power tool, not a consumer app.

---

## Design Direction: "Terminal Editorial"

### Core Philosophy
- **Structure is ornament** — Expose the grid, don't hide it. Visible borders and dividers are design elements.
- **Typography as interface** — Type hierarchy carries meaning. Monospace signals data; serif signals content.
- **Dark as default** — Deep ink blacks, not gray. High contrast for readability during long sessions.
- **Motion is minimal and functional** — No decorative animation. Only meaningful state changes.

---

## Color System

### Backgrounds
| Role | Hex | Usage |
|------|-----|-------|
| Base | `#080808` | Page/app background |
| Surface | `#0f0f0f` | Cards, panels |
| Surface Raised | `#181818` | Hover states |
| Surface Active | `#222222` | Selected/active states |
| Border | `#2a2a2a` | Structural borders, dividers |
| Border Bright | `#3a3a3a` | Emphasized borders |

### Text
| Role | Hex | Usage |
|------|-----|-------|
| Primary | `#e8e8e8` | Headings, primary content |
| Secondary | `#888888` | Labels, secondary text |
| Muted | `#555555` | Placeholders, disabled |
| Accent | `#00ff88` | Primary accent (phosphor green) |
| Accent Dim | `#00cc6a` | Accent hover |
| Warning | `#ff6b35` | Destructive, errors |

### Accent Philosophy
The phosphor green (#00ff88) is used SPARINGLY — only for:
- Primary actions (Save button)
- Active/selected indicators
- Critical status
- Links and interactive elements

Everything else stays monochrome to let the accent breathe.

---

## Typography

### Font Stack
- **Monospace** (data, URLs, timestamps): `"JetBrains Mono", "Fira Code", "SF Mono", monospace`
- **Serif** (headings, titles): `"Playfair Display", "Georgia", serif`
- **Sans-serif** (UI labels, body): `"Inter", system-ui, sans-serif`

### Type Scale
| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `--text-2xs` | 10px | 400 | Very small metadata |
| `--text-xs` | 11px | 400 | Labels, uppercase tags |
| `--text-sm` | 12px | 400 | Body text, descriptions |
| `--text-base` | 14px | 400 | Primary body |
| `--text-md` | 15px | 500 | Card titles |
| `--text-lg` | 18px | 600 | Panel headings |
| `--text-xl` | 24px | 700 | Page titles in detail |

### Typography Rules
- **Monospace for data**: URLs, timestamps, metadata — always monospace
- **Serif for content**: Page titles, major headings — Playfair Display or Georgia
- **Sans-serif for UI**: Buttons, labels, navigation — Inter
- **No decorative type** — every font choice is semantic

---

## Component Specifications

### Button

**Default (primary)**:
```css
background: #00ff88;
color: #080808;
border: none;
border-radius: 0;
padding: 10px 16px;
font-size: 12px;
font-weight: 600;
letter-spacing: 0.04em;
text-transform: uppercase;
transition: background 150ms;
```

**Secondary**:
```css
background: transparent;
color: #888888;
border: 1px solid #2a2a2a;
border-radius: 0;
// hover: border-color: #3a3a3a
```

**Ghost**:
```css
background: transparent;
color: #888888;
border: none;
border-radius: 0;
// hover: color: #e8e8e8
```

**Icon button**: `32×32px`, `border-radius: 0`, no border, icon only

### Badge
```css
display: inline-flex;
align-items: center;
gap: 6px;
padding: 3px 8px;
border-radius: 0;
border: 1px solid #2a2a2a;
background: transparent;
font-size: 10px;
font-weight: 500;
text-transform: uppercase;
letter-spacing: 0.06em;
color: #888888;
```

### Card
```css
border-radius: 0;
border: 1px solid #2a2a2a;
background: #0f0f0f;
box-shadow: none;  /* no shadows */
```

### Input & Textarea
```css
border-radius: 0;
border: 1px solid #2a2a2a;
background: #0f0f0f;
color: #e8e8e8;
font-family: "JetBrains Mono", monospace;
font-size: 12px;
padding: 10px 12px;
transition: border-color 150ms;
/* focus: border-color: #00ff88 */
```

### Dialog
```css
/* Overlay */
background: rgba(8, 8, 8, 0.85);
backdrop-filter: blur(4px);

/* Content */
border-radius: 0;
border: 1px solid #2a2a2a;
background: #0f0f0f;
padding: 28px;
box-shadow: none;
```

### ScrollArea
```css
/* Thin, square scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #0f0f0f; }
::-webkit-scrollbar-thumb { background: #333333; }
::-webkit-scrollbar-thumb:hover { background: #444444; }
```

### Separator
```css
background: #2a2a2a;
height: 1px;
width: 100%;
```

---

## Popup Layout (392×600px)

### Structure
```
┌──────────────────────────────────────┐
│ UISTASH              [⚙]             │  ← header, serif title, ghost icon
├──────────────────────────────────────┤
│ ● CONNECTED          12 pages          │  ← status row, dot + text
├──────────────────────────────────────┤
│ CURRENT PAGE                        ▼  │
│ Page Title Here                      │  ← serif, large
│ example.com · Mar 27, 2026          │  ← monospace, small
├──────────────────────────────────────┤
│ TAGS                                 │
│ [+ tag-1] [+ tag-2] [+ tag-3]       │  ← inline chips
│ [________________________]             │  ← input
├──────────────────────────────────────┤
│ [________________________________]   │  ← textarea, fills space
│ [________________________________]   │
├──────────────────────────────────────┤
│ [CANCEL]           [SAVE PAGE →]     │  ← ghost + accent
└──────────────────────────────────────┘
```

### Key Design Choices
- All corners are sharp (no border-radius anywhere)
- Status indicator: colored dot (green=connected, amber=pending, gray=missing)
- Page title: serif font, large, primary text color
- Source URL + timestamp: monospace, muted color
- Tags: bordered chips with color dots
- Save button: phosphor green background, dark text, uppercase

---

## Dashboard Layout (3-column: 260px | flex | 400px)

### Sidebar (260px)
- Black background `#080808`
- UIstash title: serif font, 20px, primary text
- Status: small dot + "CONNECTED · 12 pages" in monospace
- Tag list: bordered rows, no rounded corners, color dots
- Settings: ghost button at bottom

### Main Content (flex)
- Page cards: no rounded corners, bordered, flat
- Thumbnail: 140×100px, sharp corners, bordered
- Typography hierarchy: serif title (content) / monospace URL + timestamp (data)
- Selected state: border-color brightens to `#3a3a3a`

### Detail Panel (400px)
- Flat structure — no nested cards, no icon circles
- Section headers: uppercase, monospace, small, muted
- Page title: serif, large
- Version cards: bordered blocks with clear data hierarchy
- All dividers: 1px `#2a2a2a` lines

---

## Motion Philosophy

- **No decorative animation** — nothing moves unless it communicates state
- **150ms transitions** for all interactive state changes
- **No bounce, spring, or elastic** — precision over playfulness
- **No scale or transform** effects — only color/border changes
- **No staggered list animations** — theatrical and slow

---

## Global Styles

```css
body {
  background: #080808;
  color: #e8e8e8;
  font-family: "Inter", system-ui, sans-serif;
}

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #0f0f0f; }
::-webkit-scrollbar-thumb { background: #333333; }
::-webkit-scrollbar-thumb:hover { background: #444444; }

::selection { background: #00ff88; color: #080808; }
```
