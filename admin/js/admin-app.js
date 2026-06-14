/**
 * Admin App — Noteworthy News
 *
 * Section router, navigation binding, shell orchestration.
 */

import { initAdminAuth, logout } from './admin-auth.js';

const SECTIONS = {
  posts:       () => import('./views/posts.js'),
  'live-stories': () => import('./views/live-stories.js'),
  ingestion:   () => import('./views/ingestion.js'),
  newsletter:  () => import('./views/newsletter.js'),
  watermarker: () => import('./views/watermarker.js'),
  analytics:   () => import('./views/analytics.js'),
  system:      () => import('./views/system.js'),
};

const DEFAULT_SECTION = 'posts';
let currentSection = null;

export async function boot() {
  const result = await initAdminAuth();
  if (!result) return; // auth screen is showing

  const { user } = result;

  // Show admin shell
  document.getElementById('admin-auth-screen').style.display = 'none';
  const shell = document.getElementById('admin-shell');
  shell.classList.add('active');

  // Set user info
  const label = document.getElementById('admin-user-label');
  if (label) label.textContent = user.email || user.nickname || user.name || 'Admin';

  // Logout button
  document.getElementById('admin-logout-btn')?.addEventListener('click', async () => {
    await logout();
  });

  // Mobile menu toggle
  const menuBtn = document.getElementById('admin-mobile-menu');
  const sidebar = document.getElementById('admin-sidebar');
  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
  }

  // Nav binding
  document.querySelectorAll('.admin-nav-item[data-section]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      window.location.hash = section;
    });
  });

  // Hash routing
  window.addEventListener('hashchange', () => navigate(getSection()));
  navigate(getSection());
}

function getSection() {
  // Hash takes precedence (in-app nav uses hashes).
  const hash = window.location.hash.replace('#', '');
  if (SECTIONS[hash]) return hash;

  // Support clean deep links like /admin/watermarker.
  const pathSeg = window.location.pathname.replace(/\/+$/, '').split('/').pop();
  if (SECTIONS[pathSeg]) return pathSeg;

  return DEFAULT_SECTION;
}

async function navigate(section) {
  if (section === currentSection) return;
  currentSection = section;

  // Update nav state
  document.querySelectorAll('.admin-nav-item[data-section]').forEach(item => {
    item.classList.toggle('active', item.dataset.section === section);
  });

  // Close mobile sidebar
  document.getElementById('admin-sidebar')?.classList.remove('mobile-open');

  // Load view
  const main = document.getElementById('admin-main');
  main.innerHTML = '<div class="admin-loading">Loading\u2026</div>';

  try {
    const loader = SECTIONS[section];
    if (!loader) {
      main.innerHTML = '<div class="admin-notice admin-notice-error">Unknown section.</div>';
      return;
    }
    const mod = await loader();
    main.innerHTML = '';
    mod.render(main);
  } catch (err) {
    main.innerHTML = `<div class="admin-notice admin-notice-error">Failed to load section: ${err.message}</div>`;
    console.error('[Admin]', err);
  }
}
