const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

const BASE_URL   = 'https://portal.ju.edu.et';
const LOGIN_URL  = `${BASE_URL}/login`;
const GRADES_URL = `${BASE_URL}/student/academic/grade`;
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

// Vercel's commercial TLS profile ignores https.Agent rejectUnauthorized in
// some edge builds. This env var is the reliable off-switch. Safe here because
// the process ONLY talks to portal.ju.edu.et.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

function makeClient(jar) {
  return wrapper(axios.create({
    jar,
    httpsAgent: agent,
    timeout: 20000,
    validateStatus: () => true,
    maxRedirects: 10,
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
    },
  }));
}

async function login(username, password) {
  const jar = new CookieJar();
  const client = makeClient(jar);

  const page = await client.get(LOGIN_URL);
  const $ = cheerio.load(page.data || '');
  const csrf = $('input[name="_token"]').val();
  console.log('[portal] GET /login', page.status, 'csrf:', csrf ? 'ok' : 'MISSING');
  if (!csrf) return { ok: false, error: 'Portal login page not recognized', status: 502 };

  const body = new URLSearchParams({ username, password, _token: csrf }).toString();
  const post = await client.post(LOGIN_URL, body, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: LOGIN_URL,
      Origin: BASE_URL,
    },
  });
  const postUrl = post.request?.res?.responseUrl || '';
  const $p = cheerio.load(post.data || '');
  const jarCookies = (jar.serializeSync()?.cookies || []).map(c => c.key);
  console.log('[portal] POST /login', post.status, '→', postUrl);
  console.log('[portal] cookies:', jarCookies.join(',') || '(none)');

  // Still on login form? Credentials rejected.
  if (/\/login(\?|#|$)/i.test(postUrl) && $p('#formAuthentication').length > 0) {
    return { ok: false, error: 'Invalid username or password', status: 401 };
  }

  // Verify by fetching /grade. Logged-in page has #form_semester or .layout-page.
  const check = await client.get(GRADES_URL);
  const checkUrl = check.request?.res?.responseUrl || '';
  const $c = cheerio.load(check.data || '');
  const authed = $c('#form_semester').length > 0 || $c('.layout-page').length > 0;
  console.log('[portal] GET /grade', check.status, '→', checkUrl, '| authed:', authed);

  if (!authed) return { ok: false, error: 'Portal rejected the session — network may be blocked.', status: 502 };
  return { ok: true, jar };
}

async function getProfile(jar) {
  const client = makeClient(jar);
  const res = await client.get(GRADES_URL);
  if (res.status >= 400) throw new Error('Portal rejected session');
  const $ = cheerio.load(res.data || '');
  const profile = {};

  const photo = $('.layout-navbar img[alt="user image"]').first().attr('src') || '';
  if (photo) profile._photo = photo;

  const about = $('small').filter((_, el) => $(el).text().trim() === 'About').first();
  if (about.length) {
    about.next('ul.list-unstyled').children('div.d-flex').each((_, el) => {
      const label = $(el).find('h6.mb-0').text().trim().replace(/:$/, '');
      const value = $(el).find('.ms-auto span').text().trim();
      if (label) profile[label] = value;
    });
  }
  return profile;
}

async function getSemesters(jar) {
  const client = makeClient(jar);
  const res = await client.get(GRADES_URL);
  if (res.status >= 400) throw new Error('Portal rejected session');
  const $ = cheerio.load(res.data || '');
  const select = $('#form_semester, select[name="form[semester]"], select[name="semester"]');
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

async function getSemesterData(jar, value, name) {
  const client = makeClient(jar);
  const res = await client.get(GRADES_URL, {
    params: { semesterVal: value, semesterName: name },
    headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: GRADES_URL },
  });
  if (res.status >= 400) throw new Error('Portal rejected session');

  // Response is [htmlString, summaryObj]
  const arr = Array.isArray(res.data) ? res.data : [res.data, {}];
  const [html, summary] = arr;
  const $ = cheerio.load(typeof html === 'string' ? html : '');
  const courses = [];

  $('.accordion-item').each((_, item) => {
    const btn = $(item).find('.accordion-button').first();
    if (!btn.length) return;
    const course = { name: btn.text().trim(), assessments: [], total_mark: 'N/A', grade: 'N/A' };
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

async function getAllSemesters(jar, concurrency = 4) {
  const semesters = await getSemesters(jar);
  const out = new Array(semesters.length);
  let i = 0;
  async function worker() {
    while (true) {
      const j = i++;
      if (j >= semesters.length) return;
      const s = semesters[j];
      try { out[j] = { ...s, data: await getSemesterData(jar, s.value, s.text) }; }
      catch (e) { out[j] = { ...s, data: { courses: [], summary: {} }, error: e.message }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, semesters.length) }, worker));
  return out;
}

module.exports = { login, getProfile, getSemesters, getSemesterData, getAllSemesters };
