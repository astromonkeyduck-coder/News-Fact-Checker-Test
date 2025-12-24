/**
 * Visual Effects Initialization
 * Deferred until idle or user interaction
 * Respects prefers-reduced-motion
 */

import { logger } from '../../utils/logger.js';
import { prefersReducedMotion, isMobile, deferInit } from './initCore.js';

let effectsInitialized = false;
let effectsEnabled = false;

/**
 * Check if effects should be enabled
 */
function shouldEnableEffects() {
  // Disable on mobile by default
  if (isMobile()) {
    return localStorage.getItem('noteworthy_effects_enabled') === 'true';
  }
  
  // Disable if user prefers reduced motion
  if (prefersReducedMotion()) {
    return false;
  }
  
  return true;
}

/**
 * Initialize matrix rain effect (deferred)
 */
function initMatrixRain() {
  const matrixContainer = document.querySelector('.matrix-rain');
  if (!matrixContainer || !effectsEnabled) return;
  
  logger.debug('Initializing matrix rain');
  
  const isMobileDevice = isMobile();
  const characters = '01█▓▒░';
  const numCharacters = isMobileDevice ? 15 : 150;
  
  matrixContainer.innerHTML = '';
  
  for (let i = 0; i < numCharacters; i++) {
    const character = document.createElement('div');
    character.textContent = characters[Math.floor(Math.random() * characters.length)];
    character.style.cssText = `
      position: absolute;
      top: -20px;
      left: ${Math.random() * 100}%;
      font-family: 'Courier New', monospace;
      font-size: ${isMobileDevice ? 12 : 16 + Math.random() * 8}px;
      color: #4A90E2;
      text-shadow: 0 0 8px #4A90E2;
      animation: hailFall ${3 + Math.random() * 2}s linear infinite;
      animation-delay: ${Math.random() * 3}s;
      opacity: ${0.3 + Math.random() * 0.3};
      z-index: 1;
      font-weight: bold;
      pointer-events: none;
    `;
    matrixContainer.appendChild(character);
  }
}

/**
 * Initialize particles effect (deferred)
 */
function initParticles() {
  const particlesContainer = document.getElementById('particles');
  if (!particlesContainer || !effectsEnabled) return;
  
  logger.debug('Initializing particles');
  
  const particleCount = isMobile() ? 20 : 50;
  particlesContainer.innerHTML = '';
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 6 + 's';
    particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
    particle.style.opacity = Math.random() * 0.3 + 0.1;
    particlesContainer.appendChild(particle);
  }
}

/**
 * Initialize all visual effects
 */
export function initEffects() {
  if (effectsInitialized) return;
  effectsInitialized = true;
  
  effectsEnabled = shouldEnableEffects();
  
  if (!effectsEnabled) {
    logger.debug('Effects disabled (mobile or reduced motion)');
    
    // Add toggle button for mobile users
    if (isMobile()) {
      addEffectsToggle();
    }
    return;
  }
  
  // Defer initialization until idle
  deferInit(() => {
    initMatrixRain();
    initParticles();
    logger.debug('Visual effects initialized');
  }, 1000);
}

/**
 * Add effects toggle for mobile users
 */
function addEffectsToggle() {
  // Check if toggle already exists
  if (document.getElementById('effectsToggle')) return;
  
  const toggle = document.createElement('button');
  toggle.id = 'effectsToggle';
  toggle.textContent = 'Enable Effects';
  toggle.className = 'effects-toggle';
  toggle.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 10px 16px;
    background: rgba(74, 144, 226, 0.2);
    border: 1px solid rgba(74, 144, 226, 0.4);
    color: #4A90E2;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
    z-index: 1000;
    font-family: 'Inter', sans-serif;
  `;
  
  toggle.addEventListener('click', () => {
    localStorage.setItem('noteworthy_effects_enabled', 'true');
    effectsEnabled = true;
    initMatrixRain();
    initParticles();
    toggle.remove();
  });
  
  document.body.appendChild(toggle);
}

// Export for manual initialization
export default { initEffects, shouldEnableEffects };

