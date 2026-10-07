require('dotenv').config({ path: require('path').join(__dirname, '.env'), override: true });
const express = require('express');
const path = require('path');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

if (!KEY || KEY.includes('PASTE_YOUR')) {
  console.error('❌ .env madhe GROQ_API_KEY taka.');
  process.exit(1);
}

app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---- simple rate limit: per IP 20 requests / 10 min ----
const hits = new Map();
app.use('/api', (req, res, next) => {
  const now = Date.now();
  const arr = (hits.get(req.ip) || []).filter(t => now - t < 10 * 60 * 1000);
  if (arr.length >= 20) return res.status(429).json({ error: 'Khup requests. Thoda vel thamba.' });
  arr.push(now);
  hits.set(req.ip, arr);
  next();
});

// ---- Groq helper ----
async function askGroq(system, user, maxTokens = 4500) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      reasoning_effort: 'low',
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Groq error ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '{}';
  return JSON.parse(text);
}

const clean = (s, n = 500) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const LANGS = { english: 'English', hindi: 'Hindi', marathi: 'Marathi' };

// ---- 1) Education -> career suggestions ----
app.post('/api/careers', async (req, res) => {
  try {
    const education = clean(req.body.education, 200);
    if (!education) return res.status(400).json({ error: 'Education lihа.' });

    const system = `You are an expert career counsellor for students in India.
Return ONLY valid JSON: {"careers":[{"title":string,"why":string}]}.
Give 8 realistic, in-demand career options for the given education. "why" = one short sentence (max 15 words). English only.`;
    const data = await askGroq(system, `Education: ${education}`, 4000);
    res.json({ careers: Array.isArray(data.careers) ? data.careers.slice(0, 10) : [] });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'AI career suggestions ghetana error aala.' });
  }
});

// ---- 2) Full personalised roadmap ----
app.post('/api/roadmap', async (req, res) => {
  try {
    const name = clean(req.body.name, 60);
    const education = clean(req.body.education, 200);
    const goal = clean(req.body.goal, 200);
    const doneSoFar = clean(req.body.doneSoFar, 800);
    const location = clean(req.body.location, 60) || 'India';
    const language = LANGS[String(req.body.language || '').toLowerCase()] || 'English';

    if (!name || !education || !goal || !doneSoFar)
      return res.status(400).json({ error: 'Sagle fields bhara.' });

    const system = `You are a senior career mentor for students in India. Create a highly personalised roadmap.
Rules:
- Use what the person has ALREADY done: skip completed basics, start from their real level.
- Be specific, practical and honest. No fluff.
- Keep every description under 25 words so the JSON stays compact.
- NEVER output URLs. Only titles and short search queries.
- Write all descriptive text in ${language}. But keep these in English: jobTitles, searchQuery, platform, exam names, skill names.
- Salaries: estimated ranges in INR LPA for India, state they are estimates.
- Government route: set "available": false if no relevant government route exists for the goal.
Return ONLY valid JSON with exactly this shape:
{
 "goalTitle": string,
 "levelAssessment": string,
 "summary": string,
 "roadmap": [{"title":string,"description":string,"duration":string}],
 "skills": [{"name":string,"priority":"High"|"Medium"|"Low"}],
 "projects": [{"title":string,"description":string,"difficulty":"Beginner"|"Intermediate"|"Advanced"}],
 "studyNext": [{"topic":string,"why":string}],
 "interviewPrep": [{"topic":string,"tip":string}],
 "interviewQuestions": [string],
 "govRoute": {"available":boolean,"note":string,"exams":[{"name":string,"body":string,"eligibility":string}]},
 "salary": {"fresher":string,"mid":string,"senior":string,"note":string},
 "jobTitles": [string],
 "youtube": [{"topic":string,"searchQuery":string}],
 "courses": [{"title":string,"platform":string,"searchQuery":string,"free":boolean}]
}
Counts: roadmap 6-8, skills 8-12, projects 4-5, studyNext 4-6, interviewPrep 4-5, interviewQuestions 6-8, exams 0-5, jobTitles 4-6 (include 1-2 fresher/intern level), youtube 6-8, courses 5-7 (mix free and paid; platforms like Coursera, Udemy, NPTEL, freeCodeCamp, edX, YouTube).`;

    const user = `Name: ${name}
Education: ${education}
Goal: ${goal}
Done so far: ${doneSoFar}
Preferred job location: ${location}`;

    const data = await askGroq(system, user, 6500);
    res.json(data);
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'Roadmap banvtana error aala. Parat try kara.' });
  }
});

app.listen(PORT, () => console.log(`✅ Running: http://localhost:${PORT}`));
