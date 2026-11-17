const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick = (o, ...k) => { for (const x of k) if (o && o[x] && o[x] !== 'undefined') return o[x]; return '—'; };

function getProfile() {
  try { return JSON.parse(sessionStorage.getItem('ju_profile') || '{}'); } catch { return {}; }
}
function fmtECTS(n) { return Number(n || 0).toFixed(1); }

// Hardcoded dictionary for common Year 1 & 2 courses to guarantee codes are extracted
const COURSE_CODES = {
  'communicative english language skills i': 'FLEn 1011',
  'physical fitness': 'SpSc 1011',
  'general physics': 'Phys 1011',
  'general psychology': 'Psyc 1011',
  'mathematics for natural sciences': 'Math 1011',
  'critical thinking': 'LoCT 1011',
  'geography of ethiopia and the horn': 'GeES 1011',
  'communicative english language skills ii': 'FLEn 1012',
  'social anthropology': 'Anth 1012',
  'applied mathematics i': 'Math 1041',
  'enterprenuership': 'Mgmt 1012',
  'introduction to emerging technologies': 'EmTe 1012',
  'moral and civic education': 'MCiE 1012',
  'computer programming': 'ECEg 2052',
  'computer programing': 'ECEg 2052'
};

function splitCourse(raw) {
  let str = String(raw || '').trim();
  let title = str;
  let code = '';

  // 1. Check hardcoded dictionary first to guarantee Year 1 & 2 codes
  const lowerStr = str.toLowerCase();
  for (const [key, val] of Object.entries(COURSE_CODES)) {
    if (lowerStr.includes(key)) {
      return { code: val, title: str.replace(new RegExp(key, 'i'), '').replace(/[()]/g, '').trim() || str };
    }
  }

  // 2. Fallback to Regex for other courses (like Year 3 & 4)
  let m = str.match(/^(.*?)\s*\(([A-Za-z.]+\s*\d+)\)\s*$/);
  if (m) {
    title = m[1].trim();
    code = m[2].trim();
  } else {
    m = str.match(/^([A-Za-z.]+\s*\d+)\s+(.*)$/);
    if (m) {
      code = m[1].trim();
      title = m[2].trim();
    }
  }

  if (code) {
    code = code.replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
  }
  return { code, title };
}

function renderSemesterBlock(sem, running) {
  const c = sem.computed || { courses: [], totalCredits: 0, totalPoints: 0, sgpa: null };

  const rows = c.courses.map(course => {
    const sc = splitCourse(course.name);
    const ects = course.credit || 0;
    const grade = course.grade || '—';
    const grNo = course.point != null ? (course.point * ects).toFixed(2) : '0.00';
    
    return '<tr>' +
      '<td>' + esc(sc.code) + '</td>' +
      '<td>' + esc(sc.title) + '</td>' +
      '<td class="num">' + fmtECTS(ects) + '</td>' +
      '<td class="center">' + esc(grade) + '</td>' +
      '<td class="num">' + grNo + '</td>' +
    '</tr>';
  }).join('');

  const semCr = c.portalScr || c.totalCredits || 0;
  const semPt = c.portalSgp || c.totalPoints || 0;
  const semGpa = c.portalSgpa || c.sgpa || (semCr ? semPt / semCr : 0);

  running.cr += semCr;
  running.pt += semPt;
  const cumGpa = c.portalCgpa || (running.cr ? running.pt / running.cr : 0);
  const summaryText = c.semesterStatus || 'Pass';

  return '<div class="sem">' +
    '<div class="titlebar">' + esc(sem.text) + '</div>' +
    '<div class="subtitle-sm">Admitted to B.Sc. Degree in ' + esc(pick(getProfile(), 'Program') || 'Computer Science') + '</div>' +
    '<table>' +
      '<thead><tr><th>Code</th><th>Course Title</th><th class="num">ECTS</th><th class="center">Grade</th><th class="num">Gr.No</th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="5" class="center">—</td></tr>') + '</tbody>' +
    '</table>' +
    '<div class="totals"><div>Semester Average</div><div>' + Number(semGpa).toFixed(2) + '</div><div>' + semCr + '</div><div>' + Number(semPt).toFixed(2) + '</div></div>' +
    '<div class="totals"><div>Cumulative Average</div><div>' + Number(cumGpa).toFixed(2) + '</div><div>' + running.cr + '</div><div>' + Number(running.pt).toFixed(2) + '</div></div>' +
    '<div class="summary">Summary: ' + esc(summaryText) + '</div>' +
  '</div>';
}

