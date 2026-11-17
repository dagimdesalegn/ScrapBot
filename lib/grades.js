const GRADE_SCALE = {
  'A+': 4.0, 'A': 4.0, 'A-': 3.75,
  'B+': 3.5, 'B': 3.0, 'B-': 2.75,
  'C+': 2.5, 'C': 2.0, 'C-': 1.75,
  'D': 1.0, 'F': 0.0,
  'P': null, 'I': null, 'W': null, 'NP': null, 'NG': null, 'NOT GRADED': null,
};

const CREDIT_MAP = {
  'communicative english language skills i': 3, 'general physics': 3,
  'general psychology': 3, 'mathematics for natural sciences': 3,
  'critical thinking': 3, 'geography of ethiopia and the horn': 3,
  'physical fitness': 0, 'communicative english language skills ii': 3,
  'social anthropology': 2, 'applied mathematics i': 3, 'entrepreneurship': 3,
  'introduction to emerging technologies': 3, 'moral and civic education': 2,
  'computer programming': 3, 'lab': 1, 'laboratory': 1, 'practical': 1,
  'project': 6, 'thesis': 6, 'research': 6, 'seminar': 1, 'internship': 3,
  'mathematics': 3, 'calculus': 3, 'statistics': 3, 'algebra': 3,
  'physics': 3, 'chemistry': 3, 'biology': 3, 'programming': 3, 'software': 3,
  'database': 3, 'network': 3, 'economics': 3, 'management': 3,
  'accounting': 3, 'marketing': 3, 'english': 3, 'communication': 3, 'language': 3,
  'data': 3, 'distributed': 3, 'mining': 3, 'warehousing': 3,
  'introduction to': 3, 'fundamental': 3, 'selected topics': 3,
};

function creditHours(name = '') {
  const n = String(name).toLowerCase();
  for (const [k, v] of Object.entries(CREDIT_MAP)) if (n.includes(k)) return v;
  return 3;
}

function gradeFromMark(m) {
  if (m >= 90) return 'A+'; if (m >= 85) return 'A'; if (m >= 80) return 'A-';
  if (m >= 75) return 'B+'; if (m >= 70) return 'B'; if (m >= 65) return 'B-';
  if (m >= 60) return 'C+'; if (m >= 50) return 'C'; if (m >= 45) return 'C-';
  if (m >= 40) return 'D'; return 'F';
}

function markValue(s) {
  if (!s || s === 'N/A') return null;
  const str = String(s).trim();
  if (str.includes('/')) {
    const [a, b] = str.split('/').map(parseFloat);
    if (b === 100 && a > 0 && a <= 100) return a;
    return null;
  }
  if (/^\d+(\.\d+)?$/.test(str)) { const n = parseFloat(str); return n > 0 && n <= 100 ? n : null; }
  return null;
}

function resolveGrade(course) {
  const g = String(course.grade || '').toUpperCase().trim();
  if (g && g !== 'NOT GRADED' && g !== '__' && g in GRADE_SCALE) {
    return { grade: g, point: GRADE_SCALE[g], estimated: false };
  }
  const mv = markValue(course.total_mark);
  if (mv != null) {
    const est = gradeFromMark(mv);
    return { grade: est, point: GRADE_SCALE[est], estimated: true };
  }
  return { grade: 'NG', point: null, estimated: false };
}

function summarizeSemester(semData) {
  const courses = (semData.courses || []).map(c => {
    const credit = creditHours(c.name);
    const { grade, point, estimated } = resolveGrade(c);
    return { ...c, credit, grade, point, estimated, gradePoints: point != null ? point * credit : 0 };
  });
  const counted = courses.filter(c => c.credit > 0 && c.point != null);
  const totalCredits = counted.reduce((a, c) => a + c.credit, 0);
  const totalPoints  = counted.reduce((a, c) => a + c.gradePoints, 0);

  // Prefer portal's own summary when available
  const sum = semData.summary || {};
  const portalSgpa = sum.sgpa != null ? parseFloat(sum.sgpa) : null;
  const portalCgpa = sum.cgpa != null ? parseFloat(sum.cgpa) : null;
  const portalScr  = sum.scr  != null ? parseFloat(sum.scr)  : null;
  const portalSgp  = sum.sgp  != null ? parseFloat(sum.sgp)  : null;

  const sgpa = !isNaN(portalSgpa) ? portalSgpa : (totalCredits ? totalPoints / totalCredits : null);
  return {
    courses, totalCredits, totalPoints, sgpa,
    portalSgpa: isNaN(portalSgpa) ? null : portalSgpa,
    portalCgpa: isNaN(portalCgpa) ? null : portalCgpa,
    portalScr:  isNaN(portalScr)  ? null : portalScr,
    portalSgp:  isNaN(portalSgp)  ? null : portalSgp,
    semesterStatus: sum.semester_status || null,
  };
}

module.exports = { GRADE_SCALE, creditHours, resolveGrade, summarizeSemester, markValue, gradeFromMark };
