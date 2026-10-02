// app/(dashboard)/ask/page.tsx
// Screen 5: Ask AI — multilingual voice + text chat
// Sends active farm context to /api/ai for contextual responses.
// Voice input via Web Speech API, voice output via SpeechSynthesis.
// Suggested questions adapt to selected language.

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';
import { useTranslation } from '@/lib/i18n/context';
import { getActiveFarmContext, type ActiveFarmContext } from '@/lib/utils/farm-storage';

// ── Types ──────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  source?: string;
}

// ── Helpers ────────────────────────────────────────────────

let _msgId = 0;
function nextId() { return String(++_msgId); }

function buildFarmContextPayload(farm: ActiveFarmContext) {
  return {
    crop: farm.crop,
    district: farm.district,
    state: farm.state,
    village: farm.village,
    areaHectares: farm.areaHectares,
    sowingDate: farm.sowingDate,
    ndvi: undefined as number | undefined,
    healthStatus: undefined as string | undefined,
    expectedYieldQPerHa: farm.expectedYieldQPerHa,
    totalHarvestQ: farm.totalHarvestQ,
    currentPrice: undefined as number | undefined,
    marketTrend: undefined as string | undefined,
    recommendedWindow: undefined as string | undefined,
    suggestedMandi: undefined as string | undefined,
    estimatedNetRealization: undefined as number | undefined,
    weatherSummary: undefined as string | undefined,
    dataSource: 'demo' as string,
  };
}

async function enrichFarmContext(basePayload: ReturnType<typeof buildFarmContextPayload>, farm: ActiveFarmContext) {
  const lat = farm.lat ?? 18.2333;
  const lng = farm.lng ?? 76.7167;

  // Fetch satellite data
  try {
    const satRes = await fetch(`/api/satellite?lat=${lat}&lng=${lng}`);
    if (satRes.ok) {
      const satJson = await satRes.json();
      if (satJson?.data) {
        basePayload.ndvi = satJson.data.latestNdvi;
        basePayload.healthStatus = satJson.data.latestStatus;
        if (satJson.source === 'live' || satJson.source === 'sentinel-hub') {
          basePayload.dataSource = 'live';
        }
      }
    }
  } catch { /* use defaults */ }

  // Fetch recommendations for selling context
  try {
    const recRes = await fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commodity: farm.commodity || farm.crop,
        district: farm.district,
        state: farm.state,
        areaHectares: farm.areaHectares,
        lat,
        lng,
        inputCostTotal: farm.inputCostTotal,
      }),
    });
    if (recRes.ok) {
      const recJson = await recRes.json();
      const d = recJson?.data;
      if (d) {
        basePayload.recommendedWindow = d.recommendedWindow;
        basePayload.suggestedMandi = d.suggestedMandi;
        basePayload.estimatedNetRealization = d.estimatedNetRealization;
        basePayload.currentPrice = d.scenarios?.[0]?.grossValue
          ? Math.round(d.scenarios[0].grossValue / (farm.totalHarvestQ || 1))
          : undefined;
        basePayload.marketTrend = d.riskLevel === 'low' ? 'rising' : d.riskLevel === 'moderate' ? 'stable' : 'falling';
      }
    }
  } catch { /* use defaults */ }

  // Fetch weather summary
  try {
    const wRes = await fetch(`/api/weather?lat=${lat}&lng=${lng}&action=forecast&days=3`);
    if (wRes.ok) {
      const wJson = await wRes.json();
      const days = wJson?.data?.days;
      if (Array.isArray(days) && days.length > 0) {
        const today = days[0];
        basePayload.weatherSummary = `Today: ${today.description || today.weatherCode || 'Clear'}, ${today.maxTempC ?? '--'}°C high, ${today.rainfallMm ?? 0}mm rain`;
      }
    }
  } catch { /* use defaults */ }

  return basePayload;
}

// ── SpeechRecognition types ────────────────────────────────

type SpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } | undefined } | undefined } }) => void) | null;
  start: () => void;
  stop: () => void;
};

// ── Component ──────────────────────────────────────────────

