const $ = s => document.querySelector(s);
const store = {
  get token() { return localStorage.getItem('ju_token'); },
  set token(v) { v ? localStorage.setItem('ju_token', v) : localStorage.removeItem('ju_token'); },
  get profile() { try { return JSON.parse(localStorage.getItem('ju_profile') || '{}'); } catch { return {}; } },
  set profile(v) { localStorage.setItem('ju_profile', JSON.stringify(v || {})); },
  clear() { localStorage.removeItem('ju_token'); localStorage.removeItem('ju_profile'); }
};

function toast(msg, isErr) {
  const el = document.createElement('div');
  el.className = 'toast ' + (isErr ? 'err' : 'ok');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (store.token) headers['x-auth-token'] = store.token;
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const r = await fetch(path, { ...opts, headers });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) { store.clear(); showLogin(); throw new Error(data.error || 'Unauthorized'); }
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

function showLogin() { $('#loginView').classList.remove('hidden'); $('#appView').classList.add('hidden'); }
function showApp()   { $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden'); }

$('#loginBtn').addEventListener('click', async () => {
  const btn = $('#loginBtn'), msg = $('#loginMsg');
  btn.disabled = true; msg.classList.add('hidden');
  try {
    const data = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username: $('#u').value, password: $('#p').value }),
    });
    store.token = data.token;
    store.profile = data.profile;
    toast('Signed in ✓');
    await boot();
  } catch (e) { msg.textContent = '❌ ' + e.message; msg.className = 'err'; msg.classList.remove('hidden'); }
  finally { btn.disabled = false; }
});

document.querySelectorAll('.tabs [data-tab]').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.tabs [data-tab]').forEach(x => x.classList.toggle('active', x === b));
    ['Grades', 'Gpa', 'Profile'].forEach(t => $('#tab' + t).classList.toggle('hidden', t.toLowerCase() !== b.dataset.tab));
  });
});

$('#logoutBtn').addEventListener('click', () => { store.clear(); showLogin(); });
$('#transcriptBtn').addEventListener('click', () => window.open('/transcript.html', '_blank'));

async function boot() {
  if (!store.token) return showLogin();
  showApp();
  const p = store.profile || {};
  $('#hello').textContent = `Welcome, ${p['Full Name'] || 'Student'}`;
  $('#helloSub').textContent = [p['ID Number'], p['Program']].filter(Boolean).join(' • ');
  renderProfile(p);
  loadYears().catch(e => toast(e.message, true));
  loadGPA().catch(e => toast(e.message, true));
}

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

async function loadYears() {
  const { semesters } = await api('/api/semesters');
  window.__semesters = semesters;
  const years = [...new Set(semesters.map(s => s.year))].sort().reverse();
  const box = $('#yearsList'); box.innerHTML = '';
  $('#semestersList').classList.add('hidden');
  $('#courseList').classList.add('hidden');
  years.forEach(y => {
    const t = document.createElement('div'); t.className = 'tile';
    t.innerHTML = `<h3>📚 Year ${esc(y)}</h3><p>${semesters.filter(s => s.year === y).length} semesters</p>`;
    t.onclick = () => showSemesters(y);
    box.appendChild(t);
  });
}

function showSemesters(year) {
  const box = $('#semestersList');
  box.classList.remove('hidden'); box.innerHTML = '';
  $('#courseList').classList.add('hidden');
  window.__semesters.filter(s => s.year === year).forEach(s => {
    const t = document.createElement('div'); t.className = 'tile';
    t.innerHTML = `<h3>${esc(s.text)}</h3><p>Click to open results</p>`;
    t.onclick = () => showSemester(s);
    box.appendChild(t);
  });
}

async function showSemester(s) {
  const box = $('#courseList'); box.classList.remove('hidden');
  box.innerHTML = `<p class="sub">⏳ Loading ${esc(s.text)}…</p>`;
  try {
    const data = await api(`/api/semester?value=${encodeURIComponent(s.value)}&name=${encodeURIComponent(s.text)}`);
    box.innerHTML = renderSemesterTable(s, data);
  } catch (e) {
    box.innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

function renderSemesterTable(s, data) {
  const rows = (data.courses || []).map(c => {
    const g = data.computed.courses.find(x => x.name === c.name) || {};
    return `<tr>
      <td>${esc(c.name)}</td>
      <td>${esc(c.total_mark)}</td>
      <td>${esc(g.credit ?? '')}</td>
      <td><span class="pill">${esc(g.grade || c.grade || 'NG')}</span></td>
    </tr>`;
  }).join('');
  const sgpa = data.computed.sgpa != null ? data.computed.sgpa.toFixed(2) : '—';
  return `
    <h2>${esc(s.text)}</h2>
    <p class="sub">SGPA: <strong>${sgpa}</strong> • Credits: ${data.computed.totalCredits}</p>
    <table><thead><tr><th>Course</th><th>Total</th><th>Cr</th><th>Grade</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4" class="sub">No courses</td></tr>'}</tbody></table>`;
}

async function loadGPA() {
  const { semesters } = await api('/api/all-semesters');
  let tw = 0, tp = 0;
  semesters.forEach(s => {
    if (s.computed?.sgpa != null) {
      tw += s.computed.totalCredits;
      tp += s.computed.totalPoints;
    }
  });
  const cgpa = tw > 0 ? tp / tw : null;
  $('#gpaOut').innerHTML = `
    <p style="font-size:1.2rem">📊 <strong>CGPA:</strong> <span class="pill">${cgpa != null ? cgpa.toFixed(2) : 'N/A'}</span></p>
    <p class="sub">Total weighted credits: ${tw}</p>
    <table><thead><tr><th>Semester</th><th>SGPA</th><th>Credits</th></tr></thead><tbody>
      ${semesters.map(s => `
        <tr>
          <td>${esc(s.text)}</td>
          <td>${s.computed?.sgpa != null ? s.computed.sgpa.toFixed(2) : '—'}</td>
          <td>${s.computed?.totalCredits ?? 0}</td>
        </tr>`).join('')}
    </tbody></table>`;
}

function renderProfile(p) {
  const rows = Object.entries(p).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
  $('#profileOut').innerHTML = `<table><tbody>${rows || '<tr><td class="sub">No profile data</td></tr>'}</tbody></table>`;
}

boot();