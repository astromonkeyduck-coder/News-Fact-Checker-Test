# Psyche Noir Editorial — Style Guide

## Visual Identity

**Theme name:** Psyche Noir Editorial

**Feel:** A cinematic neuroscience dream garden with retro editorial energy. Dark, alive, sophisticated, scientific, and memorable.

## Layers of Visual Identity

### 1. Neural Nature
- Botanical vine paths that resemble both plant veins and neural dendrites
- Neuron branches growing like organic roots
- Brain silhouette constructed from neural network paths
- Animated dendrite pulses and signal travel
- Deep-night forest/lab atmosphere

### 2. Freudian/Psychoanalytic Symbolism
- Iceberg divider (Conscious above waterline, Unconscious below)
- Abstract Rorschach-inspired decorative shapes (symmetrical blobs, coral/blue tinted)
- Dream-like floating concept words
- Subconscious layering metaphor in depth system

### 3. 1990s Editorial Cool
- Playfair Display serif for hero headings and section titles
- Section numbers in monospace (01 / NEURAL PATHWAY)
- Pull-quote blocks with thin coral rules
- Editorial divider lines with centered diamond nodes
- Film grain overlay (SVG noise, 3% opacity)
- Halftone dot pattern on module card previews

### 4. Neuroscience Command Center
- CED code chips in monospace
- Science practice badges with cyan accent
- Graph/data panels
- Scoring checklists
- Research design labels

## Color System

| Token | Value | Use |
|-------|-------|-----|
| --bg-deep | #050b16 | Deepest background |
| --bg-navy | #071426 | Primary background |
| --coral-primary | #ef6f61 | Neural accents, headings, CED badge |
| --blue-primary | #38bdf8 | Science highlights, axons, data |
| --cyan-glow | #22d3ee | Research/interactive accent |
| --synapse-yellow | #f7c948 | Signal pulses, memory hooks, Night Before |

## Typography

| Role | Font | Weight |
|------|------|--------|
| Hero headings, section titles | Playfair Display | 700-900 |
| UI text, cards, explanations | Inter | 400-800 |
| CED codes, stats, formulas | SFMono-Regular / Consolas | 600-700 |

## Motion System

Three intensity levels controlled by `--motion-level` CSS custom property:

| Level | Name | Behavior |
|-------|------|----------|
| 0 | Calm | No rAF loop, no parallax, no signal pulses, no particles. CSS animations disabled. |
| 1 | Standard | 30fps throttled rAF, moderate parallax, signal pulses, particles. |
| 2 | Cinematic | Full rAF rate, full parallax, all effects at maximum. |

`@media (prefers-reduced-motion: reduce)` forces Calm mode.

## Hero Depth System

4 SVG layers with CSS `perspective: 1200px`:

| Layer | Z-depth | Content |
|-------|---------|---------|
| 0 | -80px | Botanical vine network (deepest, least movement) |
| 1 | -40px | Brain silhouette + region labels |
| 2 | 0px | Neurons + axons + dendrites |
| 3 | +30px | Synapse pulses + concept labels (closest, most movement) |

Mouse/touch parallax applies `translate3d()` at different intensities per layer.

## Component Classes

| Class | Purpose |
|-------|---------|
| .editorial-heading | Playfair Display serif heading |
| .section-num | "01 / SECTION NAME" monospace label |
| .pull-quote | Italic serif quote with thin rules |
| .editorial-rule | Thin coral divider with diamond node |
| .rorschach | Abstract inkblot decorative shape |
| .iceberg-divider | Conscious/unconscious SVG divider |
| .reveal-on-scroll | Staggered entrance animation |
| .concept-node | Clickable brain concept label |
| .hero-depth-layer | Parallax depth layer |
| .particle-layer | Floating dust particles container |
| .motion-controls | Floating motion intensity panel |

## Files

| File | Purpose |
|------|---------|
| psyche_noir_theme.css | Editorial identity, grain, motion controls, animations |
| psyche_animations.js | Central rAF loop, parallax, signals, particles, scroll reveals |
| psych_styles.css | Base design system (unchanged) |
| neuro_visuals.js | 4-layer brain visual, unit pathway, interactive diagrams |
| psych_app.js | View routing, data rendering, event handling |
