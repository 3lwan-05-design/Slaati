// Slati AI — free, keyless question answering for the Learn tab.
// Flow: DuckDuckGo + Wikipedia (both CORS-friendly, no key) for web context,
// then the free Pollinations text API (OpenAI-compatible, keyless) to compose
// an accurate answer in the user's language, citing the sources we found.

const LANGUAGE_NAMES = { ar: 'Arabic', fr: 'French', en: 'English' };

function buildSystemPrompt(language) {
  const lang =
    language === 'ar' ? 'Moroccan Darija (الدارجة المغربية)' : LANGUAGE_NAMES[language] || 'English';
  return [
    `You are "Slati AI", a careful Islamic study companion built into the Slati Pro app.`,
    `Rules:`,
    `- ALWAYS answer in ${lang} only.`,
    `- The user may write in Moroccan Darija (الدارجة المغربية); understand it and reply in Moroccan Darija.`,
    `- Answer the question directly first, then add short, clear supporting detail (bullets or short paragraphs).`,
    `- Base religious answers on the Quran and the authentic (sahih) Sunnah first, then reputable scholars and fatwa sources (Al-Azhar, IslamWeb, etc.).`,
    `- Use the WEB SEARCH CONTEXT below when it helps, and when you use it, name the source site clearly.`,
    `- Accuracy over speed: if you are not sure, say "I am not certain" instead of guessing. Never invent hadith grades, narrators, or Quran verse numbers.`,
    `- Keep a friendly, respectful, concise tone. No long intros, no filler.`,
    `- Format answers as PLAIN TEXT: use numbered/bulleted lists and short paragraphs. Do NOT use markdown asterisks (**bold**) or backticks — the app renders plain text.`,
    `- For personal legal rulings, remind the user kindly that a trusted scholar is the final reference — you are for learning.`,
  ].join('\n');
}

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`http-${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Returns [{ title, text, url }] from DuckDuckGo instant answers + Wikipedia search.
export async function searchWeb(query, language = 'en') {
  const found = [];

  const wikiLang = language === 'ar' ? 'ar' : language === 'fr' ? 'fr' : 'en';
  try {
    const url =
      `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search` +
      `&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=4`;
    const data = await fetchJson(url);
    for (const hit of (data?.query?.search || [])) {
      found.push({
        title: hit.title,
        text: stripHtml(hit.snippet),
        url: `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(String(hit.title).replace(/ /g, '_'))}`,
      });
    }
  } catch (e) {
    // Wikipedia is optional context — ignore failures.
  }

  try {
    const url =
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}` +
      `&format=json&no_redirect=1&no_html=1&skip_disambig=1&origin=*`;
    const data = await fetchJson(url);
    if (data?.AbstractText) {
      found.unshift({
        title: data.Heading || data.AbstractSource || 'DuckDuckGo',
        text: stripHtml(data.AbstractText),
        url: data.AbstractURL || '',
      });
    }
    for (const rel of (data?.RelatedTopics || []).slice(0, 5)) {
      const text = rel.Text || '';
      if (text) {
        found.push({
          title: (text.split(' - ')[0] || 'DuckDuckGo').slice(0, 80),
          text: stripHtml(text),
          url: rel.FirstURL || '',
        });
      }
    }
  } catch (e) {
    // DuckDuckGo is optional context — ignore failures.
  }

  return found
    .filter((item) => item.text && item.text.length > 20)
    .slice(0, 7);
}

function buildContext(results) {
  if (!results.length) return '';
  const lines = results.map(
    (r, i) => `[${i + 1}] ${r.title}: ${r.text}${r.url ? ` (${r.url})` : ''}`
  );
  // Keep the context compact — a huge prompt makes the free endpoint slow.
  return `WEB SEARCH CONTEXT:\n${lines.join('\n')}`.slice(0, 2800);
}

const POLLINATIONS_POST = 'https://text.pollinations.ai/openai';
const POLLINATIONS_GET = 'https://text.pollinations.ai/';

// POST is primary; give it a shorter timeout so we can fall back to GET
// faster when Pollinations is slow (it's a free, keyless endpoint).
async function postPollinations(messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(POLLINATIONS_POST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages,
        temperature: 0.3,
        private: true,
        referrer: 'slati-pro',
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`http-${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || '';
  } finally {
    clearTimeout(timer);
  }
}

async function getPollinations(prompt) {
  const controller = new AbortController();
  // GET is the fallback; give it a bit more room than the POST attempt.
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const url = `${POLLINATIONS_GET}${encodeURIComponent(prompt.slice(0, 3500))}?model=openai&private=true&referrer=slati-pro`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`http-${res.status}`);
    const text = (await res.text()).trim();
    return text.replace(/^"|"$/g, '');
  } finally {
    clearTimeout(timer);
  }
}

// Ask the AI. Returns { text, sources } or throws { code: 'network' | 'ai' }.
// `image` is an optional data-URL (data:image/...;base64,...) for vision questions.
export async function askAI(question, { language = 'en', history = [], image = null } = {}) {
  const cleanQuestion = String(question || '').trim();
  if (!cleanQuestion) throw new Error('empty');

  let results = [];
  try {
    results = await searchWeb(cleanQuestion, language);
  } catch (e) {
    results = [];
  }

  const context = buildContext(results);
  const system = buildSystemPrompt(language) + (context ? `\n\n${context}` : '');

  const messages = [
    { role: 'system', content: system },
    ...history.slice(-6).map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text,
    })),
    { role: 'user', content: image
      ? [{ type: 'text', text: cleanQuestion || 'Describe this image.' }, { type: 'image_url', image_url: { url: image } }]
      : cleanQuestion },
  ];

  let text = '';
  try {
    text = await postPollinations(messages);
  } catch (e) {
    text = '';
  }

  // Pollinations is a free keyless endpoint and is sometimes busy (503).
  // One quick retry often succeeds before we fall back to the GET route.
  if (!text) {
    await new Promise((r) => setTimeout(r, 1200));
    try {
      text = await postPollinations(messages);
    } catch (e) {
      text = '';
    }
  }

  if (!text) {
    // Fallback: simple GET prompt (some networks block POST bodies).
    const prompt =
      `${buildSystemPrompt(language)}\n\n${context}\n\nQuestion: ${cleanQuestion}\nAnswer:`;
    try {
      text = await getPollinations(prompt);
    } catch (e) {
      text = '';
    }
  }

  if (!text) {
    // Last resort: Pollinations is down. Compose a plain-text answer from the
    // web results directly so the user still gets accurate, sourced information.
    if (results.length) {
      const lines = results.slice(0, 4).map((r) => {
        const host = (() => {
          try {
            return r.url ? new URL(r.url).hostname.replace(/^www\./, '') : '';
          } catch (e) {
            return '';
          }
        })();
        return `${r.title}${host ? ` (${host})` : ''}: ${r.text}`;
      });
      text =
        `Here is what reliable sources say about your question:\n\n` +
        lines.join('\n\n');
    }
  }

  if (!text) {
    const fallback =
      language === 'ar'
        ? 'ما قدرت نجاوب الآن (مشكلة في الشبكة). حاول مرة أخرى بعد لحظات، أو اطرح السؤال بأسلوب آخر.'
        : language === 'fr'
        ? 'Je ne peux pas répondre pour le moment (problème réseau). Réessayez dans un instant.'
        : 'I cannot answer right now (network issue). Please try again in a moment.';
    text = fallback;
  }

  return { text, sources: results.filter((r) => r.url).slice(0, 4) };
}
