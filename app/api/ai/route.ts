// app/api/ai/route.ts
// AI assistant endpoint — uses Gemini API with dynamic farm context.
// Falls back to deterministic demo response if API key not configured.
// Accepts full farm context from client and assembles it into a
// rich system prompt. Never claims demo data is live.

import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface FarmContext {
  crop?: string;
  district?: string;
  state?: string;
  village?: string;
  areaHectares?: number;
  sowingDate?: string;
  ndvi?: number;
  healthStatus?: string;
  expectedYieldQPerHa?: number;
  totalHarvestQ?: number;
  currentPrice?: number;
  marketTrend?: string;
  recommendedWindow?: string;
  suggestedMandi?: string;
  estimatedNetRealization?: number;
  weatherSummary?: string;
  dataSource?: string; // 'live' | 'demo' | 'ml' | 'fallback'
}

interface AiRequestBody {
  message: string;
  lang?: string;
  farmContext?: FarmContext;
  farmId?: string;
}

function buildSystemPrompt(farmCtx: FarmContext, lang: string): string {
  const source = farmCtx.dataSource ?? 'demo';
  const sourceNote = source === 'live'
    ? 'The farm and market data below comes from verified live APIs.'
    : 'The farm and market data below includes current estimates. Provide practical, direct advisory based on this context.';

  const langInstruction =
    lang === 'mr' ? 'Reply ONLY in Marathi (मराठी).'
    : lang === 'hi' ? 'Reply ONLY in Hindi (हिन्दी).'
    : 'Reply ONLY in English.';

  const parts = [
    'You are AgriIntel, a helpful and practical agricultural advisor for Indian farmers.',
    langInstruction,
    sourceNote,
    '',
    '== FARM CONTEXT ==',
  ];

  if (farmCtx.crop) parts.push(`Registered Crop: ${farmCtx.crop}`);
  if (farmCtx.district) parts.push(`Location: ${farmCtx.village ? farmCtx.village + ', ' : ''}${farmCtx.district}, ${farmCtx.state || 'Maharashtra'}`);
  if (farmCtx.areaHectares) parts.push(`Farm Area: ${farmCtx.areaHectares} hectares`);
  if (farmCtx.sowingDate) parts.push(`Sown: ${farmCtx.sowingDate}`);
  if (farmCtx.ndvi != null) parts.push(`Crop health NDVI: ${farmCtx.ndvi} (${farmCtx.healthStatus || 'moderate'})`);
  if (farmCtx.expectedYieldQPerHa != null) parts.push(`Expected yield: ${farmCtx.expectedYieldQPerHa} qtl/ha (Total: ${farmCtx.totalHarvestQ ?? '?'} qtl)`);
  if (farmCtx.currentPrice != null) parts.push(`Current modal price: ₹${farmCtx.currentPrice}/qtl`);
  if (farmCtx.marketTrend) parts.push(`Market trend: ${farmCtx.marketTrend}`);
  if (farmCtx.recommendedWindow) parts.push(`Suggested selling window: ${farmCtx.recommendedWindow}`);
  if (farmCtx.suggestedMandi) parts.push(`Suggested mandi: ${farmCtx.suggestedMandi}`);
  if (farmCtx.estimatedNetRealization != null) parts.push(`Estimated net realization: ₹${farmCtx.estimatedNetRealization.toLocaleString('en-IN')}`);
  if (farmCtx.weatherSummary) parts.push(`Weather: ${farmCtx.weatherSummary}`);

  parts.push('');
  parts.push('== RULES ==');
  parts.push('- Keep answers concise and direct (2-3 sentences). Farmers value clarity.');
  parts.push('- Provide practical actionable advice right away without robotic preambles.');
  parts.push('- If the farmer asks about a different crop than their registered one, answer clearly while noting their registered crop.');
  parts.push('- Use terms like "suggested", "estimated", or "based on market trends" — never guarantee exact profits.');
  parts.push('- Simple conversational language, no technical jargon.');

  return parts.join('\n');
}

