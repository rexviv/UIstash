# UIstash — Frosted Glass Design Specification

## Concept & Vision

A local-first web page archiving tool reimagined as a **luminous digital sanctuary**. The aesthetic channels the softness of morning light through frosted glass — ethereal, inviting, and refined. Every surface catches and diffuses light gently, creating depth without harshness. This is a tool that feels like it belongs in a beautifully lit studio, not a dark server room.

---

## Design Direction: "Frosted Glass"

### Core Philosophy
- **Soft translucency** — Panels are translucent white glass with backdrop blur, letting the canvas color subtly bleed through.
- **Violet accent as personality** — A soft violet (#7c6af0) provides warmth and distinction against the cool glass surfaces.
- **Rounded corners throughout** — Every element has generous corner radii (6px to 28px), creating a cohesive, approachable feel.
- **Meaningful motion** — Animations are spring-based and functional: cards lift on hover, buttons respond to touch, panels slide gracefully.

### Motion Philosophy
- **Spring-based animations** — `hover:-translate-y-0.5` lifts elements, `active:scale-[0.97]` gives tactile press feedback.
- **150-200ms transitions** — Smooth but snappy, never sluggish.
- **Backdrop blur reveals depth** — Glass panels at different blur levels create natural z-axis hierarchy.
- **No decorative animation** — Motion always communicates state or provides feedback.

---

## Color System

### Canvas (Background)
| Role | Hex | Usage |
|------|-----|-------|
| Base | `#e8e4f0` | Main app background |
| Subtle | `#f0ecf8` | Lighter areas |
| Deep | `#ddd8ee` | Deeper accents |

### Glass Surfaces
| Role | Value | Usage |
|------|-------|-------|
| Glass BG | `rgba(255, 255, 255, 0.72)` | Primary card/panel surface |
| Glass BG Hover | `rgba(255, 255, 255, 0.85)` | Elevated hover state |
| Glass BG Active | `rgba(255, 255, 255, 0.95)` | Active/pressed state |
| Glass Border | `rgba(255, 255, 255, 0.5)` | Panel borders |
| Glass Border Subtle | `rgba(255, 255, 255, 0.25)` | Subtle dividers |

### Text
| Role | Hex | Usage |
|------|-----|-------|
| Primary | `#1a1625` | Headings, primary content |
| Secondary | `#5c5470` | Body text, descriptions |
| Muted | `#9b93b0` | Placeholders, metadata |
| Ghost | `#c5bfd6` | Disabled, very subtle |

### Accent — Soft Violet
| Role | Hex | Usage |
|------|-----|-------|
| Accent | `#7c6af0` | Primary buttons, active states |
| Accent Hover | `#6b58e0` | Hover state |
| Accent Soft | `rgba(124, 106, 240, 0.12)` | Subtle accent backgrounds |
| Accent Glow | `rgba(124, 106, 240, 0.25)` | Focus rings, glows |

### Semantic
| Role | Hex | Usage |
|------|-----|-------|
| Danger | `#e05c7c` | Destructive actions |
| Danger Soft | `rgba(224, 92, 124, 0.1)` | Danger backgrounds |
| Success | `#5cb88a` | Success states |
| Success Soft | `rgba(92, 184, 138, 0.12)` | Success backgrounds |

---

## Typography

### Font Stack
- **Monospace** (data, URLs, timestamps): `"JetBrains Mono", "Fira Code", "SF Mono", monospace`
- **Sans-serif** (UI, body): `"Inter", system-ui, sans-serif`

### Type Scale
| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `--text-2xs` | 10px | 400 | Very small metadata |
| `--text-xs` | 11px | 400 | Labels, uppercase tags |
| `--text-sm` | 12px | 400 | Body text |
| `--text-base` | 13px | 400 | Primary body |
| `--text-md` | 15px | 500 | Card titles |
| `--text-lg` | 18px | 600 | Panel headings |

---

## Component Specifications

### Button

**Default (primary)**:
```css
background: var(--accent);
color: white;
border: none;
border-radius: var(--radius-md);
padding: 10px 20px;
font-size: 14px;
font-weight: 600;
letter-spacing: 0.02em;
box-shadow: 0 2px 8px rgba(124, 106, 240, 0.25);
transition: all 200ms;
hover: bg var(--accent-hover), shadow 0 4px 16px rgba(124, 106, 240, 0.35), translateY(-2px);
active: scale(0.97);
```

**Secondary**:
```css
background: rgba(255, 255, 255, 0.6);
color: var(--ink-secondary);
border: 1px solid rgba(255, 255, 255, 0.4);
border-radius: var(--radius-md);
backdrop-filter: blur(20px);
box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
// hover: bg rgba(255, 255, 255, 0.8), translateY(-2px)
```

**Ghost**:
```css
background: transparent;
color: var(--ink-secondary);
border: none;
border-radius: var(--radius-md);
// hover: bg rgba(255, 255, 255, 0.5), color var(--ink-primary)
```

### Badge
```css
display: inline-flex;
align-items: center;
gap: 6px;
padding: 3px 10px;
border-radius: var(--radius-full);
border: 1px solid rgba(255, 255, 255, 0.5);
background: rgba(255, 255, 255, 0.7);
backdrop-filter: blur(12px);
font-size: 10px;
font-weight: 500;
text-transform: uppercase;
letter-spacing: 0.06em;
color: var(--ink-secondary);
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
```

### Card
```css
border-radius: var(--radius-lg);
border: 1px solid rgba(255, 255, 255, 0.4);
background: var(--glass-bg);
backdrop-filter: blur(20px) saturate(180%);
box-shadow: var(--shadow-glass); /* 0 4px 24px rgba(100, 80, 180, 0.08) */
```

### Input & Textarea
```css
border-radius: var(--radius-md);
border: 1px solid rgba(255, 255, 255, 0.4);
background: rgba(255, 255, 255, 0.6);
backdrop-filter: blur(20px);
color: var(--ink-primary);
font-size: 13px;
padding: 10px 16px;
box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
transition: all 200ms;
// focus: border-color var(--accent), shadow 0 0 0 3px var(--accent-glow)
```

### Dialog
```css
/* Overlay */
background: rgba(232, 228, 240, 0.6);
backdrop-filter: blur(12px);

/* Content */
border-radius: var(--radius-xl);
border: 1px solid rgba(255, 255, 255, 0.4);
background: var(--glass-bg);
backdrop-filter: blur(24px) saturate(180%);
padding: 24px;
box-shadow: var(--shadow-elevated); /* 0 8px 32px rgba(100, 80, 180, 0.12) */
```

### ScrollArea
```css
/* Thin elegant scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(124, 106, 240, 0.2);
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(124, 106, 240, 0.35);
}
```

### Separator
```css
background: linear-gradient(to right, transparent, rgba(255,255,255,0.2), transparent);
height: 1px;
width: 100%;
```

---

## Shadow System

```css
--shadow-glass: 0 4px 24px rgba(100, 80, 180, 0.08), 0 1px 4px rgba(100, 80, 180, 0.04);
--shadow-elevated: 0 8px 32px rgba(100, 80, 180, 0.12), 0 2px 8px rgba(100, 80, 180, 0.06);
--shadow-float: 0 16px 48px rgba(100, 80, 180, 0.16), 0 4px 12px rgba(100, 80, 180, 0.08);
```

---

## Radius System

```css
--radius-xs: 6px;
--radius-sm: 10px;
--radius-md: 14px;
--radius-lg: 20px;
--radius-xl: 28px;
--radius-full: 9999px;
```

---

## Popup Layout (392×600px)

### Structure
```
┌──────────────────────────────────────┐
│ UIstash                          [⚙] │  ← glass card header
├──────────────────────────────────────┤
│            QUEUE: 0                    │  ← badge top-right
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ Page Title Here              ✓ │ │  ← glass card, rounded
│ │ example.com · Mar 27, 2026     │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ [● tag-1] [○ tag-2] [○ tag-3]       │  ← pill buttons
│ [> new-tag________________]          │  ← glass input
├──────────────────────────────────────┤
│ ════════════════════════════════════  │  ← gradient separator
├──────────────────────────────────────┤
│ [Note...                          ]  │  ← glass textarea
├──────────────────────────────────────┤
│      [ SAVE CURRENT PAGE  ]          │  ← violet accent button
└──────────────────────────────────────┘
```

### Key Design Choices
- All corners are rounded (14px–20px radius)
- Glass panels with backdrop blur
- Status indicator: badge with semantic colors
- Page title: sans-serif, 15px, primary ink color
- Source URL + timestamp: monospace, muted color
- Tags: pill-shaped buttons with color dots
- Save button: violet background with glow shadow, lift on hover

---

## Dashboard Layout (3-column: 288px | flex | 420px)

### Sidebar (288px)
- Glass-subtle background `rgba(255,255,255,0.45)` with `backdrop-blur(12px)`
- UIstash title: sans-serif, 24px, bold, primary ink
- Tag list: rounded buttons with color dots
- Settings button at bottom

### Main Content (flex)
- Page cards: glass with `backdrop-blur-xl`, lift on hover
- Thumbnail: rounded corners, glass overlay
- Selected state: accent border glow
- Hover: `translateY(-2px)` with elevated shadow

### Detail Panel (420px)
- Glass-subtle background
- Section cards: glass with clear hierarchy
- Version cards: glass-subtle nested inside glass
- All dividers: gradient separators

---

## Animation Tokens

```css
/* Transitions */
--transition-fast: 150ms;
--transition-base: 200ms;
--transition-slow: 300ms;

/* Easing */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* spring overshoot */
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1); /* smooth out */

/* Hover lift */
.hover-lift {
  transition: transform var(--transition-base) var(--ease-spring), box-shadow var(--transition-base);
}
.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-elevated);
}

/* Press feedback */
.active-press:active {
  transform: scale(0.97);
  transition: transform 100ms;
}
```

---

## Global Styles

```css
body {
  background: var(--canvas);
  color: var(--ink-primary);
  font-family: "Inter", system-ui, sans-serif;
}

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(124, 106, 240, 0.2);
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(124, 106, 240, 0.35);
}

::selection {
  background: var(--accent-soft);
  color: var(--ink-primary);
}
```
