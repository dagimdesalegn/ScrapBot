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

// Format "FLEN1011" to "FLEN 1011" for common courses
function splitCourse(raw) {
  const m = String(raw).match(/^(.*?)\s*\(([A-Za-z]{2,8}\s*\d{3,4})\)\s*$/);
  if (m) {
    let title = m[1];
    let code = m[2];
    // If code is "FLEN1011", insert space
    code = code.replace(/^([A-Za-z]+)(\d+)/, '$1 $2');
    return { code, title };
  }
  return { code: '', title: raw };
}

function renderSemesterBlock(sem, running, isFirstSem) {
  const c = sem.computed || { courses: [], totalCredits: 0, totalPoints: 0, sgpa: null };
  
  const rows = c.courses.map(course => {
    const { code, title } = splitCourse(course.name);
    const ects = course.credit || 0;
    
    // Grade fallback
    const grade = course.grade || '—';
    // Grade Point Number: If point is null (like I, P, etc), force 0.00
    const grNo = course.point != null ? (course.point * ects).toFixed(2) : '0.00';
    
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
  const summaryText = c.semesterStatus || 'Promoted';

  // Note: If this is the first semester of the year, it needs a margin top
  return `
  <div class="sem" ${isFirstSem ? '' : 'style="margin-top:5px"'}>
    <div class="titlebar">${esc(sem.text)}</div>
    <div class="subtitle-sm">Admitted to B.Sc. Degree in ${esc(pick(getProfile(), 'Program') || 'Computer Science')}</div>
    <table>
      <thead><tr><th>Code</th><th>Course Title</th><th class="num">ECTS</th><th class="center">Grade</th><th class="num">Gr.No</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="center">—</td></tr>'}</tbody>
    </table>
    <div class="totals">
      <div>Semester Average</div>
      <div>${sgpa}</div>
      <div>${creditsShown}</div>
      <div>${grNoTotal}</div>
    </div>
    <div class="summary">Summary: ${esc(summaryText)}</div>
  </div>`;
}

function buildPageHeader(isFirst, profile, degreeYear) {
  if (isFirst) {
    return `
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
    return `
      <div class="continuation-head">
        <div>FULL NAME: ${esc(pick(profile, 'Full Name', 'Name').toUpperCase())}</div>
        <div>ID NO: ${esc(pick(profile, 'ID Number', 'Id Number'))}</div>
      </div>
    `;
  }
}

function buildFooter() {
  return `
    <div class="stamp">STUDENT COPY</div>
    <div class="footer">
      <div><b>Grading System:</b> P = Pass, A+ = Excellent, A = Excellent, A− = Excellent, B+ = Very Good, B = Very Good, B− = Good, C+ = Good, C = Satisfactory, C− = Satisfactory, D = Unsatisfactory, F = Fail, I = Incomplete, NG = No Grade, W = Withdrawn. Points: A+ = 4, A = 4, A− = 3.75, B+ = 3.5, B = 3, B− = 2.75, C+ = 2.5, C = 2, C− = 1.75, D = 1, F = 0. *Course Repeated; TR = Credit Transfer. THE TRANSCRIPT IS OFFICIAL ONLY WHEN SIGNED AND SEALED BY THE REGISTRAR.</div>
      <div class="footer-sign">
        <div>Date of Issue: __________________</div>
        <div>_____________________<br>Registrar</div>
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
    
    // Sort chronologically
    const sems = [...j.semesters].sort((a, b) => {
      const ay = parseInt(a.year) || 0, by = parseInt(b.year) || 0;
      if (ay !== by) return ay - by;
      return String(a.text).localeCompare(String(b.text));
    });

    // Auto Degree Year (based on latest semester)
    let degreeYear = '—';
    if (sems.length > 0) {
      const lastYear = sems[sems.length - 1].year;
      if (lastYear && lastYear.includes('/')) {
        const parts = lastYear.split('/');
        const endYear = parseInt(parts[0]) + 1;
        degreeYear = `June ${endYear}`;
      }
    }

    // Group by Year (1, 2, 3, 4)
    const groupedByYear = {};
    sems.forEach(sem => {
      const y = parseInt(sem.year) || 0;
      if (!groupedByYear[y]) groupedByYear[y] = [];
      groupedByYear[y].push(sem);
    });

    const years = Object.keys(groupedByYear).sort((a,b) => a-b);
    let html = '';

    let runningData = { tw: 0, tc: 0, lastCgpa: null };

    // ================= PAGE 1 (Years 1 & 2) =================
    if (years.length > 0) {
      const y1Sems = groupedByYear[years[0]] || [];
      const y2Sems = years.length > 1 ? groupedByYear[years[1]] : [];

      let leftHtml = '';
      let rightHtml = '';

      y1Sems.forEach((sem, idx) => {
        const cr = sem.computed?.portalScr ?? sem.computed?.totalCredits ?? 0;
        const pt = sem.computed?.portalSgp ?? sem.computed?.totalPoints ?? 0;
        if (cr > 0) { runningData.tw += pt; runningData.tc += cr; }
        if (sem.computed?.portalCgpa) runningData.lastCgpa = sem.computed.portalCgpa;
        const runCgpa = runningData.lastCgpa ?? (runningData.tc > 0 ? runningData.tw / runningData.tc : null);
        leftHtml += renderSemesterBlock(sem, { totalPoints: runningData.tw, cgpa: runCgpa }, idx === 0);
      });

      y2Sems.forEach((sem, idx) => {
        const cr = sem.computed?.portalScr ?? sem.computed?.totalCredits ?? 0;
        const pt = sem.computed?.portalSgp ?? sem.computed?.totalPoints ?? 0;
        if (cr > 0) { runningData.tw += pt; runningData.tc += cr; }
        if (sem.computed?.portalCgpa) runningData.lastCgpa = sem.computed.portalCgpa;
        const runCgpa = runningData.lastCgpa ?? (runningData.tc > 0 ? runningData.tw / runningData.tc : null);
        rightHtml += renderSemesterBlock(sem, { totalPoints: runningData.tw, cgpa: runCgpa }, idx === 0);
      });

      html += `
        <div class="page">
          <div class="page-content" style="flex:1;">
            ${buildPageHeader(true, profile, degreeYear)}
            <div class="flex-cols">
              <div class="col">${leftHtml}</div>
              <div class="col">${rightHtml}</div>
            </div>
          </div>
          ${buildFooter()}
        </div>
      `;
    }

    // ================= PAGE 2 (Years 3 & 4) =================
    if (years.length > 2) {
      let leftHtml = '';
      let hasSems = false;

      for (let i = 2; i < years.length; i++) {
        const ySems = groupedByYear[years[i]] || [];
        ySems.forEach((sem, idx) => {
          const cr = sem.computed?.portalScr ?? sem.computed?.totalCredits ?? 0;
          const pt = sem.computed?.portalSgp ?? sem.computed?.totalPoints ?? 0;
          if (cr > 0) { runningData.tw += pt; runningData.tc += cr; }
          if (sem.computed?.portalCgpa) runningData.lastCgpa = sem.computed.portalCgpa;
          const runCgpa = runningData.lastCgpa ?? (runningData.tc > 0 ? runningData.tw / runningData.tc : null);
          
          leftHtml += renderSemesterBlock(sem, { totalPoints: runningData.tw, cgpa: runCgpa }, idx === 0);
          hasSems = true;
        });
      }

      if (hasSems) {
        html += `
          <div class="page">
            <div class="page-content" style="flex:1;">
              ${buildPageHeader(false, profile, degreeYear)}
              <div class="flex-cols" style="width: 100%;">
                <div class="col">${leftHtml}</div>
                <!-- Right side intentionally empty to match the image layout -->
              </div>
            </div>
            ${buildFooter()}
          </div>
        `;
      }
    }

    document.getElementById('pages-container').innerHTML = html;
  } catch (e) {
    document.getElementById('pages-container').innerHTML = `<p style="padding:20px;color:red">${esc(e.message)}</p>`;
  }
})();
