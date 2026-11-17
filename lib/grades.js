// Mirrors the bot's grading rules (Jimma University).
const GRADE_SCALE = {
  'A+': 4.0, 'A': 4.0, 'A-': 3.75,
  'B+': 3.5, 'B': 3.0, 'B-': 2.75,
  'C+': 2.5, 'C': 2.0, 'C-': 1.75,
  'D': 1.0, 'F': 0.0,
  'I': null, 'W': null, 'P': null, 'NP': null, 'NOT GRADED': null,
};

// Used for ECTS approximation + GPA credit weighting.
const CREDIT_MAP = {
  'communicative english language skills i': 3,
  'general physics': 3, 'general psychology': 3,
  'mathematics for natural sciences': 3,
  'critical thinking': 3,
  'geography of ethiopia and the horn': 3,
  'physical fitness': 0,
  'communicative english language skills ii': 3,
  'social anthropology': 2,
  'applied mathematics i': 3,
  'entrepreneurship': 3,
  'introduction to emerging technologies': 3,
  'moral and civic education': 2,
  'computer programming': 3,
  'lab': 1, 'laboratory': 1, 'practical': 1,
  'project': 6, 'thesis': 6, 'research': 6,
  'seminar': 1, 'internship': 3, 'fieldwork': 3, 'clinical': 3,
  'mathematics': 3, 'calculus': 3, 'statistics': 3, 'algebra': 3,
  'physics': 3, 'chemistry': 3, 'biology': 3,
  'programming': 3, 'software': 3, 'database': 3, 'network': 3,
  'economics': 3, 'management': 3, 'accounting': 3, 'marketing': 3,
  'english': 3, 'communication': 3, 'language': 3,
  'default': 3,
};

function creditHours(name = '') {
  const n = String(name).toLowerCase();
  for (const [k, v] of Object.entries(CREDIT_MAP)) if (k !== 'default' && n.includes(k)) return v;
  if (/\b(lab|laboratory|practical)\b/.test(n)) return 1;
  if (/\b(project|thesis|research)\b/.test(n)) return 6;
  return 3;
}

function gradeFromMark(mark) {
  if (mark >= 90) return 'A+';
  if (mark >= 85) return 'A';
  if (mark >= 80) return 'A-';
  if (mark >= 75) return 'B+';
  if (mark >= 70) return 'B';
  if (mark >= 65) return 'B-';
  if (mark >= 60) return 'C+';
  if (mark >= 50) return 'C';
  if (mark >= 45) return 'C-';
  if (mark >= 40) return 'D';
  return 'F';
}

function markValue(totalMark) {
  if (!totalMark || totalMark === 'N/A') return null;
  const s = String(totalMark).trim();
  if (s.includes('/')) {
    const [m, mx] = s.split('/').map(x => parseFloat(x));
    if (mx === 100 && m > 0 && m <= 100) return m;
    return null;
  }
  if (/^\d+(\.\d+)?$/.test(s)) {
    const m = parseFloat(s);
    return m > 0 && m <= 100 ? m : null;
  }
  return null;
}

/** Resolve final grade for a course (official first, then estimate). */
function resolveGrade(course) {
  const official = String(course.grade || '').toUpperCase().trim();
  if (official && official in GRADE_SCALE && official !== 'NOT GRADED') {
    return { grade: official, point: GRADE_SCALE[official], estimated: false };
  }
  const mv = markValue(course.total_mark);
  if (mv != null) {
    const g = gradeFromMark(mv);
    return { grade: g, point: GRADE_SCALE[g], estimated: true };
  }
  return { grade: 'NG', point: null, estimated: false };
}

function summarizeSemester(semData) {
  const courses = (semData.courses || []).map(c => {
    const credit = creditHours(c.name);
    const { grade, point, estimated } = resolveGrade(c);
    const gradePoints = point != null ? point * credit : 0;
    return { ...c, credit, grade, point, estimated, gradePoints };
  });
  const counted = courses.filter(c => c.credit > 0 && c.point != null);
  const totalCredits = counted.reduce((a, c) => a + c.credit, 0);
  const totalPoints  = counted.reduce((a, c) => a + c.gradePoints, 0);
  const sgpa = totalCredits > 0 ? totalPoints / totalCredits : null;
  return { courses, totalCredits, totalPoints, sgpa };
}

module.exports = { GRADE_SCALE, creditHours, resolveGrade, summarizeSemester, markValue, gradeFromMark };