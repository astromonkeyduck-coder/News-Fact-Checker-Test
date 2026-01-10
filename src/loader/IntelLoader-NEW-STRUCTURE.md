# Intel Loader - New Visual Structure

## Layout Overview (Asymmetric, High Density)

```
┌─────────────────────────────────────────────────────────────────┐
│ [NOTEWORTHY NEWS // INTEL MONITOR]    [02:13 UTC] [SECURE]    │ ← Top bar (fixed)
│                                                                 │
│ [MAP ENGINE]        ████████░░ 78%                              │
│ [FEED INGEST]       ██████████ 92%                              │ ← Left column
│ [GEO INDEX]         ██████░░░░ 65%                              │   (subsystems)
│ [RENDER PIPELINE]   ███████░░░ 71%                             │
│                                                                 │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ AUTHENTICATING SESSION...                                  │  │
│ │ > HANDSHAKE OK                                             │  │ ← Integrated text
│ │ > VERIFYING CREDENTIALS...                                 │  │   (no box)
│ │ > ACCESS GRANTED                                           │  │
│ │                                                            │  │
│ │ PULLING RSS SIGNALS...                                     │  │
│ │ > DECRYPTING FEED STREAMS...                               │  │
│ │ > NORMALIZING FEED ITEMS...                                │  │
│ │                                                            │  │
│ │ GEOCODING EVENTS...                                        │  │
│ │ > CLASSIFYING SEVERITY...                                  │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│                    [OFF-CENTER ORB]                              │
│                    (4+ layers of motion)                        │
│                                                                 │
│ [LAT: 40.7128] [LON: -74.0060] [SIG: 127] [UPTIME: 00:02:13]  │ ← Bottom HUD
└─────────────────────────────────────────────────────────────────┘
```

## Core Orb Structure (4+ Layers)

1. **Outer Segmented Ring** (slowest, 360° rotation, 60s period)
   - 12 segments, alternating opacity
   - Each segment pulses independently

2. **Middle Scan Ring** (medium, 360° rotation, 30s period, opposite direction)
   - Continuous ring with scanning sweep
   - Bright spot that travels around

3. **Inner Data Ring** (fast, 360° rotation, 15s period)
   - 8 orbiting data points (small dots)
   - Each dot pulses when "active"

4. **Core Center** (pulsing, breathing)
   - Central dot with radial glow
   - Pulsing at 2s intervals
   - Subtle rotation (very slow, 120s period)

5. **Scan Sweeps** (independent)
   - 2-3 radial scan lines rotating at different speeds
   - Each sweep has different opacity and speed

## Subsystem Progress Indicators

Each subsystem has:
- Label (monospaced, left-aligned)
- Progress bar (segmented, 10 segments)
- Percentage (right-aligned, monospaced)
- Status indicator (small dot: green=active, yellow=waiting, red=error)

Subsystems:
- MAP ENGINE
- FEED INGEST
- GEO INDEX
- RENDER PIPELINE

## Integrated Text System

- No boxed terminal
- Text flows naturally on the left side
- Fixed labels (like "STATUS:", ">") stay in place
- Dynamic content scrolls/updates
- Monospaced font throughout
- Multiple text streams can run in parallel

## Asymmetric Layout

- Core orb positioned at: `left: 60%` (not centered)
- Left column (subsystems + text) takes 40% width
- Right side has more negative space but is filled with HUD elements
- Bottom HUD spans full width with multiple data points

## HUD Elements

Top bar:
- Left: "NOTEWORTHY NEWS // INTEL MONITOR"
- Right: UTC time, security status

Bottom bar:
- LAT/LON coordinates (animated)
- Signal strength
- Uptime counter
- System status

## Color Scheme

- Primary: Cyan (#22d3ee)
- Secondary: Blue (#4A90E2)
- Accent: Red (#ff6b6b) for critical/errors
- Background: Very dark navy (#010510)
- Text: White with varying opacity

## Motion Principles

- Everything moves, but slowly
- Layers move at different speeds (creates depth)
- No idle elements
- All motion is purposeful (not decorative)
- Reduced motion support: all animations disabled, static state shown
