const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick = (o, ...k) => { for (const x of k) if (o[x]) return o[x]; return '—'; };

function getProfile() { try { return JSON.parse(sessionStorage.getItem('ju_profile') || '{}'); } catch { return {}; } }
function fmtECTS(n) { return Number(n || 0).toFixed(1); }

function splitCourse(raw) {
  // "Network And System Administration(CoSc 4036)" → { code:"CoSc 4036", title:"Network And System Administration" }
  const m = String(raw).match(/^(.*?)\s*\(([A-Za-z]{2,8}\s*\d{3,4})\)\s*$/);
  if (m) return { code: m[2], title: m[1] };
  return { code: '', title: raw };
}

function renderSemesterBlock(sem, running) {
  const c = sem.computed || { courses: [], totalCredits: 0, totalPoints: 0, sgpa: null };
  const rows = c.courses.map(course => {
    const { code, title } = splitCourse(course.name);
    const ects = course.credit || 0;
    const grade = course.point != null ? course.grade : (course.grade || '—');
    const grNo = course.point != null ? (course.point * ects).toFixed(2) : '—';
    return `<tr>
      <td>${esc(code)}</td>
      <td>${esc(title)}</td>
      <td class="num">${fmtECTS(ects)}</td>
      <td class="center">${esc(grade)}</td>
      <td class="num">${grNo}</td>
    </tr>`;
  }).join('');

  const sgpaVal = c.portalSgpa ?? c.sgpa;
  const sgpa = sgpaVal != null ? Number(sgpaVal).toFixed(2) : '—';
  const grNoTotal = Number(c.portalSgp ?? c.totalPoints ?? 0).toFixed(2);
  const creditsShown = c.portalScr ?? c.totalCredits ?? 0;

  return `
  <div class="sem">
    <div class="titlebar">${esc(sem.text)}</div>
    <div class="subtitle">Admitted to B.Sc. Degree in ${esc(pick(getProfile(), 'Program') || 'Computer Science')}</div>
    <table>
      <thead><tr><th>Code</th><th>Course Title</th><th class="num">ECTS</th><th class="center">Grade</th><th class="num">Gr.No</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="center">—</td></tr>'}</tbody>
    </table>
    <div class="totals"><div>Semester Average</div><div class="num">${sgpa}</div><div class="num">${grNoTotal}</div></div>
    <div class="totals"><div>Cumulative Average</div><div class="num">${running.cgpa != null ? running.cgpa.toFixed(2) : '—'}</div><div class="num">${running.totalPoints.toFixed(2)}</div></div>
    <div class="summary">Summary: ${esc(c.semesterStatus || '—')} · Credits: ${creditsShown}</div>
  </div>`;
}

(async function load() {
  const profile = getProfile();
  $('#fullName').textContent   = pick(profile, 'Full Name', 'Name');
  $('#idNumber').textContent   = pick(profile, 'ID Number', 'Id Number');
  $('#dob').textContent        = pick(profile, 'Date of Birth', 'DOB');
  $('#sex').textContent        = pick(profile, 'Sex', 'Gender');
  $('#admission').textContent  = pick(profile, 'Admission Classification', 'Admission');
  $('#from').textContent       = pick(profile, 'Zone', 'Region', 'From');
  $('#department').textContent = pick(profile, 'Program', 'Department');

  try {
    const r = await fetch('/api/all-semesters', { credentials: 'same-origin' });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Fetch failed');

    // Display oldest → newest so CGPA increments correctly per row.
    const sems = [...j.semesters].sort((a, b) => {
      const ay = parseInt(a.year) || 0, by = parseInt(b.year) || 0;
      if (ay !== by) return ay - by;
      return String(a.text).localeCompare(String(b.text));
    });

    let tw = 0, tc = 0, lastCgpa = null;
    const blocks = sems.map(sem => {
      const cr = sem.computed?.portalScr ?? sem.computed?.totalCredits ?? 0;
      const pt = sem.computed?.portalSgp ?? sem.computed?.totalPoints ?? 0;
      if (cr > 0) { tw += pt; tc += cr; }
      if (sem.computed?.portalCgpa) lastCgpa = sem.computed.portalCgpa;
      const runningCgpa = lastCgpa ?? (tc > 0 ? tw / tc : null);
      return renderSemesterBlock(sem, { totalPoints: tw, cgpa: runningCgpa });
    });

    $('#semestersGrid').innerHTML = blocks.join('');
  } catch (e) {
    $('#semestersGrid').innerHTML = `<p style="padding:10px;color:#b91c1c">${esc(e.message)}</p>`;
  }
})();
