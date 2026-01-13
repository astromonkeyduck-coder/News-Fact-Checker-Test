/**
 * Search Bar Component
 */

import { debounce } from '../../utils/debounce.js';

export class SearchBar {
  constructor(container, state, onSearch) {
    this.container = container;
    this.state = state;
    this.onSearch = onSearch;
    this.debouncedSearch = debounce(() => this.onSearch(), 300);
    
    this.render();
    this.attachEvents();
  }
  
  render() {
    this.container.innerHTML = `
      <div class="livecams-search-bar">
        <input 
          type="text" 
          id="livecams-search-input" 
          class="livecams-search-input" 
          placeholder="Search cameras by keyword, city, road..."
          value="${this.state.filters.q || ''}"
        />
        <button id="livecams-search-btn" class="livecams-search-btn" aria-label="Search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </button>
      </div>
    `;
  }
  
  attachEvents() {
    const input = this.container.querySelector('#livecams-search-input');
    const button = this.container.querySelector('#livecams-search-btn');
    
    input.addEventListener('input', (e) => {
      this.state.setFilters({ q: e.target.value });
      this.debouncedSearch();
    });
    
    button.addEventListener('click', () => {
      this.onSearch();
    });
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.onSearch();
      }
    });
  }
  
  getValue() {
    const input = this.container.querySelector('#livecams-search-input');
    return input?.value || '';
  }
}
