/**
 * Live lock-screen mockup: reflects the visitor's time, date, location, and weather.
 * Battery is live where the browser exposes it; otherwise a static iOS-style icon is shown.
 */

import { UISounds } from './ui-sounds.js';

const BATTERY_FILL_MAX = 19;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ALERT_SEVERITIES = new Set(['extreme', 'severe', 'moderate']);

export function initPhoneStage() {
  const timeEl = document.getElementById('stage-time');
  const dateEl = document.getElementById('stage-date');
  const locationEl = document.getElementById('stage-location');
  const batteryEl = document.getElementById('stage-battery');
  const batteryLevelEl = document.getElementById('stage-battery-level');
  const batteryFillEl = document.getElementById('stage-battery-fill');

  if (!timeEl || !dateEl) return;

  const timeFmt = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  const dateFmt = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  function tickClock() {
    const now = new Date();
    // iOS lock screen clock shows no AM/PM suffix.
    const parts = timeFmt.formatToParts(now);
    const hour = parts.find((p) => p.type === 'hour');
    const minute = parts.find((p) => p.type === 'minute');
    timeEl.textContent = hour && minute ? `${hour.value}:${minute.value}` : timeFmt.format(now);
    dateEl.textContent = dateFmt.format(now);
  }

  tickClock();
  setInterval(tickClock, 1000);

  initBattery(batteryEl, batteryLevelEl, batteryFillEl);
  initWeather(locationEl);
  initFlashlight();
}

function initFlashlight() {
  const btn = document.getElementById('stage-flashlight');
  const scene = document.querySelector('.stage-scene');
  if (!btn || !scene) return;

  btn.addEventListener('click', () => {
    const on = scene.classList.toggle('torch-on');
    UISounds.flashlight(on);
  });
}

function setBatteryLevel(wrap, levelEl, fillEl, pct, { live = false, charging = false } = {}) {
  fillEl.setAttribute('width', String(Math.max(0, (BATTERY_FILL_MAX * pct) / 100)));
  wrap.classList.toggle('stage-battery--charging', charging);
  wrap.classList.toggle('stage-battery--illustrative', !live);

  if (live) {
    levelEl.textContent = `${pct}%`;
    levelEl.hidden = false;
  } else {
    levelEl.textContent = '';
    levelEl.hidden = true;
  }

  wrap.hidden = false;
}

function initBattery(wrap, levelEl, fillEl) {
  if (!wrap || !levelEl || !fillEl) return;

  if ('getBattery' in navigator) {
    navigator.getBattery().then((battery) => {
      const update = () => {
        setBatteryLevel(wrap, levelEl, fillEl, Math.round(battery.level * 100), {
          live: true,
          charging: battery.charging,
        });
      };

      update();
      battery.addEventListener('levelchange', update);
      battery.addEventListener('chargingchange', update);
    }).catch(() => {
      setBatteryLevel(wrap, levelEl, fillEl, 88);
    });
    return;
  }

  // Safari / iOS: no Battery Status API - show icon only, no fake percentage.
  setBatteryLevel(wrap, levelEl, fillEl, 88);
}

async function initWeather(locationEl) {
  const geo = await fetchGeoFromIP();
  if (!geo) return;

  if (geo.label && locationEl) {
    locationEl.textContent = geo.label;
    locationEl.hidden = false;
  }

  if (geo.lat == null || geo.lon == null) return;

  const current = await fetchCurrentWeather(geo.lat, geo.lon, geo.useFahrenheit);
  if (current) {
    renderWeatherWidget(current);
    applyWeatherEffects(current.type);
  }

  if (geo.countryCode === 'US') {
    const alert = await fetchLocalAlert(geo);
    if (alert) renderWeatherAlert(alert);
  }
}

async function fetchGeoFromIP() {
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const data = await res.json();
      const label = formatIpLocation(data);
      if (label || data.latitude != null) {
        return {
          label,
          lat: data.latitude,
          lon: data.longitude,
          city: data.city,
          region: data.region,
          regionCode: data.region_code,
          countryCode: data.country_code,
          useFahrenheit: data.country_code === 'US',
        };
      }
    }
  } catch {
    /* try fallback */
  }

  try {
    const res = await fetch('https://ip-api.com/json/?fields=status,city,regionName,region,country,countryCode,lat,lon');
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success') {
        return {
          label: formatIpLocation({
            city: data.city,
            region: data.regionName,
            country_name: data.country,
          }),
          lat: data.lat,
          lon: data.lon,
          city: data.city,
          region: data.regionName,
          regionCode: data.region,
          countryCode: data.countryCode,
          useFahrenheit: data.countryCode === 'US',
        };
      }
    }
  } catch {
    /* no location */
  }

  return null;
}