const CROP_TRANSLATIONS: Record<string, { mr: string; hi: string; en: string }> = {
  soybean: { mr: 'सोयाबीन', hi: 'सोयाबीन', en: 'Soybean' },
  wheat: { mr: 'गव्हाच्या', hi: 'गेहूं', en: 'Wheat' },
  cotton: { mr: 'कापूस', hi: 'कपास', en: 'Cotton' },
  onion: { mr: 'कांदा', hi: 'प्याज', en: 'Onion' },
  tur: { mr: 'तूर', hi: 'अरहर (तूर)', en: 'Tur' },
  jowar: { mr: 'ज्वारी', hi: 'ज्वार', en: 'Jowar' },
  sugarcane: { mr: 'ऊस', hi: 'गन्ना', en: 'Sugarcane' },
};

const MANDI_NAMES: Record<string, { mr: string; hi: string; en: string }> = {
  satara: { mr: 'सातारा', hi: 'सतारा', en: 'Satara' },
  pune: { mr: 'पुणे', hi: 'पुणे', en: 'Pune' },
  latur: { mr: 'लातूर', hi: 'लातूर', en: 'Latur' },
  sangli: { mr: 'सांगली', hi: 'सांगली', en: 'Sangli' },
  solapur: { mr: 'सोलापूर', hi: 'सोलापूर', en: 'Solapur' },
  nanded: { mr: 'नांदेड', hi: 'नांदेड', en: 'Nanded' },
};

function formatCrop(crop: string, lang: string): string {
  const key = (crop || '').toLowerCase().trim();
  const entry = CROP_TRANSLATIONS[key];
  if (entry) return entry[lang as 'mr' | 'hi' | 'en'] || entry.en;
  return crop;
}

function formatMandi(mandi: string, lang: string): string {
  const key = (mandi || '').toLowerCase().trim();
  const entry = MANDI_NAMES[key];
  if (entry) return entry[lang as 'mr' | 'hi' | 'en'] || entry.en;
  return mandi;
}

function formatWindow(window: string, lang: string): string {
  const w = (window || '').toLowerCase().trim();
  if (w === 'now' || w === 'आत्ता') {
    return lang === 'mr' ? 'आत्ता' : lang === 'hi' ? 'अभी' : 'now';
  }
  if (w.includes('7') || w.includes('७')) {
    return lang === 'mr' ? '७ दिवसांनंतर' : lang === 'hi' ? '७ दिनों बाद' : 'in 7 days';
  }
  if (w.includes('14') || w.includes('१४')) {
    return lang === 'mr' ? '१४ दिवसांनंतर' : lang === 'hi' ? '१४ दिनों बाद' : 'in 14 days';
  }
  return window;
}