export default function AskPage() {
  const { t, locale, speechCode } = useTranslation();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [voiceSupported] = useState(() => {
    if (typeof window === 'undefined') return true;
    const win = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  });
  const [ttsSupported] = useState(() => {
    if (typeof window === 'undefined') return true;
    return 'speechSynthesis' in window;
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const farmRef = useRef<ActiveFarmContext | null>(null);
  const farmContextRef = useRef<ReturnType<typeof buildFarmContextPayload> | null>(null);

  // Initialize farm context (refs only, no setState)
  useEffect(() => {
    const farm = getActiveFarmContext();
    farmRef.current = farm;
    const payload = buildFarmContextPayload(farm);
    farmContextRef.current = payload;

    // Enrich asynchronously in background
    enrichFarmContext(payload, farm).then((enriched) => {
      farmContextRef.current = enriched;
    });
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // ── Send message ─────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: nextId(), role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsThinking(true);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          lang: locale,
          farmContext: farmContextRef.current || {},
        }),
      });

      const data = await res.json() as { reply: string; source?: string };
      const assistantMsg: Message = {
        id: nextId(),
        role: 'assistant',
        text: data.reply,
        source: data.source,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      // Network failure fallback
      const fallbackTexts: Record<string, string> = {
        mr: 'सध्या कनेक्शन उपलब्ध नाही. कृपया पुन्हा प्रयत्न करा.',
        hi: 'अभी कनेक्शन उपलब्ध नहीं है। कृपया दोबारा कोशिश करें।',
        en: 'Connection unavailable. Please try again.',
      };
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'assistant', text: fallbackTexts[locale] ?? fallbackTexts['en'], source: 'error' },
      ]);
    } finally {
      setIsThinking(false);
    }
  }, [locale]);

  // ── Voice Input ──────────────────────────────────────────

  const startVoice = useCallback(() => {
    if (!voiceSupported) {
      setVoiceError(t('ask.noVoice'));
      return;
    }
    setVoiceError('');

    const win = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SR = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SR) { setVoiceError(t('ask.noVoice')); return; }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = speechCode;

    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };
    recognition.onerror = (e) => {
      setIsListening(false);
      recognitionRef.current = null;
      if (e.error !== 'aborted') {
        setVoiceError(locale === 'mr'
          ? 'बोलणे समजले नाही. कृपया पुन्हा प्रयत्न करा किंवा टाइप करा.'
          : locale === 'hi'
          ? 'बोलना समझ नहीं आया। कृपया दोबारा बोलें या टाइप करें।'
          : 'Could not understand. Please try again or type your question.'
        );
      }
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript) sendMessage(transcript);
    };
    recognition.start();
  }, [voiceSupported, speechCode, locale, t, sendMessage]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  // ── Voice Output (TTS) ──────────────────────────────────

  const speakText = useCallback((text: string) => {
    if (!ttsSupported || typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechCode;
    utterance.rate = 0.9;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [speechCode, ttsSupported]);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  // ── Suggested questions ──────────────────────────────────

  const suggestedQuestions = [
    { key: 'q1', text: t('ask.q1') },
    { key: 'q2', text: t('ask.q2') },
    { key: 'q3', text: t('ask.q3') },
    { key: 'q4', text: t('ask.q4') },
  ];

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full px-4 pt-4 pb-2">
      {/* Title */}
      <div className="mb-4">
        <h2 className="text-xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>
          {t('ask.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('ask.voicePrompt')}
        </p>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-[200px]">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <span className="text-4xl">🎙️</span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              {t('ask.voicePrompt')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('ask.placeholder')}
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-1">
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'ml-auto bg-primary text-primary-foreground rounded-br-sm'
                  : 'mr-auto bg-card border border-border rounded-bl-sm'
              )}
            >
              {msg.text}
            </div>
            {/* TTS play/stop for assistant messages */}
            {msg.role === 'assistant' && ttsSupported && (
              <div className="flex items-center gap-1 mr-auto ml-1">
                <button
                  onClick={() => isSpeaking ? stopSpeaking() : speakText(msg.text)}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-muted"
                  aria-label={isSpeaking ? 'Stop speaking' : 'Play response'}
                >
                  {isSpeaking ? '⏹️' : '🔊'}{' '}
                  <span>{isSpeaking ? (locale === 'mr' ? 'थांबा' : locale === 'hi' ? 'रुकें' : 'Stop') : t('common.listen')}</span>
                </button>
                {msg.source && (
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full',
                    msg.source === 'demo' || msg.source === 'error'
                      ? 'bg-amber-50 text-amber-600 border border-amber-200'
                      : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  )}>
                    {msg.source === 'demo' ? 'Demo' : msg.source === 'gemini' ? 'AI' : msg.source === 'error' ? 'Offline' : msg.source}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
        {isThinking && (
          <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-3 bg-card border border-border">
            <p className="text-xs text-muted-foreground mb-1">{t('ask.thinking')}</p>
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggested questions */}
      {messages.length === 0 && (
        <div className="mb-3">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">
            {t('ask.suggestedQuestions')}
          </p>
          <div className="space-y-1.5">
            {suggestedQuestions.map((q) => (
              <button
                key={q.key}
                id={`suggested-q-${q.key}`}
                onClick={() => sendMessage(q.text)}
                className="w-full text-left text-sm px-3 py-2.5 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all duration-200"
              >
                <span className="text-foreground">{q.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Voice error / unsupported banner */}
      {voiceError && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
          {voiceError}
        </p>
      )}
      {!voiceSupported && messages.length === 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
          {t('ask.noVoice')}
        </p>
      )}

      {/* Input row */}
      <div className="flex gap-2 items-end bg-card border border-border rounded-2xl px-3 py-2">
        <textarea
          ref={textareaRef}
          id="ask-text-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage(inputText);
            }
          }}
          placeholder={t('ask.placeholder')}
          rows={1}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none leading-relaxed"
          style={{ minHeight: '24px', maxHeight: '120px' }}
        />
        <div className="flex gap-1.5 shrink-0">
          {/* Send button */}
          <button
            id="ask-send-button"
            onClick={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isThinking}
            className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors"
            aria-label="Send"
          >
            →
          </button>
          {/* Mic button */}
          <button
            id="ask-voice-button"
            onClick={isListening ? stopListening : startVoice}
            disabled={isThinking}
            className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200',
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
              !voiceSupported && 'opacity-40 cursor-not-allowed'
            )}
            aria-label={isListening ? 'Stop listening' : t('ask.speak')}
          >
            {isListening ? '⏹️' : '🎙️'}
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-muted-foreground text-center mt-1.5">
        {locale === 'mr'
          ? 'उत्तरे AI अंदाज आहेत. कृती करण्यापूर्वी खात्री करा.'
          : locale === 'hi'
          ? 'उत्तर AI अनुमान हैं। कृपया कार्य करने से पहले सत्यापित करें।'
          : 'Responses are AI-generated estimates. Verify before acting.'}
      </p>
    </div>
  );
}
