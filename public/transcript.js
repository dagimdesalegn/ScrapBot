const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick = (o, ...k) => { for (const x of k) if (o[x] && o[x] !== 'undefined') return o[x]; return '—'; };

function getProfile() {
  try {
    const p = JSON.parse(sessionStorage.getItem('ju_profile') || '{}');
    return p;
  } catch { return {}; }
}

function fmtECTS(n) { return Number(n || 0).toFixed(1); }

function splitCourse(raw) {
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
    <div class="subtitle-sm">Admitted to B.Sc. Degree in ${esc(pick(getProfile(), 'Program') || 'Computer Science')}</div>
    <table>
      <thead><tr><th>Code</th><th>Course Title</th><th class="num">ECTS</th><th class="center">Grade</th><th class="num">Gr.No</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="center">—</td></tr>'}</tbody>
    </table>
    <div class="totals"><div>Semester Average</div><div class="num">${sgpa}</div><div class="num">${grNoTotal}</div></div>
    <div class="totals"><div>Cumulative Average</div><div class="num">${running.cgpa != null ? running.cgpa.toFixed(2) : '—'}</div><div class="num">${running.totalPoints.toFixed(2)}</div></div>
    <div class="summary">Summary: ${esc(c.semesterStatus || 'Promoted')} · Credits: ${creditsShown}</div>
  </div>`;
}

function renderPage(sems, isFirst, runningData, profile, degreeYear) {
  let headerHtml = '';

  if (isFirst) {
    headerHtml = `
      <h1>JIMMA UNIVERSITY</h1>
      <div class="subtitle">STUDENT ACADEMIC RECORD</div>
      <div class="head">
        <div>
          <div>OFFICE OF REGISTRAR</div>
          <div>P.O.Box 378 JU, ETHIOPIA</div>
          <div>Jimma Institute of Technology</div>
        </div>
        <div class="mid">Medium of Instruction: English</div>
        <div class="rt">Degree Awarded On: <span>${degreeYear}</span></div>
      </div>
      <div class="info-box">
        <div class="info-row">
          <div class="info-cell"><b>Full Name:</b> ${esc(pick(profile, 'Full Name', 'Name'))}</div>
          <div class="info-cell"><b>Date of Birth:</b> ${esc(pick(profile, 'Birth Date', 'Date of Birth', 'DOB'))}</div>
          <div class="info-cell"><b>Admission Classification:</b> Regular</div>
        </div>
        <div class="info-row">
          <div class="info-cell"><b>Id Number:</b> ${esc(pick(profile, 'ID Number', 'Id Number'))}</div>
          <div class="info-cell"><b>Sex:</b> ${esc(pick(profile, 'Sex', 'Gender'))}</div>
          <div class="info-cell"><b>From:</b> ${esc(pick(profile, 'Zone', 'From'))}</div>
        </div>
        <div class="info-row">
          <div class="info-cell" style="grid-column:span 2"></div>
          <div class="info-cell"><b>Department:</b> ${esc(pick(profile, 'Department', 'Program'))}</div>
        </div>
      </div>
    `;
  } else {
    headerHtml = `
      <div class="continuation-head">
        <div>FULL NAME: ${esc(pick(profile, 'Full Name', 'Name').toUpperCase())}</div>
        <div>ID NO: ${esc(pick(profile, 'ID Number', 'Id Number'))}</div>
      </div>
    `;
  }

  let tw = runningData.tw;
  let tc = runningData.tc;
  let lastCgpa = runningData.lastCgpa;

  const blocks = sems.map(sem => {
    const cr = sem.computed?.portalScr ?? sem.computed?.totalCredits ?? 0;
    const pt = sem.computed?.portalSgp ?? sem.computed?.totalPoints ?? 0;
    if (cr > 0) { tw += pt; tc += cr; }
    if (sem.computed?.portalCgpa) lastCgpa = sem.computed.portalCgpa;
    const runningCgpa = lastCgpa ?? (tc > 0 ? tw / tc : null);
    return renderSemesterBlock(sem, { totalPoints: tw, cgpa: runningCgpa });
  }).join('');

  return `
    <div class="page">
      <div class="page-content">
        ${headerHtml}
        <div class="grid">${blocks}</div>
      </div>
      <div class="stamp">STUDENT COPY</div>
      <div class="footer">
        <div><b>Grading System:</b> P = Pass, A+ = Excellent, A = Excellent, A− = Excellent, B+ = Very Good, B = Very Good, B− = Good, C+ = Good, C = Satisfactory, C− = Satisfactory, D = Unsatisfactory, F = Fail, I = Incomplete, NG = No Grade, W = Withdrawn. Points: A+ = 4, A = 4, A− = 3.75, B+ = 3.5, B = 3, B− = 2.75, C+ = 2.5, C = 2, C− = 1.75, D = 1, F = 0. *Course Repeated; TR = Credit Transfer. THE TRANSCRIPT IS OFFICIAL ONLY WHEN SIGNED AND SEALED BY THE REGISTRAR.</div>
        <div class="footer-sign">
          <div>Date of Issue: __________________</div>
          <div>_____________________<br>Registrar</div>
        </div>
      </div>
    </div>
  `;
}

(async function load() {
  try {
    const r = await fetch('/api/all-semesters', { credentials: 'same-origin' });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Fetch failed');

    const profile = getProfile();
    const sems = [...j.semesters].sort((a, b) => {
      const ay = parseInt(a.year) || 0, by = parseInt(b.year) || 0;
      if (ay !== by) return ay - by;
      return String(a.text).localeCompare(String(b.text));
    });

    // ---- AUTO DEGREE YEAR ----
    let degreeYear = '—';
    if (sems.length > 0) {
      const lastYear = sems[sems.length - 1].year; // e.g. "2025/26"
      if (lastYear && lastYear.includes('/')) {
        const endYear = lastYear.split('/')[1]; // "26"
        const fullEnd = parseInt(lastYear.split('/')[0]) + 1; // 2026
        degreeYear = `June ${fullEnd}`;
      } else {
        degreeYear = lastYear || '—';
      }
    }
    // -------------------------

    let html = '';
    let runningData = { tw: 0, tc: 0, lastCgpa: null };

    for (let i = 0; i < sems.length; i += 4) {
      const pageSems = sems.slice(i, i + 4);
      const res = renderPage(pageSems, i === 0, runningData, profile, degreeYear);
      html += res;
      // Update running totals from the last semester on the page
      const last = pageSems[pageSems.length - 1];
      const cr = last.computed?.portalScr ?? last.computed?.totalCredits ?? 0;
      const pt = last.computed?.portalSgp ?? last.computed?.totalPoints ?? 0;
      runningData.tw += pt;
      runningData.tc += cr;
      if (last.computed?.portalCgpa) runningData.lastCgpa = last.computed.portalCgpa;
    }

    document.getElementById('pages-container').innerHTML = html;
  } catch (e) {
    document.getElementById('pages-container').innerHTML = `<p style="padding:20px;color:red">${esc(e.message)}</p>`;
  }
})();