async function fetchCurrentWeather(lat, lon, useFahrenheit) {
  const unit = useFahrenheit ? 'fahrenheit' : 'celsius';
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&temperature_unit=${unit}&timezone=auto`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const current = data.current;
    if (!current) return null;

    const mapped = mapWeatherCode(current.weather_code, current.is_day === 1);
    return {
      temp: Math.round(current.temperature_2m),
      unit: useFahrenheit ? 'F' : 'C',
      ...mapped,
    };
  } catch {
    return null;
  }
}

async function fetchLocalAlert(geo) {
  try {
    const res = await fetch('/.netlify/functions/weatherProxy?type=alerts');
    if (!res.ok) return null;
    const data = await res.json();
    const features = data.features || [];
    const needles = [geo.city, geo.region, geo.regionCode].filter(Boolean).map(normalizeAreaToken);

    const matches = features
      .map((feature) => feature.properties || {})
      .filter((props) => ALERT_SEVERITIES.has(String(props.severity || '').toLowerCase()))
      .filter((props) => alertMatchesArea(props.areaDesc, needles))
      .sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

    const top = matches[0];
    if (!top) return null;

    return {
      event: top.event || 'Weather alert',
      headline: top.headline || '',
      severity: top.severity || 'unknown',
      expires: top.expires || '',
      areas: top.areaDesc || '',
    };
  } catch {
    return null;
  }
}

function renderWeatherWidget({ temp, unit, type, label }) {
  const wrap = document.getElementById('stage-weather');
  const iconEl = document.getElementById('stage-weather-icon');
  const tempEl = document.getElementById('stage-weather-temp');
  const labelEl = document.getElementById('stage-weather-label');
  if (!wrap || !iconEl || !tempEl || !labelEl) return;

  iconEl.innerHTML = weatherIconSvg(type);
  iconEl.dataset.weather = type;
  tempEl.textContent = `${temp}°${unit === 'F' ? '' : 'C'}`;
  labelEl.textContent = label;
  wrap.hidden = false;
}

function renderWeatherAlert(alert) {
  const card = document.getElementById('stage-weather-card');
  const iconEl = document.getElementById('stage-weather-alert-icon');
  const titleEl = document.getElementById('stage-weather-title');
  const textEl = document.getElementById('stage-weather-text');
  const whenEl = document.getElementById('stage-weather-when');
  if (!card || !iconEl || !titleEl || !textEl) return;

  const alertType = alertTypeFromEvent(alert.event);
  iconEl.innerHTML = weatherIconSvg(alertType, { alert: true });
  titleEl.textContent = alert.event;
  textEl.textContent = formatAlertBody(alert);
  if (whenEl) whenEl.textContent = 'now';

  card.dataset.severity = String(alert.severity || '').toLowerCase();
  card.hidden = false;
}

function applyWeatherEffects(type) {
  const screen = document.querySelector('.stage-screen');
  const fx = document.getElementById('stage-weather-fx');
  if (!screen || !fx) return;

  screen.dataset.weather = type;
  fx.hidden = false;
  fx.innerHTML = weatherFxMarkup(type);

  if (REDUCED_MOTION) {
    fx.classList.add('stage-weather-fx--static');
  }
}

function mapWeatherCode(code, isDay) {
  if (code === 0) {
    return { type: isDay ? 'clear' : 'clear-night', label: isDay ? 'Clear' : 'Clear' };
  }
  if (code === 1) return { type: isDay ? 'partly-cloudy' : 'partly-cloudy-night', label: 'Mostly clear' };
  if (code === 2) return { type: 'partly-cloudy', label: 'Partly cloudy' };
  if (code === 3) return { type: 'cloudy', label: 'Overcast' };
  if (code === 45 || code === 48) return { type: 'fog', label: 'Foggy' };
  if (code >= 51 && code <= 55) return { type: 'drizzle', label: 'Drizzle' };
  if (code >= 61 && code <= 67) return { type: 'rain', label: 'Rain' };
  if (code >= 71 && code <= 77) return { type: 'snow', label: 'Snow' };
  if (code >= 80 && code <= 82) return { type: 'rain', label: 'Showers' };
  if (code >= 85 && code <= 86) return { type: 'snow', label: 'Snow showers' };
  if (code >= 95) return { type: 'thunderstorm', label: 'Thunderstorms' };
  return { type: 'cloudy', label: 'Cloudy' };
}

function alertTypeFromEvent(event) {
  const text = String(event || '').toLowerCase();
  if (text.includes('tornado') || text.includes('thunder') || text.includes('lightning')) return 'thunderstorm';
  if (text.includes('snow') || text.includes('blizzard') || text.includes('ice')) return 'snow';
  if (text.includes('fog')) return 'fog';
  if (text.includes('flood') || text.includes('rain') || text.includes('storm')) return 'rain';
  return 'rain';
}

function weatherIconSvg(type, { alert = false } = {}) {
  const accent = alert ? '#FBBF24' : 'currentColor';
  const sun = alert ? '#FBBF24' : '#FACC15';

  switch (type) {
    case 'clear':
      return `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="9" fill="${sun}"/><g stroke="${sun}" stroke-width="2.2" stroke-linecap="round"><path d="M24 5.5v5.2"/><path d="M24 37.3v5.2"/><path d="M5.5 24h5.2"/><path d="M37.3 24h5.2"/><path d="M11.1 11.1l3.7 3.7"/><path d="M33.2 33.2l3.7 3.7"/><path d="M11.1 36.9l3.7-3.7"/><path d="M33.2 14.8l3.7-3.7"/></g></svg>`;
    case 'clear-night':
      return `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M28.5 8.2a13.8 13.8 0 1 0 11.3 22.3 11.2 11.2 0 0 1-11.3-22.3Z" fill="#BFDBFE" stroke="#E0F2FE" stroke-width="1.2"/></svg>`;
    case 'partly-cloudy':
      return `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="17" cy="17" r="6.5" fill="${sun}"/><path d="M14 34h20a8.5 8.5 0 0 0 .4-17 10 10 0 0 0-19.2 3.1A6.8 6.8 0 0 0 14 34Z" fill="#CBD5E1" stroke="#E2E8F0" stroke-width="1.2"/></svg>`;
    case 'partly-cloudy-night':
      return `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M16 12.5a10.5 10.5 0 0 0 8.6 17 8.5 8.5 0 0 1-8.6-17Z" fill="#BFDBFE"/><path d="M14 34h20a8.5 8.5 0 0 0 .4-17 10 10 0 0 0-19.2 3.1A6.8 6.8 0 0 0 14 34Z" fill="#94A3B8" stroke="#CBD5E1" stroke-width="1.2"/></svg>`;
    case 'cloudy':
      return `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M12 33h24a9 9 0 0 0 .5-18 10.5 10.5 0 0 0-20.4 3.3A7.2 7.2 0 0 0 12 33Z" fill="#CBD5E1" stroke="#E2E8F0" stroke-width="1.2"/><path d="M8 28h18a6.5 6.5 0 0 0 .3-13 8 8 0 0 0-15.5 2.5A5.2 5.2 0 0 0 8 28Z" fill="#94A3B8" opacity="0.85"/></svg>`;
    case 'fog':
      return `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M10 18h28a7.5 7.5 0 0 0 .4-15 9 9 0 0 0-17.3 2.8A6 6 0 0 0 10 18Z" fill="#CBD5E1"/><path d="M8 27h32" stroke="#E2E8F0" stroke-width="2.4" stroke-linecap="round" opacity="0.9"/><path d="M12 33h28" stroke="#CBD5E1" stroke-width="2.4" stroke-linecap="round" opacity="0.75"/><path d="M10 39h30" stroke="#94A3B8" stroke-width="2.4" stroke-linecap="round" opacity="0.55"/></svg>`;
    case 'drizzle':
      return `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M11 24h26a8 8 0 0 0 .4-16 9.5 9.5 0 0 0-18.4 3A6.5 6.5 0 0 0 11 24Z" fill="#CBD5E1" stroke="#E2E8F0" stroke-width="1.2"/><g stroke="${accent}" stroke-width="2" stroke-linecap="round"><path d="M16 30v5"/><path d="M24 32v5"/><path d="M32 30v5"/></g></svg>`;
    case 'rain':
      return `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M10 22h28a8.5 8.5 0 0 0 .5-17 10 10 0 0 0-19.2 3.1A6.8 6.8 0 0 0 10 22Z" fill="#94A3B8" stroke="#CBD5E1" stroke-width="1.2"/><g stroke="#7DD3FC" stroke-width="2.2" stroke-linecap="round"><path d="M15 29l-2.5 7"/><path d="M24 30l-2.5 7"/><path d="M33 29l-2.5 7"/></g></svg>`;
    case 'snow':
      return `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M11 22h26a8 8 0 0 0 .4-16 9.5 9.5 0 0 0-18.4 3A6.5 6.5 0 0 0 11 22Z" fill="#CBD5E1" stroke="#E2E8F0" stroke-width="1.2"/><g stroke="#E0F2FE" stroke-width="1.8" stroke-linecap="round"><path d="M16 30v6"/><path d="M13.5 33h5"/><path d="M24 31v6"/><path d="M21.5 34h5"/><path d="M32 30v6"/><path d="M29.5 33h5"/></g></svg>`;
    case 'thunderstorm':
      return `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M9 22h30a9 9 0 0 0 .5-18 10.5 10.5 0 0 0-20.4 3.3A7.2 7.2 0 0 0 9 22Z" fill="#64748B" stroke="#94A3B8" stroke-width="1.2"/><path d="M27 24.5 22 33.5h4.5L21 42.5l8.5-10.5H25l2-7.5Z" fill="${accent}" stroke="#FDE68A" stroke-width="0.8" stroke-linejoin="round"/></svg>`;
    default:
      return weatherIconSvg('cloudy', { alert });
  }
}

