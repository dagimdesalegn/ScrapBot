const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const state = {
  profile: {},
  semesters: [],
  allData: null,
};

function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = `msg ${type}`;
  el.textContent = msg;
  el.style.position = 'fixed'; el.style.bottom = '20px'; el.style.right = '20px';
  el.style.zIndex = '1000'; el.style.maxWidth = '360px'; el.style.boxShadow = '0 10px 40px rgba(0,0,0,.4)';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

async function api(path, opts = {}) {
  const r = await fetch(path, { credentials: 'same-origin', ...opts });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) { showLogin(); throw new Error(data.error || 'Session expired'); }
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

function showLogin() { $('#loginView').classList.remove('hidden'); $('#appView').classList.add('hidden'); }

function showApp() {
  $('#loginView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
  const p = state.profile;
  const name = p['Full Name'] || p['Name'] || 'Student';
  $('#uName').textContent = name;
  $('#avatar').textContent = (name[0] || '?').toUpperCase();
  $('#uMeta').textContent = [p['ID Number'], p['Program']].filter(Boolean).join(' • ');
}

// ——— Login ———
$('#loginBtn').addEventListener('click', async () => {
  const btn = $('#loginBtn'), msg = $('#loginMsg');
  btn.disabled = true; msg.classList.add('hidden');
  try {
    const data = await api('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: $('#u').value.trim(), password: $('#p').value }),
    });
    state.profile = data.profile || {};
    state.semesters = data.semesters || [];
    showApp();
    renderYears();
    renderProfile();
    prefetchAll(); // background warm-up
  } catch (e) {
    msg.textContent = '❌ ' + e.message;
    msg.classList.remove('hidden');
  } finally { btn.disabled = false; }
});

$('#logoutBtn').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST' }); } catch {}
  state.profile = {}; state.semesters = []; state.allData = null;
  sessionStorage.clear();
  showLogin();
});

$('#transcriptBtn').addEventListener('click', () => window.open('/transcript.html', '_blank'));

// ——— Tabs ———
$$('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => {
  $$('.tabs [data-tab]').forEach(x => x.classList.toggle('active', x === b));
  ['Grades', 'Gpa', 'Profile'].forEach(t => $('#tab' + t).classList.toggle('hidden', t.toLowerCase() !== b.dataset.tab));
  if (b.dataset.tab === 'gpa') loadGPA();
}));

// ——— Grades ———
function renderYears() {
  const years = [...new Set(state.semesters.map(s => s.year))].sort().reverse();
  const box = $('#yearsList'); box.innerHTML = '';
  $('#semestersList').classList.add('hidden');
  $('#courseList').classList.add('hidden');
  if (!years.length) { box.innerHTML = '<p class="sub">No semesters found.</p>'; return; }
  years.forEach(y => {
    const t = document.createElement('div'); t.className = 'tile';
    const count = state.semesters.filter(s => s.year === y).length;
    t.innerHTML = `<h3>📚 Year ${esc(y)}</h3><p>${count} semester${count > 1 ? 's' : ''}</p>`;
    t.onclick = () => renderSemesters(y);
    box.appendChild(t);
  });
}

function renderSemesters(year) {
  const box = $('#semestersList');
  box.classList.remove('hidden'); box.innerHTML = '';
  $('#courseList').classList.add('hidden');
  state.semesters.filter(s => s.year === year).forEach(s => {
    const t = document.createElement('div'); t.className = 'tile';
    t.innerHTML = `<h3>${esc(s.text)}</h3><p>Tap to view results</p>`;
    t.onclick = () => loadSemester(s);
    box.appendChild(t);
  });
}

async function loadSemester(s) {
  const box = $('#courseList'); box.classList.remove('hidden');
  box.innerHTML = '<div class="skeleton" style="width:60%"></div><div class="skeleton"></div><div class="skeleton" style="width:80%"></div>';

  const cached = sessionStorage.getItem('sem_' + s.value);
  let data;
  if (cached) { try { data = JSON.parse(cached); } catch {} }
  if (!data) {
    try {
      data = await api(`/api/semester?value=${encodeURIComponent(s.value)}&name=${encodeURIComponent(s.text)}`);
      sessionStorage.setItem('sem_' + s.value, JSON.stringify(data));
    } catch (e) {
      box.innerHTML = `<div class="msg err">${esc(e.message)}</div>`;
      return;
    }
  }
  box.innerHTML = renderSemesterTable(s, data);
}

