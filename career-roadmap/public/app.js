const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
const enc = encodeURIComponent;
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const arr = x => (Array.isArray(x) ? x : []);

async function api(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}
function setBusy(btn, busy, text) {
  if (busy) { btn.dataset.old = btn.innerHTML; btn.innerHTML = `<span class="spinner"></span>${text}`; btn.disabled = true; }
  else { btn.innerHTML = btn.dataset.old; btn.disabled = false; }
}
function showError(msg) { const e = $('error'); e.textContent = msg || ''; e.style.display = msg ? 'block' : 'none'; }

// ---------- link builders (links are built by code, never by AI) ----------
const youtubeLink = q => `https://www.youtube.com/results?search_query=${enc(q)}`;
function courseUrl(platform, q) {
  const p = (platform || '').toLowerCase();
  if (p.includes('coursera')) return `https://www.coursera.org/search?query=${enc(q)}`;
  if (p.includes('udemy')) return `https://www.udemy.com/courses/search/?q=${enc(q)}`;
  if (p.includes('edx')) return `https://www.edx.org/search?q=${enc(q)}`;
  if (p.includes('freecodecamp')) return `https://www.freecodecamp.org/news/search/?query=${enc(q)}`;
  if (p.includes('youtube')) return youtubeLink(q);
  if (p.includes('nptel') || p.includes('swayam')) return `https://www.google.com/search?q=${enc(q + ' NPTEL SWAYAM')}`;
  return `https://www.google.com/search?q=${enc(q + ' ' + platform + ' course')}`;
}
function jobLinks(title, loc) {
  const s = slug(title), l = slug(loc || 'india');
  return [
    ['LinkedIn', `https://www.linkedin.com/jobs/search/?keywords=${enc(title)}&location=${enc(loc || 'India')}`],
    ['Naukri', `https://www.naukri.com/${s}-jobs-in-${l}`],
    ['Indeed', `https://in.indeed.com/jobs?q=${enc(title)}&l=${enc(loc || 'India')}`],
    ['Internshala', `https://internshala.com/jobs/keywords-${s}`],
    ['Google Jobs', `https://www.google.com/search?q=${enc(title + ' jobs in ' + (loc || 'India'))}&ibp=htl;jobs`]
  ];
}

// ---------- 1) career suggestions ----------
async function suggestCareers() {
  const education = $('education').value.trim();
  if (!education) { showError('Aadhi education lihа.'); $('education').focus(); return; }
  showError('');
  const btn = $('careerBtn');
  setBusy(btn, true, 'AI vichar karat ahe...');
  try {
    const { careers } = await api('/api/careers', { education });
    $('careerOptionsBox').style.display = 'block';
    $('careerOptions').innerHTML = arr(careers).map(c =>
      `<div class="resource pick" data-career="${esc(c.title)}"><h4>🎯 ${esc(c.title)}</h4><p class="small">${esc(c.why)}</p></div>`
    ).join('');
    document.querySelectorAll('.pick').forEach(el => el.addEventListener('click', () => {
      $('careerGoal').value = el.dataset.career;
      $('careerGoal').focus();
    }));
  } catch (e) { showError(e.message); }
  setBusy(btn, false);
}

// ---------- 2) full roadmap ----------
async function buildRoadmap() {
  const body = {
    name: $('name').value.trim(),
    education: $('education').value.trim(),
    goal: $('careerGoal').value.trim(),
    doneSoFar: $('doneSoFar').value.trim(),
    location: $('location').value.trim(),
    language: $('language').value
  };
  if (!body.name || !body.education || !body.goal || !body.doneSoFar) { showError('Sagle fields bhara.'); return; }
  showError('');
  const btn = $('goBtn');
  setBusy(btn, true, 'Roadmap banat ahe (10-20 sec)...');
  try {
    const d = await api('/api/roadmap', body);
    render(d, body);
  } catch (e) { showError(e.message); }
  setBusy(btn, false);
}

