const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function getToken() { return localStorage.getItem('ju_token'); }
function getProfile() { try { return JSON.parse(localStorage.getItem('ju_profile') || '{}'); } catch { return {}; } }

function pick(obj, ...keys) { for (const k of keys) if (obj[k]) return obj[k]; return '—'; }

function fmtECTS(n) { return Number.isInteger(n) ? n.toFixed(1) : String(n); }

function renderSemesterBlock(sem, running) {
  const computed = sem.computed || { courses: [], totalCredits: 0, totalPoints: 0, sgpa: null };
  const rows = computed.courses.map(c => {
    const ects = c.credit;
    const grade = c.point != null ? c.grade : (c.grade || '—');
    const grNo = c.point != null ? (c.point * ects).toFixed(2) : '0.00';
    // Try to split a course code out of the name (e.g. "FLEN 1011 Communicative English…").
    const m = c.name.match(/^([A-Z]{2,6}\s*\d{3,4})\s+(.*)$/);
    const code = m ? m[1] : '';
    const title = m ? m[2] : c.name;
    return `<tr>
      <td>${esc(code)}</td>
      <td>${esc(title)}</td>
      <td class="num">${fmtECTS(ects)}</td>
      <td class="center">${esc(grade)}</td>
      <td class="num">${grNo}</td>
    </tr>`;
  }).join('');

  const sgpa = computed.sgpa != null ? computed.sgpa.toFixed(2) : '—';
  const grNoTotal = computed.totalPoints != null ? Number(computed.totalPoints).toFixed(2) : '0.00';

  return `
  <div class="sem">
    <div class="titlebar">${esc(sem.text)}</div>
    <div class="subtitle">${esc(sem.subtitle || '')}</div>
    <table>
      <thead><tr><th>Code</th><th>Course Title</th><th class="num">ECTS</th><th class="center">Grade</th><th class="num">Gr.No</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="center">—</td></tr>'}</tbody>
    </table>
    <div class="totals">
      <div>Semester Average</div><div class="num">${sgpa}</div><div class="num">${grNoTotal}</div>
    </div>
    <div class="totals">
      <div>Cumulative Average</div><div class="num">${running.cgpa != null ? running.cgpa.toFixed(2) : '—'}</div><div class="num">${running.totalPoints.toFixed(2)}</div>
    </div>
    <div class="summary">Summary: ${esc(sem.summary || '—')}</div>
  </div>`;
}

async function load() {
  const token = getToken();
  if (!token) { document.body.innerHTML = '<p style="padding:20px">Please log in first.</p>'; return; }
  const profile = getProfile();

  $('#fullName').textContent  = pick(profile, 'Full Name', 'Name');
  $('#idNumber').textContent  = pick(profile, 'ID Number', 'Id Number', 'Student ID');
  $('#dob').textContent       = pick(profile, 'Date of Birth', 'DOB');
  $('#sex').textContent       = pick(profile, 'Sex', 'Gender');
  $('#admission').textContent = pick(profile, 'Admission Classification', 'Admission');
  $('#from').textContent      = pick(profile, 'From', 'Region');
  $('#department').textContent = pick(profile, 'Program', 'Department');
  $('#degreeAwarded').textContent = pick(profile, 'Degree Awarded On', 'Graduation Date');

  const res = await fetch('/api/all-semesters', { headers: { 'x-auth-token': token } });
  const json = await res.json();
  if (!res.ok) { document.getElementById('semestersGrid').innerHTML = `<p style="padding:10px">${esc(json.error || 'Failed')}</p>`; return; }

  // Pull semester "Summary:" and running CGPA from portal summary payloads when available.
  let runWeighted = 0, runCredits = 0;
  const blocks = json.semesters.map(sem => {
    const sum = sem.data?.summary || {};
    sem.summary = sum.semester_status || sum.status || sum.semesterStatus || '';
    if (sum.subtitle) sem.subtitle = sum.subtitle;
    if (sum.semester_average && !sem.summary) sem.summary = sum.semester_average;
    const credits = sem.computed?.totalCredits || 0;
    const points  = sem.computed?.totalPoints || 0;
    if (credits > 0) { runWeighted += points; runCredits += credits; }
    const running = { totalPoints: runWeighted, cgpa: runCredits > 0 ? runWeighted / runCredits : null };
    return renderSemesterBlock(sem, running);
  });

  document.getElementById('semestersGrid').innerHTML = blocks.join('');
}

load().catch(e => {
  document.getElementById('semestersGrid').innerHTML = `<p style="padding:10px">${esc(e.message)}</p>`;
});