const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function getProfile() { try { return JSON.parse(sessionStorage.getItem('ju_profile') || '{}'); } catch { return {}; } }
const pick = (o, ...k) => { for (const x of k) if (o[x]) return o[x]; return '—'; };

function fmtECTS(n) { return Number.isInteger(n) ? n.toFixed(1) : String(n); }

function renderSemesterBlock(sem, running) {
  const c = sem.computed || { courses: [], totalCredits: 0, totalPoints: 0, sgpa: null };
  const rows = c.courses.map(course => {
    const ects = course.credit;
    const grade = course.point != null ? course.grade : (course.grade || '—');
    const grNo = course.point != null ? (course.point * ects).toFixed(2) : '0.00';
    const m = course.name.match(/^([A-Z]{2,6}\s*\d{3,4})\s+(.*)$/);
    const code = m ? m[1] : '';
    const title = m ? m[2] : course.name;
    return `<tr>
      <td>${esc(code)}</td>
      <td>${esc(title)}</td>
      <td class="num">${fmtECTS(ects)}</td>
      <td class="center">${esc(grade)}</td>
      <td class="num">${grNo}</td>
    </tr>`;
  }).join('');

  const sgpa = c.sgpa != null ? c.sgpa.toFixed(2) : '—';
  const grNoTotal = Number(c.totalPoints || 0).toFixed(2);
  return `
  <div class="sem">
    <div class="titlebar">${esc(sem.text)}</div>
    <div class="subtitle">Admitted to B.Sc. Degree in ${esc(pick(getProfile(), 'Program') || 'Computer Science')} (Regular)</div>
    <table>
      <thead><tr><th>Code</th><th>Course Title</th><th class="num">ECTS</th><th class="center">Grade</th><th class="num">Gr.No</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="center">—</td></tr>'}</tbody>
    </table>
    <div class="totals"><div>Semester Average</div><div class="num">${sgpa}</div><div class="num">${grNoTotal}</div></div>
    <div class="totals"><div>Cumulative Average</div><div class="num">${running.cgpa != null ? running.cgpa.toFixed(2) : '—'}</div><div class="num">${running.totalPoints.toFixed(2)}</div></div>
    <div class="summary">Summary: ${esc(sem.summary || '—')}</div>
  </div>`;
}

(async function load() {
  const profile = getProfile();
  $('#fullName').textContent = pick(profile, 'Full Name', 'Name');
  $('#idNumber').textContent = pick(profile, 'ID Number', 'Id Number');
  $('#dob').textContent = pick(profile, 'Date of Birth', 'DOB');
  $('#sex').textContent = pick(profile, 'Sex', 'Gender');
  $('#admission').textContent = pick(profile, 'Admission Classification', 'Admission');
  $('#from').textContent = pick(profile, 'From', 'Region');
  $('#department').textContent = pick(profile, 'Program', 'Department');
  $('#degreeAwarded').textContent = pick(profile, 'Degree Awarded On', 'Graduation Date');

  try {
    const r = await fetch('/api/all-semesters', { credentials: 'same-origin' });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Fetch failed');

    let tw = 0, tc = 0;
    const blocks = j.semesters.map(sem => {
      const sum = sem.data?.summary || {};
      sem.summary = sum.semester_status || sum.status || sum.semesterStatus || '';
      const cr = sem.computed?.totalCredits || 0;
      const pt = sem.computed?.totalPoints || 0;
      if (cr > 0) { tw += pt; tc += cr; }
      return renderSemesterBlock(sem, { totalPoints: tw, cgpa: tc > 0 ? tw / tc : null });
    });
    $('#semestersGrid').innerHTML = blocks.join('');
  } catch (e) {
    $('#semestersGrid').innerHTML = `<p style="padding:10px;color:#b91c1c">${esc(e.message)}</p>`;
  }
})();