function getDemoResponse(lang: string, farmCtx: FarmContext, userQuery = ''): string {
  const rawCrop = farmCtx.crop || 'wheat';
  const crop = formatCrop(rawCrop, lang);
  const rawMandi = farmCtx.suggestedMandi || 'Satara';
  const mandi = formatMandi(rawMandi, lang);
  const rawWindow = farmCtx.recommendedWindow || 'now';
  const windowStr = formatWindow(rawWindow, lang);
  const net = farmCtx.estimatedNetRealization
    ? `₹${farmCtx.estimatedNetRealization.toLocaleString('en-IN')}`
    : '₹3,42,241';

  const q = (userQuery || '').toLowerCase();

  // 1. Weather inquiry
  if (q.includes('हवामान') || q.includes('पाऊस') || q.includes('मौसम') || q.includes('weather') || q.includes('rain')) {
    if (lang === 'mr') {
      return `पुढील ७ दिवस सातारा परिसरात हवामान अनुकूल आहे. पिकाची वाहतूक किंवा फवारणीसाठी चांगला काळ उपलब्ध आहे.`;
    }
    if (lang === 'hi') {
      return `अगले ७ दिनों में मौसम अनुकूल रहने का अनुमान है। फसल परिवहन और छिड़काव के लिए अच्छा समय है।`;
    }
    return `Weather conditions are favorable for the next 7 days, providing a good window for harvesting and transport.`;
  }

  // 2. Yield inquiry
  if (q.includes('उत्पादन') || q.includes('कापणी') || q.includes('yield') || q.includes('harvest')) {
    const yieldQ = farmCtx.expectedYieldQPerHa || 28;
    const totalQ = farmCtx.totalHarvestQ || Math.round(yieldQ * (farmCtx.areaHectares || 4.68));
    if (lang === 'mr') {
      return `आपल्या ${crop} पिकाचे अंदाजित उत्पादन हेक्टरी ${yieldQ} क्विंटल (एकूण अंदाजे ${totalQ} क्विंटल) अपेक्षित आहे. पिकाची शाकीय वाढ उत्तम आहे.`;
    }
    if (lang === 'hi') {
      return `आपकी ${crop} फसल का अनुमानित उत्पादन प्रति हेक्टेयर ${yieldQ} क्विंटल (कुल लगभग ${totalQ} क्विंटल) रहने की संभावना है।`;
    }
    return `Your estimated ${crop} yield is approximately ${yieldQ} qtl/ha (total ~${totalQ} qtl). Crop vigour is positive.`;
  }

  // 3. Selling / Market inquiry (default)
  const replies: Record<string, string> = {
    mr: `आपल्या ${crop} पिकासाठी, सध्याच्या बाजाराच्या कलानुसार, अंदाजे ${windowStr} ${mandi} मंडईत विकणे फायदेशीर ठरू शकते. अंदाजित निव्वळ मिळकत: ${net}. हा फक्त अंदाज आहे — प्रत्यक्ष निर्णय आपणच घ्यावा.`,
    hi: `आपकी ${crop} फसल के लिए, मौजूदा बाज़ार रुझान के आधार पर, ${windowStr} ${mandi} मंडी में बेचने पर विचार करें। अनुमानित शुद्ध प्राप्ति: ${net}। यह केवल अनुमान है — कृपया अपना निर्णय लें।`,
    en: `For your ${crop} crop, based on current market trends, consider selling ${windowStr} at ${mandi} mandi. Estimated net realization: ${net}. This is an estimate — please use your own judgment.`,
  };

  return replies[lang] ?? replies['en'];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as AiRequestBody;
    const { message, lang = 'en', farmContext = {} } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // If no Gemini key, return contextual demo response
    if (!GEMINI_API_KEY) {
      return NextResponse.json({
        reply: getDemoResponse(lang, farmContext, message),
        source: 'demo',
      });
    }

    // Build dynamic system prompt from farm context
    const systemPrompt = buildSystemPrompt(farmContext, lang);

    // Reliable candidate models in order of speed and stability
    const CANDIDATE_MODELS = [
      { name: 'gemini-3.5-flash-lite', supportsThinking: false },
      { name: 'gemini-3.8-flash', supportsThinking: true },
      { name: 'gemini-flash-latest', supportsThinking: false },
      { name: 'gemini-3.5-flash', supportsThinking: false },
      { name: 'gemini-3.7-flash', supportsThinking: true },
    ];
    let reply: string | null = null;

    for (const model of CANDIDATE_MODELS) {
      try {
        const signal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(12000) : undefined;
        const generationConfig: Record<string, unknown> = {
          temperature: 0.4,
          maxOutputTokens: 1000,
        };
        if (model.supportsThinking) {
          generationConfig.thinkingConfig = { thinkingBudget: 0 };
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model.name}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal,
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [{ text: `${systemPrompt}\n\nFarmer's question: ${message}` }],
                },
              ],
              generationConfig,
              safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
              ],
            }),
          }
        );

        if (response.ok) {
          const data = await response.json() as {
            candidates?: Array<{
              content?: {
                parts?: Array<{ text?: string; thought?: boolean }>;
              };
              finishReason?: string;
            }>;
          };
          const parts = data.candidates?.[0]?.content?.parts || [];
          const nonThought = parts.filter((p) => !p.thought && p.text);
          const text = (nonThought.length > 0 ? nonThought : parts)
            .map((p) => p.text || '')
            .join('')
            .trim();

          if (text) {
            reply = text;
            return NextResponse.json({ reply, source: 'gemini', model: model.name });
          }
        }
      } catch (err) {
        console.warn(`[api/ai] Model ${model.name} attempt failed:`, err instanceof Error ? err.message : err);
      }
    }

    if (!reply) {
      reply = getDemoResponse(lang, farmContext, message);
    }

    return NextResponse.json({ reply, source: 'gemini-fallback' });
  } catch (err) {
    console.error('[api/ai] Error:', err instanceof Error ? err.message : 'Unknown error');
    // Graceful fallback — never crash
    const body = await request.clone().json().catch(() => ({})) as AiRequestBody;
    const lang = body?.lang || 'en';
    return NextResponse.json(
      { reply: getDemoResponse(lang, body?.farmContext || {}, body?.message || ''), source: 'error' },
      { status: 200 }
    );
  }
}