function weatherFxMarkup(type) {
  if (type === 'rain' || type === 'drizzle') {
    return Array.from({ length: 14 }, (_, i) => `<span class="stage-rain-drop" style="--i:${i}"></span>`).join('');
  }
  if (type === 'snow') {
    return Array.from({ length: 18 }, (_, i) => `<span class="stage-snow-flake" style="--i:${i}"></span>`).join('');
  }
  if (type === 'thunderstorm') {
    return '<span class="stage-lightning-flash"></span>' +
      Array.from({ length: 10 }, (_, i) => `<span class="stage-rain-drop stage-rain-drop--heavy" style="--i:${i}"></span>`).join('');
  }
  if (type === 'clear' || type === 'partly-cloudy') {
    return '<span class="stage-sun-glow"></span>';
  }
  if (type === 'fog') {
    return '<span class="stage-fog-layer"></span><span class="stage-fog-layer stage-fog-layer--back"></span>';
  }
  return '';
}

function formatAlertBody(alert) {
  const expires = formatAlertExpiry(alert.expires);
  if (alert.headline) {
    const trimmed = alert.headline.replace(/^.*?:\s*/i, '').trim();
    if (trimmed && trimmed.length <= 120) {
      return expires ? `${trimmed} ${expires}` : trimmed;
    }
  }
  return expires || 'Active alert for your area.';
}

function formatAlertExpiry(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `until ${time}.`;
}

function alertMatchesArea(areaDesc, needles) {
  if (!areaDesc || !needles.length) return false;
  const haystack = normalizeAreaToken(areaDesc);
  return needles.some((needle) => needle.length > 2 && haystack.includes(needle));
}

function normalizeAreaToken(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function severityRank(severity) {
  const order = { extreme: 0, severe: 1, moderate: 2, minor: 3, unknown: 4 };
  return order[String(severity || '').toLowerCase()] ?? 4;
}

function formatIpLocation(data) {
  const city = data.city;
  const region = data.region || data.region_name || data.regionName;
  const country = data.country_name || data.country;

  if (city && region) return `${city}, ${region}`;
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (region && country) return `${region}, ${country}`;
  if (region) return region;
  if (country) return country;
  return null;
}