function pillForGrade(g) {
  if (!g) return '<span class="pill warn">—</span>';
  const good = ['A+','A','A-','B+','B','B-'];
  const bad = ['D','F'];
  const cls = good.includes(g) ? 'a' : bad.includes(g) ? 'bad' : '';
  return `<span class="pill ${cls}">${esc(g)}</span>`;
}

function renderSemesterTable(s, data) {
  const rows = (data.computed?.courses || []).map(c => `
    <tr>
      <td>${esc(c.name)}</td>
      <td>${esc(c.total_mark)}</td>
      <td>${c.credit ?? ''}</td>
      <td>${pillForGrade(c.grade)}</td>
    </tr>`).join('');
  const sgpa = data.computed?.sgpa != null ? data.computed.sgpa.toFixed(2) : '—';
  const credits = data.computed?.totalCredits ?? 0;
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <h2 style="font-size:1.05rem">${esc(s.text)}</h2>
      <div style="display:flex;gap:8px">
        <span class="pill">SGPA ${sgpa}</span>
        <span class="pill">${credits} credits</span>
      </div>
    </div>
    <table>
      <thead><tr><th>Course</th><th>Total</th><th>Cr</th><th>Grade</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" class="sub">No courses.</td></tr>'}</tbody>
    </table>`;
}

// ——— GPA ———
async function loadGPA() {
  const out = $('#gpaOut');
  if (!state.allData) {
    out.innerHTML = '<div class="skeleton" style="width:160px;height:40px"></div><div class="progress"><div id="gpaBar"></div></div><p class="sub">Fetching all semesters…</p>';
    try {
      state.allData = await api('/api/all-semesters');
    } catch (e) {
      out.innerHTML = `<div class="msg err">${esc(e.message)}</div>`;
      return;
    }
  }
  renderGPA();
}

function prefetchAll() {
  if (state.allData) return;
  api('/api/all-semesters').then(d => { state.allData = d; }).catch(() => {});
}

function renderGPA() {
  const sems = state.allData?.semesters || [];
  let tw = 0, tp = 0, done = 0;
  sems.forEach(s => {
    if (s.computed?.sgpa != null) { tw += s.computed.totalCredits; tp += s.computed.totalPoints; done++; }
  });
  const cgpa = tw > 0 ? tp / tw : null;
  const rows = sems.map(s => `
    <tr>
      <td>${esc(s.text)}</td>
      <td>${s.computed?.sgpa != null ? s.computed.sgpa.toFixed(2) : '—'}</td>
      <td>${s.computed?.totalCredits ?? 0}</td>
      <td>${s.computed?.totalPoints != null ? s.computed.totalPoints.toFixed(2) : '—'}</td>
    </tr>`).join('');
  $('#gpaOut').innerHTML = `
    <div style="display:flex;align-items:baseline;gap:16px;flex-wrap:wrap">
      <div class="big-gpa">${cgpa != null ? cgpa.toFixed(2) : 'N/A'}</div>
      <div class="sub">CGPA across ${done} semester${done !== 1 ? 's' : ''} · ${tw} weighted credits</div>
    </div>
    <table style="margin-top:20px">
      <thead><tr><th>Semester</th><th>SGPA</th><th>Credits</th><th>Points</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" class="sub">No data</td></tr>'}</tbody>
    </table>`;
}

// ——— Profile ———
function renderProfile() {
  const p = state.profile || {};
  const rows = Object.entries(p).map(([k, v]) => `<tr><th style="width:40%">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
  $('#profileOut').innerHTML = `<table><tbody>${rows || '<tr><td class="sub">No profile data</td></tr>'}</tbody></table>`;
}

// ——— Boot: try if a valid session cookie already exists ———
(async function boot() {
  try {
    const { semesters } = await api('/api/semesters');
    state.semesters = semesters || [];
    // Cookie is valid — but we don't have profile cached. Ask portal.
    // The portal profile requires an extra fetch; do it lazily via /api/semesters fallback.
    // Instead: redirect user to sign-in so profile gets refreshed, unless they came back from transcript.
    // (Simplest: trust cookie, restore profile from sessionStorage if present.)
    const cachedProfile = sessionStorage.getItem('ju_profile');
    if (cachedProfile) {
      state.profile = JSON.parse(cachedProfile);
      showApp(); renderYears(); renderProfile(); prefetchAll();
      return;
    }
    showLogin();
  } catch {
    showLogin();
  }
})();

// After successful login, persist non-sensitive profile
const origShowApp = showApp;
showApp = function () {
  try { sessionStorage.setItem('ju_profile', JSON.stringify(state.profile)); } catch {}
  origShowApp();
};
