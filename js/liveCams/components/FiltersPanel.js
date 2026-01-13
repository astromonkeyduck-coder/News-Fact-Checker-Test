/**
 * Filters Panel Component
 */

export class FiltersPanel {
  constructor(container, state, onFilterChange) {
    this.container = container;
    this.state = state;
    this.onFilterChange = onFilterChange;
    
    this.render();
    this.attachEvents();
  }
  
  render() {
    const { filters } = this.state;
    
    this.container.innerHTML = `
      <div class="livecams-filters">
        <div class="livecams-filter-group">
          <label>Country</label>
          <select id="livecams-filter-country" class="livecams-select">
            <option value="US" ${filters.country === 'US' ? 'selected' : ''}>United States</option>
            <option value="UA" ${filters.country === 'UA' ? 'selected' : ''}>Ukraine</option>
            <option value="IL" ${filters.country === 'IL' ? 'selected' : ''}>Israel</option>
            <option value="GB" ${filters.country === 'GB' ? 'selected' : ''}>United Kingdom</option>
            <option value="CA" ${filters.country === 'CA' ? 'selected' : ''}>Canada</option>
            <option value="AU" ${filters.country === 'AU' ? 'selected' : ''}>Australia</option>
            <option value="" ${!filters.country ? 'selected' : ''}>Any</option>
          </select>
        </div>
        
        ${filters.country === 'US' ? `
          <div class="livecams-filter-group">
            <label>State</label>
            <select id="livecams-filter-state" class="livecams-select">
              <option value="">Any</option>
              <option value="FL" ${filters.state === 'FL' ? 'selected' : ''}>Florida</option>
              <option value="NY" ${filters.state === 'NY' ? 'selected' : ''}>New York</option>
              <option value="CA" ${filters.state === 'CA' ? 'selected' : ''}>California</option>
              <option value="TX" ${filters.state === 'TX' ? 'selected' : ''}>Texas</option>
            </select>
          </div>
        ` : ''}
        
        <div class="livecams-filter-group">
          <label>City</label>
          <input 
            type="text" 
            id="livecams-filter-city" 
            class="livecams-input" 
            placeholder="City name..."
            value="${filters.city || ''}"
          />
        </div>
        
        <div class="livecams-filter-group">
          <label>Type</label>
          <div class="livecams-filter-chips">
            <button class="livecams-chip ${filters.type === 'any' ? 'active' : ''}" data-type="any">Any</button>
            <button class="livecams-chip ${filters.type === 'dot_traffic' ? 'active' : ''}" data-type="dot_traffic">🚦 DOT Traffic</button>
            <button class="livecams-chip ${filters.type === 'city_street' ? 'active' : ''}" data-type="city_street">🏙️ Street</button>
            <button class="livecams-chip ${filters.type === 'scenic' ? 'active' : ''}" data-type="scenic">🌄 Scenic</button>
          </div>
        </div>
        
        <div class="livecams-filter-group">
          <label>Media</label>
          <div class="livecams-filter-chips">
            <button class="livecams-chip ${filters.media === 'any' ? 'active' : ''}" data-media="any">Any</button>
            <button class="livecams-chip ${filters.media === 'live' ? 'active' : ''}" data-media="live">🔴 Live Only</button>
            <button class="livecams-chip ${filters.media === 'snapshot' ? 'active' : ''}" data-media="snapshot">📸 Snapshots OK</button>
          </div>
        </div>
      </div>
    `;
  }
  
  attachEvents() {
    const country = this.container.querySelector('#livecams-filter-country');
    const state = this.container.querySelector('#livecams-filter-state');
    const city = this.container.querySelector('#livecams-filter-city');
    const typeChips = this.container.querySelectorAll('[data-type]');
    const mediaChips = this.container.querySelectorAll('[data-media]');
    
    if (country) {
      country.addEventListener('change', (e) => {
        this.state.setFilters({ country: e.target.value || null, state: '' });
        this.render(); // Re-render to show/hide state dropdown
        this.attachEvents();
        this.onFilterChange();
      });
    }
    
    if (state) {
      state.addEventListener('change', (e) => {
        this.state.setFilters({ state: e.target.value || null });
        this.onFilterChange();
      });
    }
    
    if (city) {
      city.addEventListener('input', (e) => {
        this.state.setFilters({ city: e.target.value || null });
        this.onFilterChange();
      });
    }
    
    typeChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const type = chip.dataset.type;
        this.state.setFilters({ type });
        this.render();
        this.attachEvents();
        this.onFilterChange();
      });
    });
    
    mediaChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const media = chip.dataset.media;
        this.state.setFilters({ media });
        this.render();
        this.attachEvents();
        this.onFilterChange();
      });
    });
  }
}