function render(d, body) {
  $('goalTitle').textContent = d.goalTitle || body.goal;
  $('intro').innerHTML = `<h3>👋 ${esc(body.name)}</h3><p><b>Tumcha current level:</b> ${esc(d.levelAssessment)}</p><p style="margin-top:8px">${esc(d.summary)}</p>`;

  $('roadmapSteps').innerHTML = arr(d.roadmap).map((s, i) =>
    `<div><b>Step ${i + 1}: ${esc(s.title)}</b> <span class="tag">⏱ ${esc(s.duration)}</span><p>${esc(s.description)}</p></div>`).join('');

  $('skills').innerHTML = arr(d.skills).map(s =>
    `<span class="tag ${esc(String(s.priority || '').toLowerCase())}">${esc(s.name)} • ${esc(s.priority)}</span>`).join('');

  $('projects').innerHTML = arr(d.projects).map(p =>
    `<div><b>${esc(p.title)}</b> <span class="tag">${esc(p.difficulty)}</span><p>${esc(p.description)}</p></div>`).join('');

  $('studyNext').innerHTML = arr(d.studyNext).map(s =>
    `<div><b>${esc(s.topic)}</b><p>${esc(s.why)}</p></div>`).join('');

  $('courses').innerHTML = arr(d.courses).map(c =>
    `<div class="resource"><h4>🎓 ${esc(c.title)}</h4><p class="small">${esc(c.platform)} • ${c.free ? '🆓 Free' : '💲 Paid'}</p><a href="${courseUrl(c.platform, c.searchQuery || c.title)}" target="_blank" rel="noopener">Find course →</a></div>`).join('');

  $('youtube').innerHTML = arr(d.youtube).map(y =>
    `<div class="resource"><h4>▶️ ${esc(y.topic)}</h4><p class="small">${esc(y.searchQuery)}</p><a href="${youtubeLink(y.searchQuery || y.topic)}" target="_blank" rel="noopener">Watch on YouTube →</a></div>`).join('');

  $('jobs').innerHTML = arr(d.jobTitles).map(t =>
    `<div class="jobcard"><h4>💼 ${esc(t)}</h4>${jobLinks(t, body.location).map(([n, u]) => `<a class="linkbtn" href="${u}" target="_blank" rel="noopener">${n} →</a>`).join('')}</div>`).join('');

  $('interviewPrep').innerHTML = arr(d.interviewPrep).map(i =>
    `<div><b>${esc(i.topic)}</b><p>${esc(i.tip)}</p></div>`).join('');
  $('questions').innerHTML = arr(d.interviewQuestions).map(q => `<li>${esc(q)}</li>`).join('');

  const g = d.govRoute || {};
  const exams = arr(g.exams);
  $('govRoute').innerHTML = `<p>${esc(g.note)}</p>` + (g.available && exams.length
    ? `<div class="resource-grid">${exams.map(x =>
        `<div class="resource"><h4>🏛️ ${esc(x.name)}</h4><p class="small">${esc(x.body)}</p><p>${esc(x.eligibility)}</p><a href="https://www.google.com/search?q=${enc(x.name + ' official notification')}" target="_blank" rel="noopener">Official info →</a></div>`).join('')}</div>
       <div class="gov-note"><b>Important:</b> Eligibility ani vacancies badlu shaktat. Nehmi latest official notification pahа.</div>`
    : '');

  const s = d.salary || {};
  $('salary').innerHTML = `<div class="resource-grid">
    <div class="resource"><h4>🌱 Fresher</h4><p>${esc(s.fresher)}</p></div>
    <div class="resource"><h4>🚀 Mid-level</h4><p>${esc(s.mid)}</p></div>
    <div class="resource"><h4>🏆 Senior</h4><p>${esc(s.senior)}</p></div></div>
    <p class="small" style="margin-top:8px">${esc(s.note)} (AI estimate, job posting var verify kara.)</p>`;

  $('result').style.display = 'block';
  $('result').scrollIntoView({ behavior: 'smooth' });
}

// ---------- events ----------
$('careerBtn').addEventListener('click', suggestCareers);
$('goBtn').addEventListener('click', buildRoadmap);
$('name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('education').focus(); } });
$('education').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); suggestCareers(); } });
$('careerGoal').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('doneSoFar').focus(); } });
