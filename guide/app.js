const DATA_URL = 'site-data.json';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

let SITE_DATA = null;
let SEARCH_QUERY = '';
let LEVELS_ENABLED = new Set(['beginner', 'intermediate', 'advanced']);

const LS_THEME_KEY = 'psg.theme';

function getTheme() {
  const t = localStorage.getItem(LS_THEME_KEY);
  if (t === 'dark' || t === 'light') return t;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(t) {
  if (t === 'dark') {
    document.documentElement.classList.add('dark');
    $('#themeToggle').textContent = '🌙';
  } else {
    document.documentElement.classList.remove('dark');
    $('#themeToggle').textContent = '🌞';
  }
  localStorage.setItem(LS_THEME_KEY, t);
}

function toggleTheme() {
  applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

function matchesSearch(action, q) {
  if (!q) return true;
  q = q.toLowerCase();
  if ((action.title || '').toLowerCase().includes(q)) return true;
  if ((action.why || '').toLowerCase().includes(q)) return true;
  for (const steps of Object.values(action.steps || {})) {
    for (const s of steps) {
      if (s.toLowerCase().includes(q)) return true;
    }
  }
  return false;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

function titleCasePlatform(key) {
  return key.replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
}

function renderAction(action) {
  const w = document.createElement('div');
  w.className = 'action';

  const lvl = (action.level || '').toLowerCase();
  const lvlClass = `level-${lvl}`;

  w.innerHTML = `
    <div class="level-tag ${lvlClass}">${lvl.toUpperCase()}</div>
    <h4>${escapeHtml(action.title)}</h4>
    <p>${escapeHtml(action.why || '')}</p>
  `;

  const stepsWrap = document.createElement('div');
  stepsWrap.className = 'steps-grid';

  for (const [platform, steps] of Object.entries(action.steps || {})) {
    const p = document.createElement('div');
    p.className = 'platform';
    p.innerHTML = `<h5>${escapeHtml(titleCasePlatform(platform))}</h5>`;
    const list = document.createElement('ol');

    steps.forEach(step => {
      const li = document.createElement('li');
      li.textContent = step;
      list.appendChild(li);
    });

    p.appendChild(list);
    stepsWrap.appendChild(p);
  }

  w.appendChild(stepsWrap);
  return w;
}

function renderCategory(cat) {
  const wrapper = document.createElement('div');
  wrapper.className = 'category';

  const details = document.createElement('details');

  const summary = document.createElement('summary');

  const left = document.createElement('span');
  left.className = 'summary-title';
  left.textContent = cat.title;

  const right = document.createElement('span');
  right.className = 'summary-right';

  const label = document.createElement('span');
  label.className = 'exp-label';
  label.textContent = 'Expand';

  const chev = document.createElement('span');
  chev.className = 'chev';
  chev.textContent = '›';

  right.appendChild(label);
  right.appendChild(chev);

  summary.appendChild(left);
  summary.appendChild(right);

  details.appendChild(summary);

  const content = document.createElement('div');
  content.className = 'details-content';

  const filtered = (cat.actions || []).filter(a =>
    LEVELS_ENABLED.has((a.level || '').toLowerCase()) && matchesSearch(a, SEARCH_QUERY)
  );

  if (!filtered.length) {
    content.innerHTML = `<div class="muted">No actions match.</div>`;
  } else {
    filtered.forEach(a => content.appendChild(renderAction(a)));
  }

  details.addEventListener('toggle', () => {
    label.textContent = details.open ? 'Collapse' : 'Expand';
  });

  details.appendChild(content);
  wrapper.appendChild(details);
  return wrapper;
}

function renderApp() {
  const app = $('#app');
  app.innerHTML = '';

  let catCount = 0;
  let actCount = 0;

  SITE_DATA.categories.forEach(cat => {
    const vis = (cat.actions || []).filter(a =>
      LEVELS_ENABLED.has((a.level || '').toLowerCase()) &&
      matchesSearch(a, SEARCH_QUERY)
    );
    if (vis.length) {
      catCount++;
      actCount += vis.length;
      app.appendChild(renderCategory(cat));
    }
  });

  $('#stats').textContent = `${catCount} categories • ${actCount} actions`;
  updateFilterStatus();
}

function updateFilterStatus() {
  const order = ['beginner','intermediate','advanced'];
  const active = order.filter(l => LEVELS_ENABLED.has(l)).map(s => s.toUpperCase());
  const hidden = order.filter(l => !LEVELS_ENABLED.has(l)).map(s => s.toUpperCase());

  const parts = [];
  if (active.length) parts.push(`Showing: ${active.join(' • ')}`);
  if (hidden.length) parts.push(`Hidden: ${hidden.join(' • ')}`);
  $('#filterStatus').textContent = parts.join('   ');
}

function debounce(fn, delay=200) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function bindControls() {
  const searchInput = $('#search');
  searchInput.addEventListener('input', debounce(() => {
    SEARCH_QUERY = searchInput.value.trim();
    renderApp();
  }, 200));

  $$('.level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pressed = btn.getAttribute('aria-pressed') === 'true';
      const next = !pressed;
      btn.setAttribute('aria-pressed', String(next));

      const level = btn.dataset.level;
      if (next) LEVELS_ENABLED.add(level);
      else LEVELS_ENABLED.delete(level);

      renderApp();
    });
  });

  $('#themeToggle').addEventListener('click', toggleTheme);
}

(async function boot() {
  applyTheme(getTheme());

  const res = await fetch(DATA_URL);
  if (!res.ok) {
    $('#app').innerHTML = `<div class="muted">Failed to load data: ${res.status} ${res.statusText}</div>`;
    return;
  }
  SITE_DATA = await res.json();

  bindControls();
  renderApp();
})();
