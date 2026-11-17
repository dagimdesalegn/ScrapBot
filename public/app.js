const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const state = { profile: {}, semesters: [], allData: null };

function toast(msg, type='ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
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
  const meta = [p['ID Number'], p['Program']].filter(Boolean).join(' • ');
  $('#uMeta').textContent = meta;
  const avatar = $('#avatar');
  if (p._photo) {
    avatar.innerHTML = `<img src="${esc(p._photo)}" alt="" onerror="this.parentNode.textContent='${(name[0]||'?').toUpperCase()}'">`;
  } else {
    avatar.textContent = (name[0] || '?').toUpperCase();
  }
}

$('#loginBtn').addEventListener('click', async () => {
  const btn = $('#loginBtn'), msg = $('#loginMsg');
  btn.disabled = true;
  msg.className = 'msg'; msg.textContent = '';
  try {
    const data = await api('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: $('#u').value.trim(), password: $('#p').value }),
    });
    state.profile = data.profile || {};
    state.semesters = data.semesters || [];
    try { sessionStorage.setItem('ju_profile', JSON.stringify(state.profile)); } catch {}
    showApp(); renderYears(); renderProfile(); prefetchAll();
    toast('Signed in ✓');
  } catch (e) {
    msg.textContent = '❌ ' + e.message;
    msg.className = 'msg err';
  } finally { btn.disabled = false; }
});

$('#p').addEventListener('keydown', e => { if (e.key === 'Enter') $('#loginBtn').click(); });

$('#logoutBtn').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST' }); } catch {}
  state.profile = {}; state.semesters = []; state.allData = null;
  try { sessionStorage.clear(); } catch {}
  showLogin();
});

$('#transcriptBtn').addEventListener('click', () => window.open('/transcript.html', '_blank'));

$$('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => {
  $$('.tabs [data-tab]').forEach(x => x.classList.toggle('active', x === b));
  const tabName = b.dataset.tab;
  ['grades', 'gpa', 'profile'].forEach(t => {
    const el = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
    if (el) el.classList.toggle('hidden', t !== tabName);
  });
  if (tabName === 'gpa') loadGPA();
}));

function renderYears() {
  const years = [...new Set(state.semesters.map(s => s.year))].sort().reverse();
  const box = $('#yearsList'); box.innerHTML = '';
  $('#semestersList').classList.add('hidden');
  $('#courseList').classList.add('hidden');
  if (!years.length) { box.innerHTML = '<p style="color:var(--muted)">No semesters found.</p>'; return; }
  years.forEach(y => {
    const t = document.createElement('div'); t.className = 'tile';
    const n = state.semesters.filter(s => s.year === y).length;
    t.innerHTML = `<h3>📚 Year ${esc(y)}</h3><p>${n} semester${n>1?'s':''}</p>`;
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
    t.innerHTML = `<h3>${esc(s.text)}</h3><p>Tap to view</p>`;
    t.onclick = () => loadSemester(s);
    box.appendChild(t);
  });
}

async function loadSemester(s) {
  const box = $('#courseList'); box.classList.remove('hidden');
  box.innerHTML = '<div class="skel" style="width:60%"></div><div class="skel"></div><div class="skel" style="width:85%"></div>';
  const cached = sessionStorage.getItem('sem_' + s.value);
  let data;
  if (cached) { try { data = JSON.parse(cached); } catch {} }
  if (!data) {
    try {
      data = await api(`/api/semester?value=${encodeURIComponent(s.value)}&name=${encodeURIComponent(s.text)}`);
      sessionStorage.setItem('sem_' + s.value, JSON.stringify(data));
    } catch (e) {
      box.innerHTML = `<div class="msg err" style="display:block">${esc(e.message)}</div>`;
      return;
    }
  }
  box.innerHTML = renderSemesterTable(s, data);
}

function pillForGrade(g) {
  if (!g || g === 'NG' || g === 'Not Graded') return '<span class="pill warn">—</span>';
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
  const credits = data.computed?.portalScr ?? data.computed?.totalCredits ?? 0;
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
      <h3 style="font-size:1.05rem;margin:0">${esc(s.text)}</h3>
      <div style="display:flex;gap:8px">
        <span class="pill">SGPA ${sgpa}</span>
        <span class="pill">${credits} credits</span>
      </div>
    </div>
    <table>
      <thead><tr><th>Course</th><th>Total</th><th>Cr</th><th>Grade</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" style="color:var(--muted)">No courses</td></tr>'}</tbody>
    </table>`;
}

async function loadGPA() {
  const out = $('#gpaOut');
  if (!state.allData) {
    out.innerHTML = '<div class="skel" style="width:180px;height:46px"></div><div class="skel"></div><p style="color:var(--muted);font-size:.85rem">Fetching all semesters…</p>';
    try { state.allData = await api('/api/all-semesters'); }
    catch (e) { out.innerHTML = `<div class="msg err" style="display:block">${esc(e.message)}</div>`; return; }
  }
  renderGPA();
}

function prefetchAll() {
  if (state.allData) return;
  api('/api/all-semesters').then(d => { state.allData = d; }).catch(() => {});
}

function renderGPA() {
  const sems = state.allData?.semesters || [];
  let tw = 0, tp = 0, done = 0, cgpaPortal = null;
  sems.forEach(s => {
    if (s.computed?.sgpa != null) {
      tw += s.computed.portalScr || s.computed.totalCredits || 0;
      tp += (s.computed.sgpa * (s.computed.portalScr || s.computed.totalCredits || 0));
      done++;
    }
    if (s.computed?.portalCgpa) cgpaPortal = s.computed.portalCgpa;
  });
  const cgpa = cgpaPortal ?? (tw > 0 ? tp / tw : null);
  const rows = sems.map(s => `
    <tr>
      <td>${esc(s.text)}</td>
      <td>${s.computed?.sgpa != null ? s.computed.sgpa.toFixed(2) : '—'}</td>
      <td>${s.computed?.portalScr ?? s.computed?.totalCredits ?? 0}</td>
      <td>${s.computed?.portalCgpa != null ? s.computed.portalCgpa.toFixed(2) : '—'}</td>
    </tr>`).join('');
  $('#gpaOut').innerHTML = `
    <div style="display:flex;align-items:baseline;gap:16px;flex-wrap:wrap;margin-bottom:8px">
      <div class="big">${cgpa != null ? cgpa.toFixed(2) : 'N/A'}</div>
      <div style="color:var(--muted);font-size:.9rem">CGPA across ${done} semester${done!==1?'s':''}</div>
    </div>
    <table>
      <thead><tr><th>Semester</th><th>SGPA</th><th>Credits</th><th>CGPA</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" style="color:var(--muted)">No data</td></tr>'}</tbody>
    </table>`;
}

function renderProfile() {
  const p = state.profile || {};
  const entries = Object.entries(p).filter(([k]) => k !== '_photo');
  const rows = entries.map(([k, v]) => `<tr><th style="width:38%">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
  $('#profileOut').innerHTML = `<table><tbody>${rows || '<tr><td style="color:var(--muted)">No profile data</td></tr>'}</tbody></table>`;
}

(async function boot() {
  try {
    const { semesters } = await api('/api/semesters');
    state.semesters = semesters || [];
    const cached = sessionStorage.getItem('ju_profile');
    if (cached) {
      state.profile = JSON.parse(cached);
      showApp(); renderYears(); renderProfile(); prefetchAll();
      return;
    }
    showLogin();
  } catch { showLogin(); }
})();
