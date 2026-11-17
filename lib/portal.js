const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

const BASE_URL   = 'https://portal.ju.edu.et';
const LOGIN_URL  = `${BASE_URL}/login`;
const GRADES_URL = `${BASE_URL}/student/academic/grade`;

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function makeClient(cookies = {}) {
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  return axios.create({
    httpsAgent,
    timeout: 15000,
    validateStatus: () => true,
    maxRedirects: 5,
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
  });
}

/** Merge Set-Cookie headers from one or more axios responses. */
function mergeCookies(...responses) {
  const jar = {};
  for (const r of responses) {
    if (!r) continue;
    const set = r.headers && r.headers['set-cookie'];
    if (!set) continue;
    const arr = Array.isArray(set) ? set : [set];
    for (const sc of arr) {
      const first = sc.split(';')[0];
      const eq = first.indexOf('=');
      if (eq < 0) continue;
      const k = first.slice(0, eq).trim();
      const v = first.slice(eq + 1);
      if (!k) continue;
      jar[k] = v;
    }
  }
  return jar;
}

async function login(username, password) {
  const client = makeClient();
  const page = await client.get(LOGIN_URL);
  const $ = cheerio.load(page.data || '');
  const csrf = $('input[name="_token"]').val();
  if (!csrf) throw new Error('CSRF token missing — portal HTML changed');

  const body = new URLSearchParams({ username, password, _token: csrf }).toString();
  const post = await client.post(LOGIN_URL, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': LOGIN_URL },
  });

  const cookies = mergeCookies(page, post);
  const authedClient = makeClient(cookies);
  const check = await authedClient.get(GRADES_URL);
  const $c = cheerio.load(check.data || '');
  if ($c('select[name="form[semester]"], select[name="semester"]').length === 0) {
    return { ok: false, error: 'Invalid username or password' };
  }
  return { ok: true, cookies };
}

/** Scrape profile from the About sidebar. */
async function getProfile(cookies) {
  const client = makeClient(cookies);
  const res = await client.get(GRADES_URL);
  if (res.status >= 400) throw new Error('Portal rejected session');
  const $ = cheerio.load(res.data);
  const profile = {};
  const about = $('small').filter((_, el) => $(el).text().trim() === 'About').first();
  if (about.length) {
    about.next('ul.list-unstyled').find('div.d-flex').each((_, el) => {
      const label = $(el).find('h6.mb-0').text().trim().replace(/:$/, '');
      const value = $(el).find('.ms-auto span').text().trim();
      if (label) profile[label] = value;
    });
  }
  return profile;
}

async function getSemesters(cookies) {
  const client = makeClient(cookies);
  const res = await client.get(GRADES_URL);
  if (res.status >= 400) throw new Error('Portal rejected session');
  const $ = cheerio.load(res.data);
  const select = $('select[name="form[semester]"], select[name="semester"]');
  if (!select.length) return [];
  const out = [];
  select.find('option').each((_, opt) => {
    const value = $(opt).attr('value');
    if (!value) return;
    const text = $(opt).text().trim();
    let year = 'N/A';
    if (text.includes(',')) year = text.split(',')[1].split('/')[0].trim();
    out.push({ value, text, year });
  });
  return out;
}

async function getSemesterData(cookies, value, name) {
  const client = makeClient(cookies);
  const res = await client.get(GRADES_URL, {
    params: { semesterVal: value, semesterName: name },
    headers: { 'X-Requested-With': 'XMLHttpRequest', 'Referer': GRADES_URL },
  });
  if (res.status >= 400) throw new Error('Portal rejected session');
  const [coursesHtml, summary] = res.data;
  const $ = cheerio.load(coursesHtml || '');
  const courses = [];

  $('.accordion-item').each((_, item) => {
    const titleBtn = $(item).find('.accordion-button').first();
    if (!titleBtn.length) return;
    const course = { name: titleBtn.text().trim(), assessments: [], total_mark: 'N/A', grade: 'N/A' };
    const table = $(item).find('.accordion-body table').first();
    if (table.length) {
      table.find('tbody tr').each((_, tr) => {
        if ($(tr).hasClass('text-bold')) return;
        const cells = $(tr).find('th, td');
        if (cells.length >= 4) {
          course.assessments.push({
            name: $(cells[0]).text().trim(),
            mark: $(cells[1]).text().trim(),
            max: $(cells[2]).text().trim(),
            percentage: $(cells[3]).text().trim(),
          });
        }
      });
      const total = table.find('tr.text-bold').first();
      if (total.length) {
        const cells = total.find('td, th');
        if (cells.length >= 4) {
          course.total_mark = $(cells[1]).text().trim();
          const g = $(cells[3]).text().trim();
          course.grade = g === '__' ? 'Not Graded' : g;
        }
      }
    }
    courses.push(course);
  });

  return { courses, summary: summary || {} };
}

/** Parallel fetch with concurrency cap. */
async function getAllSemesters(cookies, concurrency = 5) {
  const semesters = await getSemesters(cookies);
  const out = new Array(semesters.length);
  let idx = 0;

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= semesters.length) return;
      const s = semesters[i];
      try {
        const data = await getSemesterData(cookies, s.value, s.text);
        out[i] = { ...s, data };
      } catch (e) {
        out[i] = { ...s, data: { courses: [], summary: {} }, error: e.message };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, semesters.length) }, worker);
  await Promise.all(workers);
  return out;
}

module.exports = { login, getProfile, getSemesters, getSemesterData, getAllSemesters };
