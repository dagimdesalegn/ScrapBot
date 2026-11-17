const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const cheerio = require('cheerio');
const https = require('https');

const BASE_URL   = 'https://portal.ju.edu.et';
const LOGIN_URL  = `${BASE_URL}/login`;
const GRADES_URL = `${BASE_URL}/student/academic/grade`;

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

function makeClient(jar) {
  return wrapper(axios.create({
    jar, httpsAgent, timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
    validateStatus: () => true,
    maxRedirects: 5,
  }));
}

/** Authenticate against the portal. Returns { success, client, error? }. */
async function login(username, password) {
  const jar = new CookieJar();
  const client = makeClient(jar);

  const page = await client.get(LOGIN_URL);
  const $ = cheerio.load(page.data);
  const csrf = $('input[name="_token"]').val();
  if (!csrf) throw new Error('CSRF token not found');

  const body = new URLSearchParams({ username, password, _token: csrf }).toString();
  await client.post(LOGIN_URL, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  // Verify by hitting the grades page — must expose the semester select.
  const check = await client.get(GRADES_URL);
  const $$ = cheerio.load(check.data);
  const ok = $$('select[name="form[semester]"], select[name="semester"]').length > 0;
  if (!ok) return { success: false, error: 'Invalid credentials' };
  return { success: true, client };
}

/** Scrape the About block into a {label: value} map. */
async function getProfile(client) {
  const res = await client.get(GRADES_URL);
  const $ = cheerio.load(res.data);
  const profile = {};
  const about = $('small:contains("About")').first();
  if (about.length) {
    about.next('ul.list-unstyled').find('div.d-flex').each((_, el) => {
      const label = $(el).find('h6.mb-0').text().trim().replace(/:$/, '');
      const value = $(el).find('.ms-auto span').text().trim();
      if (label) profile[label] = value;
    });
  }
  return profile;
}

/** List semesters from the <select>. */
async function getSemesters(client) {
  const res = await client.get(GRADES_URL);
  const $ = cheerio.load(res.data);
  const select = $('select[name="form[semester]"], select[name="semester"]');
  if (!select.length) return [];
  const semesters = [];
  select.find('option').each((_, opt) => {
    const value = $(opt).attr('value');
    if (!value) return;
    const text = $(opt).text().trim();
    let year = 'N/A';
    if (text.includes(',')) year = text.split(',')[1].split('/')[0].trim();
    semesters.push({ value, text, year });
  });
  return semesters;
}

/** Fetch one semester: { courses: [...], summary: {...} }. */
async function getSemesterData(client, value, name) {
  const res = await client.get(GRADES_URL, {
    params: { semesterVal: value, semesterName: name },
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  });
  const [coursesHtml, summary] = res.data;
  const $ = cheerio.load(coursesHtml);
  const courses = [];

  $('.accordion-item').each((_, item) => {
    const titleBtn = $(item).find('.accordion-button').first();
    if (!titleBtn.length) return;
    const course = {
      name: titleBtn.text().trim(),
      assessments: [],
      total_mark: 'N/A',
      grade: 'N/A',
    };
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

/** Fetch all semesters in parallel batches of 4 (safe for Hobby). */
async function getAllSemestersWithData(client) {
  const semesters = await getSemesters(client);
  const out = [];
  const BATCH = 4;
  for (let i = 0; i < semesters.length; i += BATCH) {
    const batch = semesters.slice(i, i + BATCH);
    const settled = await Promise.allSettled(
      batch.map(s => getSemesterData(client, s.value, s.text))
    );
    settled.forEach((r, j) => {
      out.push({
        ...batch[j],
        data: r.status === 'fulfilled' ? r.value : { courses: [], summary: {} },
      });
    });
  }
  return out;
}

module.exports = {
  BASE_URL, LOGIN_URL, GRADES_URL,
  login, getProfile, getSemesters, getSemesterData, getAllSemestersWithData,
};