function buildPageHeader(isFirst, profile, degreeYear) {
  if (isFirst) {
    return '<h1>JIMMA UNIVERSITY</h1>' +
      '<div class="subtitle">STUDENT ACADEMIC RECORD</div>' +
      '<div class="head">' +
        '<div>' +
          '<div>OFFICE OF REGISTRAR</div>' +
          '<div>P.O.Box 378 JU, ETHIOPIA</div>' +
          '<div>Jimma Institute of Technology</div>' +
        '</div>' +
        '<div class="mid">Medium of Instruction: English</div>' +
        '<div class="rt">Degree Awarded On: <span>' + degreeYear + '</span></div>' +
      '</div>' +
      '<div class="info-box">' +
        '<div class="info-row">' +
          '<div class="info-cell"><b>Full Name:</b> ' + esc(pick(profile, 'Full Name', 'Name')) + '</div>' +
          '<div class="info-cell"><b>Date of Birth:</b> ' + esc(pick(profile, 'Birth Date', 'Date of Birth', 'DOB')) + '</div>' +
          '<div class="info-cell"><b>Admission Classification:</b> Regular</div>' +
        '</div>' +
        '<div class="info-row">' +
          '<div class="info-cell"><b>Id Number:</b> ' + esc(pick(profile, 'ID Number', 'Id Number')) + '</div>' +
          '<div class="info-cell"><b>Sex:</b> ' + esc(pick(profile, 'Sex', 'Gender')) + '</div>' +
          '<div class="info-cell"><b>From:</b> ' + esc(pick(profile, 'Zone', 'From')) + '</div>' +
        '</div>' +
        '<div class="info-row">' +
          '<div class="info-cell" style="grid-column:span 2"></div>' +
          '<div class="info-cell"><b>Department:</b> ' + esc(pick(profile, 'Department', 'Program')) + '</div>' +
        '</div>' +
      '</div>';
  }
  
  return '<div class="continuation-head">' +
    '<div>FULL NAME: ' + esc(pick(profile, 'Full Name', 'Name').toUpperCase()) + '</div>' +
    '<div class="id-no">ID NO: ' + esc(pick(profile, 'ID Number', 'Id Number')) + '</div>' +
  '</div>';
}

function buildFooter() {
  return '<div class="footer">' +
    '<div><b>Grading System:</b> P = Pass, A+ = Excellent, A = Excellent, A− = Excellent, B+ = Very Good, B = Very Good, B− = Good, C+ = Good, C = Satisfactory, C− = Satisfactory, D = Unsatisfactory, F = Fail, I = Incomplete, NG = No Grade, W = Withdrawn. Points: A+ = 4, A = 4, A− = 3.75, B+ = 3.5, B = 3, B− = 2.75, C+ = 2.5, C = 2, C− = 1.75, D = 1, F = 0. *Course Repeated; TR = Credit Transfer. THE TRANSCRIPT IS OFFICIAL ONLY WHEN SIGNED AND SEALED BY THE REGISTRAR.</div>' +
    '<div class="footer-sign">' +
      '<div>Date of Issue: __________________</div>' +
      '<div>_____________________<br>Registrar</div>' +
    '</div>' +
  '</div>';
}

async function load() {
  try {
    const r = await fetch('/api/all-semesters', { credentials: 'same-origin' });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Fetch failed');

    const profile = getProfile();
    const sems = (j.semesters || []).slice().sort((a, b) => {
      const ay = parseInt(a.year) || 0, by = parseInt(b.year) || 0;
      if (ay !== by) return ay - by;
      return String(a.text).localeCompare(String(b.text));
    });

    let degreeYear = '—';
    if (sems.length > 0) {
      const lastYear = sems[sems.length - 1].year;
      if (lastYear && lastYear.includes('/')) {
        degreeYear = 'June ' + (parseInt(lastYear.split('/')[0]) + 1);
      }
    }

    const grouped = {};
    sems.forEach(sem => {
      const y = parseInt(sem.year) || 0;
      if (!grouped[y]) grouped[y] = [];
      grouped[y].push(sem);
    });
    const years = Object.keys(grouped).sort((a, b) => a - b);

    let html = '';
    const running = { cr: 0, pt: 0 };

    // PAGE 1: Years 1 & 2 + 3rd Column
    if (years.length > 0) {
      const y1 = grouped[years[0]] || [];
      const y2 = years.length > 1 ? grouped[years[1]] : [];
      let leftCol = y1.map(s => renderSemesterBlock(s, running)).join('');
      let midCol  = y2.map(s => renderSemesterBlock(s, running)).join('');
      
      html += '<div class="page">' +
        '<div class="page-content">' +
          buildPageHeader(true, profile, degreeYear) +
          '<div class="grid-page1">' +
            '<div class="col">' + leftCol + '</div>' +
            '<div class="col">' + midCol + '</div>' +
            '<div class="col">' +
              '<div class="sem"></div>' + // Top empty box
              '<div class="sem stamp-box"><div class="stamp">STUDENT COPY</div></div>' + // Bottom box with stamp
            '</div>' +
          '</div>' +
        '</div>' +
        buildFooter() +
      '</div>';
    }

    // PAGE 2: Years 3 & 4 + Tall Stamp Box
    if (years.length > 2) {
      let leftCol = '';
      for (let i = 2; i < years.length; i++) {
        leftCol += (grouped[years[i]] || []).map(s => renderSemesterBlock(s, running)).join('');
      }
      html += '<div class="page">' +
        '<div class="page-content">' +
          buildPageHeader(false, profile, degreeYear) +
          '<div class="grid-page2">' +
            '<div class="col">' + leftCol + '</div>' +
            '<div class="sem stamp-box" style="height: 100%;">' +
              '<div class="stamp">STUDENT COPY</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        buildFooter() +
      '</div>';
    }

    document.getElementById('pages-container').innerHTML = html;
  } catch (e) {
    document.getElementById('pages-container').innerHTML =
      '<p style="padding:20px;color:#b91c1c;font-family:system-ui;font-weight:bold;">' + esc(e.message) + '</p>';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', load);
} else {
  load();
}
