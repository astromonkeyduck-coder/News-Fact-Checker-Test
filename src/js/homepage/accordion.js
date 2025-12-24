/**
 * Accordion functionality for mobile
 * Collapses secondary sections on mobile devices
 */

import { logger } from '../../utils/logger.js';
import { isMobile } from './initCore.js';

let accordionsInitialized = false;

/**
 * Initialize accordions for secondary sections
 */
export function initAccordions() {
  if (accordionsInitialized) return;
  
  // Only enable on mobile
  if (!isMobile()) {
    logger.debug('Accordions disabled (desktop)');
    return;
  }
  
  const secondarySections = document.querySelectorAll('.secondary-section');
  
  if (secondarySections.length === 0) return;
  
  secondarySections.forEach(section => {
    setupAccordion(section);
  });
  
  accordionsInitialized = true;
  logger.debug(`Initialized ${secondarySections.length} accordions`);
}

/**
 * Setup accordion for a section
 */
function setupAccordion(section) {
  // Check if already set up
  if (section.dataset.accordionSetup === 'true') return;
  
  // Find or create toggle button
  let toggle = section.querySelector('.section-toggle');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.className = 'section-toggle';
    toggle.type = 'button';
    
    // Get section title
    const title = section.querySelector('h2, h3, .section-title');
    const titleText = title ? title.textContent : 'Section';
    toggle.textContent = titleText;
    
    // Insert before section content
    const content = section.querySelector('.section-content') || section;
    section.insertBefore(toggle, content);
  }
  
  // Mark content for collapsing
  const content = section.querySelector('.section-content') || section.querySelector('.section-body');
  if (content) {
    content.classList.add('accordion-content');
  }
  
  // Set initial state (collapsed on mobile)
  if (isMobile()) {
    section.classList.add('collapsed');
    toggle.classList.add('collapsed');
    if (content) {
      content.style.display = 'none';
    }
  }
  
  // Add click handler
  toggle.addEventListener('click', () => {
    const isCollapsed = section.classList.contains('collapsed');
    
    if (isCollapsed) {
      // Expand
      section.classList.remove('collapsed');
      toggle.classList.remove('collapsed');
      toggle.classList.add('expanded');
      if (content) {
        content.style.display = '';
      }
      logger.debug('Accordion expanded:', titleText);
    } else {
      // Collapse
      section.classList.add('collapsed');
      toggle.classList.add('collapsed');
      toggle.classList.remove('expanded');
      if (content) {
        content.style.display = 'none';
      }
      logger.debug('Accordion collapsed:', titleText);
    }
  });
  
  // Mark as set up
  section.dataset.accordionSetup = 'true';
}

/**
 * Auto-detect and setup accordions for common section patterns
 */
export function autoSetupAccordions() {
  if (!isMobile()) return;
  
  // Find sections that should be accordions
  const selectors = [
    '.spotlight-section',
    '.games-section',
    '.about-section',
    '.features-section',
    '[data-accordion="true"]'
  ];
  
  selectors.forEach(selector => {
    const sections = document.querySelectorAll(selector);
    sections.forEach(section => {
      // Only if not already a secondary-section
      if (!section.classList.contains('secondary-section')) {
        section.classList.add('secondary-section');
      }
      setupAccordion(section);
    });
  });
}

export default { initAccordions, autoSetupAccordions };

