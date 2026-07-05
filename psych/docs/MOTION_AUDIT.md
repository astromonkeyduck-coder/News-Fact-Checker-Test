# Motion Audit - Psyche Noir Editorial

## Motion Levels

### Calm (--motion-level: 0)
- [ ] rAF loop: OFF
- [ ] Mouse parallax: OFF
- [ ] Signal pulses: OFF
- [ ] Particles: hidden
- [ ] Scroll reveal: items visible immediately (no animation)
- [ ] Synapse CSS pulse: OFF
- [ ] Neuron glow: OFF
- [ ] Grain overlay: reduced (2%)

### Standard (--motion-level: 1)
- [ ] rAF loop: ON at 30fps
- [ ] Mouse parallax: 60% intensity
- [ ] Signal pulses: one every 3s on random axon
- [ ] Particles: 20 drifting slowly
- [ ] Scroll reveal: staggered fade-slide-up
- [ ] Synapse CSS pulse: ON
- [ ] Unit pathway signal: travels Unit 1-5 every 8s
- [ ] Grain overlay: 3%

### Cinematic (--motion-level: 2)
- [ ] rAF loop: ON at full framerate
- [ ] Mouse parallax: 100% intensity
- [ ] Signal pulses: full effect
- [ ] Particles: 20 at full opacity
- [ ] Scroll reveal: staggered with spring easing
- [ ] All CSS animations: ON
- [ ] Grain overlay: 3%

## Reduced Motion (@media prefers-reduced-motion)
Forces Calm mode. All animation disabled. Content fully visible and functional.

## Performance Guardrails
- Single rAF loop for all continuous animation
- Loop pauses when hero is not visible (IntersectionObserver)
- Particle count capped at 20
- SVG glow filter limited to hero area
- Grain uses tiled 150px SVG, not computed filter
- No continuous DOM writes outside rAF
