/**
 * Live lock-screen mockup: reflects the visitor's time, date, and approximate location.
 * Battery is live where the browser exposes it; otherwise a static iOS-style icon is shown.
 */

import { UISounds } from './ui-sounds.js';

const BATTERY_FILL_MAX = 19;

export function initPhoneStage() {
  const timeEl = document.getElementById('stage-time');
  const dateEl = document.getElementById('stage-date');
  const locationEl = document.getElementById('stage-location');
  const batteryEl = document.getElementById('stage-battery');
  const batteryLevelEl = document.getElementById('stage-battery-level');
  const batteryFillEl = document.getElementById('stage-battery-fill');
  const weatherAreaEl = document.querySelector('[data-stage-weather-area]');

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
  initLocation(locationEl, weatherAreaEl);
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

function initLocation(locationEl, weatherAreaEl) {
  if (!locationEl) return;

  fetchLocationFromIP().then((label) => {
    if (!label) return;
    locationEl.textContent = label;
    locationEl.hidden = false;
    if (weatherAreaEl) {
      weatherAreaEl.textContent = `Severe weather alert for ${label}`;
    }
  });
}

async function fetchLocationFromIP() {
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const data = await res.json();
      const label = formatIpLocation(data);
      if (label) return label;
    }
  } catch {
    /* try fallback */
  }

  try {
    const res = await fetch('https://ip-api.com/json/?fields=status,city,regionName,country');
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success') {
        return formatIpLocation({
          city: data.city,
          region: data.regionName,
          country_name: data.country,
        });
      }
    }
  } catch {
    /* no location */
  }

  return null;
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
