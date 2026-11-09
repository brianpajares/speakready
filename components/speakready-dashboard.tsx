"use client";

import {
  Activity,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Flame,
  Headphones,
  Home,
  Info,
  Languages,
  Lightbulb,
  LockKeyhole,
  Mic,
  Pause,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Volume2,
  Waves,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { analyzeTranscript } from "@/lib/engine";
import { type Locale, messages } from "@/lib/i18n";
import { type Goal, getPrompt, type Level } from "@/lib/prompts";

type View = "home" | "practice" | "progress";
type Step = "setup" | "record" | "analysis" | "result";
type Metrics = ReturnType<typeof analyzeTranscript>;
type SessionRecord = Metrics & { id: number; date: string };

const STORAGE_KEY = "speakready:local-practice-v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const EMPTY_SESSIONS: SessionRecord[] = [];
const sessionListeners = new Set<() => void>();
let cachedSessionText: string | null | undefined;
let cachedSessions: SessionRecord[] = EMPTY_SESSIONS;
const DAY_LABELS: Record<Locale, string[]> = {
  es: ["L", "M", "X", "J", "V", "S", "D"],
  en: ["M", "T", "W", "T", "F", "S", "S"],
  pt: ["S", "T", "Q", "Q", "S", "S", "D"],
};

function getSessionsSnapshot(): SessionRecord[] {
  if (typeof window === "undefined") return EMPTY_SESSIONS;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === cachedSessionText) return cachedSessions;
    cachedSessionText = saved;
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    cachedSessions = Array.isArray(parsed) ? (parsed as SessionRecord[]) : EMPTY_SESSIONS;
  } catch {
    cachedSessions = EMPTY_SESSIONS;
  }
  return cachedSessions;
}

function getServerSessionsSnapshot() {
  return EMPTY_SESSIONS;
}

function subscribeToSessions(listener: () => void) {
  sessionListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    sessionListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function writeSessions(next: SessionRecord[]) {
  cachedSessions = next;
  cachedSessionText = JSON.stringify(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, cachedSessionText);
  } catch {
    // The session still works if browser storage is unavailable.
  }
  sessionListeners.forEach((listener) => listener());
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function goalName(goal: Goal, t: (typeof messages)[Locale]) {
  if (goal === "interview") return t.jobInterview;
  if (goal === "exam") return t.oralExam;
  return t.everyday;
}

function levelName(level: Level, t: (typeof messages)[Locale]) {
  if (level === "A2") return t.levelA2;
  if (level === "B1") return t.levelB1;
  return t.levelB2;
}

function WeekChart({ sessions, locale, large = false, now }: { sessions: SessionRecord[]; locale: Locale; large?: boolean; now: number }) {
  const values = useMemo(() => {
    const today = new Date(now);
    const mondayOffset = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(today.getDate() - mondayOffset);
    return DAY_LABELS[locale].map((label, index) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + index);
      const count = sessions.filter((session) => new Date(session.date).toDateString() === day.toDateString()).length;
      return { label, count, today: day.toDateString() === today.toDateString() };
    });
  }, [locale, now, sessions]);
  const max = Math.max(1, ...values.map((item) => item.count));

  return (
    <div className={large ? "large-chart" : "chart"} role="img" aria-label={locale === "es" ? "Prácticas por día de esta semana" : locale === "pt" ? "Práticas por dia nesta semana" : "Practices by day this week"}>
      {values.map((item, index) => (
        <div className="chart-day" key={`${item.label}-${index}`}>
          <div
            className={`chart-column${item.count ? " has-value" : ""}${item.today && item.count ? " today" : ""}`}
            style={{ height: `${Math.max(5, (item.count / max) * 88)}%` }}
            title={`${item.count}`}
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <Waves size={20} strokeWidth={2.2} />
    </span>
  );
}

export function SpeakReadyDashboard({ locale, now }: { locale: Locale; now: number }) {
  const t = messages[locale];
  const localeTag = locale === "es" ? "es-PE" : locale === "pt" ? "pt-BR" : "en-US";
  const router = useRouter();
  const [view, setView] = useState<View>("home");
  const [step, setStep] = useState<Step>("setup");
  const [goal, setGoal] = useState<Goal>("interview");
  const [level, setLevel] = useState<Level>("B1");
  const [promptIndex, setPromptIndex] = useState(0);
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [ageConsent, setAgeConsent] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [micError, setMicError] = useState("");
  const [transcriptError, setTranscriptError] = useState("");
  const sessions = useSyncExternalStore(subscribeToSessions, getSessionsSnapshot, getServerSessionsSnapshot);
  const [result, setResult] = useState<Metrics | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  useEffect(() => {
    if (!isRecording || isPaused) return;
    const timer = window.setInterval(() => {
      setActiveSeconds((current) => {
        if (current >= 119) {
          window.setTimeout(stopRecording, 0);
          return 120;
        }
        return current + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRecording, isPaused, stopRecording]);

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const thisWeek = useMemo(() => {
    const currentTime = Math.max(now, Date.now());
    return sessions.filter((session) => {
      const sessionTime = new Date(session.date).getTime();
      return sessionTime <= currentTime && currentTime - sessionTime < 7 * DAY_MS;
    });
  }, [now, sessions]);
  const weeklyMinutes = Math.round(thisWeek.reduce((sum, session) => sum + session.duration, 0) / 60);
  const weekGoal = 2;
  const currentPrompt = getPrompt(locale, goal, level, promptIndex);

  function beginPractice(nextGoal?: Goal) {
    if (nextGoal) setGoal(nextGoal);
    setView("practice");
    setStep("setup");
    setMicError("");
    setTranscriptError("");
  }

  function clearAudio() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }

  async function startRecording() {
    setMicError("");
    setTranscriptError("");
    if (!voiceConsent || !ageConsent) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicError(t.micUnavailable);
      return;
    }
    try {
      clearAudio();
      setTranscript("");
      setResult(null);
      setActiveSeconds(0);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const nextUrl = URL.createObjectURL(blob);
        setAudioUrl(nextUrl);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setIsRecording(false);
        setIsPaused(false);
        setStep("analysis");
      };
      recorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
      setIsPaused(false);
      setStep("record");
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setMicError(t.microphoneError);
    }
  }

  function togglePause() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === "recording") {
      recorder.pause();
      setIsPaused(true);
    } else if (recorder.state === "paused") {
      recorder.resume();
      setIsPaused(false);
    }
  }

  function completeAnalysis() {
    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 8) {
      setTranscriptError(t.transcriptNeeded);
      return;
    }
    const metrics = analyzeTranscript(transcript, activeSeconds || 1);
    const session: SessionRecord = { ...metrics, id: Date.now(), date: new Date().toISOString() };
    const nextSessions = [session, ...sessions].slice(0, 70);
    writeSessions(nextSessions);
    setResult(metrics);
    setStep("result");
    setTranscriptError("");
  }

  function resetPractice() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    clearAudio();
    setStep("setup");
    setActiveSeconds(0);
    setTranscript("");
    setResult(null);
    setIsRecording(false);
    setIsPaused(false);
    setMicError("");
    setTranscriptError("");
  }

  function switchLanguage(next: string) {
    if (next === locale) return;
    router.push(`/${next}`);
  }

  function renderNavItem({ id, icon, label }: { id: View; icon: ReactNode; label: string }) {
    return (
      <button className={`nav-item${view === id ? " active" : ""}`} onClick={() => setView(id)} aria-current={view === id ? "page" : undefined}>
        <span className="nav-icon" aria-hidden="true">{icon}</span>{label}
      </button>
    );
  }

  const goalCards: { id: Goal; icon: ReactNode; label: string; hint: string }[] = [
    { id: "interview", icon: <BriefcaseBusiness size={17} />, label: t.jobInterview, hint: t.goalInterviewHint },
    { id: "exam", icon: <BookOpen size={17} />, label: t.oralExam, hint: t.goalExamHint },
    { id: "everyday", icon: <Headphones size={17} />, label: t.everyday, hint: t.goalDailyHint },
  ];

  function renderGoalCards({ compact = false }: { compact?: boolean } = {}) {
    return (
      <div className="goal-grid">
        {goalCards.map((card) => (
          <button
            type="button"
            className={`goal-card${goal === card.id ? " selected" : ""}`}
            key={card.id}
            aria-pressed={goal === card.id}
            onClick={() => compact ? beginPractice(card.id) : setGoal(card.id)}
          >
            <span className="goal-card-icon" aria-hidden="true">{card.icon}</span>
            <strong>{card.label}</strong>
            <small>{card.hint}</small>
            <span className="goal-check" aria-hidden="true"><Check size={12} /></span>
          </button>
        ))}
      </div>
    );
  }

  function renderFooter() {
    return (
      <footer className="footer">
        <span>{t.footerLine}</span>
        <div className="footer-right"><span>{t.noAffiliation}</span><span>© {new Date().getFullYear()} SpeakReady · Zone Digital</span></div>
      </footer>
    );
  }

  function renderHomeView() {
    const dayFormat = new Intl.DateTimeFormat(localeTag, { weekday: "long", day: "numeric", month: "long" });
    const dateText = dayFormat.format(new Date(now));
    return (
      <>
        <div className="greeting-row">
          <div className="eyebrow"><span className="eyebrow-dot" />{t.today}</div>
          <div className="date-note">{dateText}</div>
        </div>
        <section className="hero" aria-labelledby="welcome-title">
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles size={13} />{t.appLabel}</div>
            <h1 id="welcome-title">{t.welcome}</h1>
            <p>{t.welcomeBody}</p>
            <div className="hero-actions">
              <button className="button-primary" onClick={() => beginPractice()}>{t.startPractice}<ArrowRight size={15} /></button>
              <button className="button-quiet" onClick={() => setView("progress")}>{t.viewProgress}<ArrowRight size={14} /></button>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit" />
            <div className="voice-disc"><div className="voice-disc-core"><AudioWave /></div></div>
            <div className="wave">{Array.from({ length: 25 }, (_, index) => <i key={index} style={{ height: `${10 + ((index * 19) % 37)}px` }} />)}</div>
          </div>
        </section>

        <div className="stat-grid" aria-label={t.practiceGoal}>
          <div className="stat-card">
            <div><div className="stat-label">{t.practiceCount}</div><div className="stat-value">{thisWeek.length}<small>/ {weekGoal} {t.practices}</small></div><div className="stat-foot">{t.practiceGoal}</div></div>
            <span className="stat-icon"><Target size={17} /></span>
          </div>
          <div className="stat-card">
            <div><div className="stat-label">{t.speakingTime}</div><div className="stat-value">{weeklyMinutes}<small>{t.minutes}</small></div><div className="stat-foot">{t.weeklyChartBody}</div></div>
            <span className="stat-icon peach"><Clock3 size={17} /></span>
          </div>
          <div className="stat-card">
            <div><div className="stat-label">{t.fluency}</div><div className="stat-value">{thisWeek.length ? Math.round(thisWeek.reduce((sum, session) => sum + session.fluency, 0) / thisWeek.length) : "—"}<small>/ 100</small></div><div className="stat-foot">{thisWeek.length ? t.analysisSubtitle : t.samplePlan}</div></div>
            <span className="stat-icon blue"><Flame size={17} /></span>
          </div>
        </div>

        <div className="content-grid">
          <section className="card card-pad" aria-labelledby="next-session-title">
            <div className="card-heading">
              <div><h2 className="card-title" id="next-session-title">{t.nextSession}</h2><p className="card-subtitle">{t.readyBody}</p></div>
              <span className="tag"><Sparkles size={11} />{t.sample}</span>
            </div>
            <div className="question-box">
              <div className="question-meta"><BriefcaseBusiness size={13} />{goalName(goal, t)}<span>·</span>{levelName(level, t)}</div>
              <p className="question-text">{currentPrompt}</p>
              <div className="question-actions">
                <button className="button-solid" onClick={() => beginPractice()}>{t.startPractice}<ArrowRight size={14} /></button>
                <button className="button-text" onClick={() => setPromptIndex((index) => index + 1)}>{t.changeQuestion}<RotateCcw size={12} /></button>
              </div>
            </div>
          </section>
          <section className="card card-pad week-card" aria-labelledby="week-title">
            <div className="card-heading">
              <div><h2 className="card-title" id="week-title">{t.weeklyChart}</h2><p className="card-subtitle">{t.weeklyChartBody}</p></div>
              <span className="chart-meta"><CalendarDays size={13} />7 {locale === "es" ? "días" : locale === "pt" ? "dias" : "days"}</span>
            </div>
              <WeekChart sessions={sessions} locale={locale} now={now} />
            <div className="chart-foot"><span>{thisWeek.length ? t.practiceCount : t.noPractice}</span><strong>{thisWeek.length}/{weekGoal} {t.practices}</strong></div>
          </section>
        </div>

        <div className="section-row"><div><h2>{t.explore}</h2><p>{t.chooseGoal}</p></div><button className="button-text" onClick={() => beginPractice()}>{t.continue}<ArrowRight size={13} /></button></div>
        {renderGoalCards({ compact: true })}
        <div className="bottom-banner">
          <div className="bottom-banner-copy"><span className="banner-symbol"><Lightbulb size={17} /></span><div><strong>{t.weeklyFocus}</strong><p>{t.weeklyFocusBody}</p></div></div>
          <button className="button-outline" onClick={() => beginPractice()}>{t.startPractice}<ArrowRight size={13} /></button>
        </div>
      </>
    );
  }

  function renderPracticeView() {
    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
    return (
      <>
        <div className="page-header">
          <div><div className="eyebrow"><span className="eyebrow-dot" />{t.practice}</div><h1>{step === "result" ? t.analysisTitle : t.readyToSpeak}</h1><p>{step === "result" ? t.analysisSubtitle : t.readyBody}</p></div>
          {step !== "setup" && <button className="button-outline" onClick={resetPractice}><RotateCcw size={14} />{t.recordAgain}</button>}
        </div>

        <div className="practice-layout">
          <section className="card practice-main-card" aria-label={t.practice}>
            <div className="step-label"><span className="step-number">{step === "setup" ? "1" : step === "record" ? "2" : step === "analysis" ? "3" : <Check size={12} />}</span>{step === "setup" ? t.chooseGoal : step === "record" ? t.recording : step === "analysis" ? t.yourTranscript : t.analysisTitle}</div>
            {step === "setup" && (
              <>
                <h2>{t.readyToSpeak}</h2><p>{t.readyBody}</p>
                  <div className="choice-group"><div className="choice-label">{t.chooseGoal}<span>01 / 03</span></div>{renderGoalCards()}</div>
                <div className="choice-group"><div className="choice-label">{t.chooseLevel}<span>{t.levelHint}</span></div>
                  <div className="segmented" role="group" aria-label={t.chooseLevel}>
                    {(["A2", "B1", "B2"] as const).map((option) => <button key={option} type="button" className={`segment${level === option ? " active" : ""}`} aria-pressed={level === option} onClick={() => setLevel(option)}>{option} · {levelName(option, t)}</button>)}
                  </div>
                </div>
                <div className="question-prompt">
                  <div className="prompt-top"><span>{t.questionOfDay}</span><span>{level} · 01:00–02:00</span></div>
                  <p className="prompt-title">{currentPrompt}</p>
                  <p className="prompt-note">{goalName(goal, t)} · {t.sample}</p>
                </div>
                <div className="privacy-box">
                  <span className="privacy-icon"><ShieldCheck size={16} /></span>
                  <div><strong>{t.privacyTitle}</strong><p>{t.privacyBody}</p></div>
                </div>
                <div className="consent-list">
                  <label className="consent-row"><input type="checkbox" checked={voiceConsent} onChange={(event) => setVoiceConsent(event.target.checked)} /><span>{t.consentVoice}</span></label>
                  <label className="consent-row"><input type="checkbox" checked={ageConsent} onChange={(event) => setAgeConsent(event.target.checked)} /><span>{t.consentAge}</span></label>
                </div>
                <div className="record-actions"><button className="button-solid" disabled={!voiceConsent || !ageConsent} onClick={startRecording}><Mic size={15} />{t.record}</button></div>
                {!voiceConsent || !ageConsent ? <div className="inline-alert"><LockKeyhole size={14} />{t.consentNeeded}</div> : null}
                {micError && <div className="inline-alert" role="alert"><Info size={14} />{micError}</div>}
              </>
            )}

            {step === "record" && (
              <>
                <h2>{currentPrompt}</h2><p>{t.recordingHelp}</p>
                <div className="record-panel">
                  <div className={`record-ring${isRecording && !isPaused ? " live" : ""}`}><button className="record-button" aria-label={t.stop} onClick={stopRecording}><span className="visually-hidden">{t.stop}</span><span style={{ display: "block", width: 17, height: 17, borderRadius: 4, background: "white" }} /></button></div>
                  <h3>{isPaused ? t.resume : t.recording}</h3><p>{t.recordingHelp}</p>
                  <div className="timer" aria-live="off">{formatDuration(activeSeconds)}</div>
                  <div className="record-actions">
                    <button className="button-outline" onClick={togglePause}>{isPaused ? <Mic size={14} /> : <Pause size={14} />}{isPaused ? t.resume : t.pause}</button>
                    <button className="button-solid" onClick={stopRecording}><span style={{ width: 8, height: 8, borderRadius: 2, background: "white" }} />{t.stop}</button>
                  </div>
                </div>
                <div className="inline-alert"><ShieldCheck size={14} />{t.privacyTitle}. {t.speechPattern}</div>
              </>
            )}

            {step === "analysis" && (
              <>
                <h2>{t.yourTranscript}</h2><p>{t.transcriptHelp}</p>
                {audioUrl && <audio className="audio-player" controls src={audioUrl} aria-label={t.recording} />}
                <label className="visually-hidden" htmlFor="transcript">{t.yourTranscript}</label>
                <textarea id="transcript" className="transcript" value={transcript} onChange={(event) => { setTranscript(event.target.value); setTranscriptError(""); }} placeholder={t.transcriptPlaceholder} maxLength={5000} />
                <div className="transcript-foot"><span>{t.transcriptHelp}</span><span>{wordCount} {locale === "es" ? "palabras" : locale === "pt" ? "palavras" : "words"}</span></div>
                {transcriptError && <div className="inline-alert" role="alert"><Info size={14} />{transcriptError}</div>}
                <div className="record-actions" style={{ justifyContent: "space-between" }}><span className="chart-meta"><Timer size={13} />{formatDuration(activeSeconds)}</span><button className="button-solid" disabled={wordCount < 8} onClick={completeAnalysis}>{t.analyze}<ArrowRight size={14} /></button></div>
              </>
            )}

            {step === "result" && result && (
              <>
                <h2>{t.analysisTitle}</h2><p>{t.analysisSubtitle}</p>
                <div className="analysis-grid">
                  <div className="metric-card"><div className="metric-label">{t.fluency}</div><div className="metric-number">{result.fluency}<small>/ 100</small></div><div className="metric-track"><span style={{ width: `${result.fluency}%` }} /></div></div>
                  <div className="metric-card"><div className="metric-label">{t.cleanSpeech}</div><div className="metric-number">{result.cleanSpeech}<small>/ 100</small></div><div className="metric-track"><span style={{ width: `${result.cleanSpeech}%` }} /></div></div>
                  <div className="metric-card"><div className="metric-label">{t.pace}</div><div className="metric-number">{result.wpm}<small>{t.wordsPerMinute}</small></div><div className="metric-track"><span style={{ width: `${Math.min(100, Math.max(4, (result.wpm / 220) * 100))}%` }} /></div></div>
                  <div className="metric-card"><div className="metric-label">{t.fillers}</div><div className="metric-number">{result.fillers}<small>{t.fillers}</small></div><div className="metric-track"><span style={{ width: `${Math.max(5, 100 - result.cleanSpeech)}%` }} /></div></div>
                </div>
                <div className="pron-pending"><span className="pron-pending-icon"><Volume2 size={16} /></span><div><strong>{t.pronunciation} · {t.pronunciationPending}</strong><p>{t.pronunciationNote}</p></div></div>
                <div className="result-tip"><span className="result-tip-icon"><Lightbulb size={16} /></span><div><strong>{t.nextTip}</strong><p>{result.wpm < 110 ? (locale === "es" ? "Añade un ejemplo concreto y conecta tus ideas con frases cortas." : locale === "pt" ? "Adicione um exemplo concreto e conecte suas ideias com frases curtas." : "Add one concrete example and connect your ideas with short phrases.") : result.wpm > 165 ? (locale === "es" ? "Prueba una pausa breve entre ideas para que cada punto se entienda mejor." : locale === "pt" ? "Faça uma pausa breve entre ideias para que cada ponto fique mais claro." : "Try a short pause between ideas so each point lands clearly.") : (locale === "es" ? "Tu ritmo está en un rango cómodo. Practica cerrar con una frase que resuma tu idea." : locale === "pt" ? "Seu ritmo está em uma faixa confortável. Pratique terminar com uma frase que resuma sua ideia." : "Your pace is in a comfortable range. Practice ending with one sentence that sums up your point.")}{result.fillers > 0 ? (locale === "es" ? " Reemplaza algunas muletillas con una pausa tranquila." : locale === "pt" ? " Troque algumas muletas por uma pausa tranquila." : " Replace a few fillers with a calm pause.") : ""}</p></div></div>
                <div className="record-actions" style={{ justifyContent: "space-between" }}><button className="button-outline" onClick={() => { setView("home"); setStep("setup"); clearAudio(); }}>{t.finish}</button><button className="button-solid" onClick={resetPractice}><RotateCcw size={14} />{t.recordAgain}</button></div>
                <p className="fine-print">{t.resultDisclaimer} {t.speechPattern}</p>
              </>
            )}
          </section>

          <aside className="card aside-card" aria-label={t.weeklyFocus}>
            <span className="tag"><Sparkles size={11} />{t.weeklyFocus}</span>
            <h3 style={{ marginTop: 16 }}>{t.weeklyFocusBody}</h3>
            <p>{t.exampleBody}</p>
            <div className="tip-list">
              <div className="tip-item"><span className="tip-dot">1</span><div><strong>{locale === "es" ? "Una idea" : locale === "pt" ? "Uma ideia" : "One idea"}</strong><p>{locale === "es" ? "Responde directamente a la pregunta." : locale === "pt" ? "Responda diretamente à pergunta." : "Answer the question directly."}</p></div></div>
              <div className="tip-item"><span className="tip-dot">2</span><div><strong>{locale === "es" ? "Un ejemplo" : locale === "pt" ? "Um exemplo" : "One example"}</strong><p>{locale === "es" ? "Cuenta un detalle real que haga concreta tu respuesta." : locale === "pt" ? "Conte um detalhe real para deixar sua resposta concreta." : "Add a real detail that makes your answer concrete."}</p></div></div>
              <div className="tip-item"><span className="tip-dot">3</span><div><strong>{locale === "es" ? "Un cierre" : locale === "pt" ? "Um fechamento" : "One close"}</strong><p>{locale === "es" ? "Termina con lo que aprendiste o con tu conclusión." : locale === "pt" ? "Termine com o que aprendeu ou com sua conclusão." : "Finish with what you learned or your conclusion."}</p></div></div>
            </div>
            <div className="aside-divider" />
            <div style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 10 }}><LockKeyhole size={14} />{t.speechPattern}</div>
          </aside>
        </div>
      </>
    );
  }

  function renderProgressView() {
    const average = thisWeek.length ? Math.round(thisWeek.reduce((sum, session) => sum + session.fluency, 0) / thisWeek.length) : null;
    return (
      <>
        <section className="progress-banner">
          <div className="eyebrow"><Award size={13} />{t.progress}</div>
          <h1>{t.progressTitle}</h1>
          <p>{t.progressBody}</p>
        </section>
        <div className="progress-layout">
          <section className="card card-pad" aria-labelledby="progress-chart-title">
            <div className="card-heading"><div><h2 className="card-title" id="progress-chart-title">{t.weeklyChart}</h2><p className="card-subtitle">{t.weeklyChartBody}</p></div><span className="chart-meta"><CalendarDays size={13} />7 {locale === "es" ? "días" : locale === "pt" ? "dias" : "days"}</span></div>
            <WeekChart sessions={sessions} locale={locale} large now={now} />
            {thisWeek.length === 0 && <div className="empty-chart">{t.noPractice}</div>}
          </section>
          <section className="card card-pad">
            <div className="card-heading"><div><h2 className="card-title">{t.practiceGoal}</h2><p className="card-subtitle">{t.weeklyFocus}</p></div><span className="stat-icon"><Target size={16} /></span></div>
            <div style={{ marginTop: 20 }}>
              <div className="progress-side-stat"><span>{t.practiceCount}</span><strong>{thisWeek.length}/{weekGoal}</strong></div>
              <div className="progress-side-stat"><span>{t.speakingTime}</span><strong>{weeklyMinutes} {t.minutes}</strong></div>
              <div className="progress-side-stat"><span>{t.fluency}</span><strong>{average === null ? "—" : `${average}/100`}</strong></div>
            </div>
            <div className="goal-track" style={{ marginTop: 17 }}><div className="goal-fill" style={{ width: `${Math.min(100, (thisWeek.length / weekGoal) * 100)}%` }} /></div>
            <button className="button-solid" style={{ marginTop: 19, width: "100%" }} onClick={() => beginPractice()}>{t.startPractice}<ArrowRight size={14} /></button>
          </section>
        </div>
      </>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <button className="brand" style={{ border: 0, background: "none", textAlign: "left", cursor: "pointer" }} onClick={() => setView("home")}>
          <BrandMark /><span><span className="brand-name">SpeakReady</span><span className="brand-sub">BY ZONE DIGITAL</span></span>
        </button>
        <div className="side-caption">{t.appLabel}</div>
        <nav className="side-nav" aria-label={t.home}>
          {renderNavItem({ id: "home", icon: <Home size={17} />, label: t.home })}
          {renderNavItem({ id: "practice", icon: <Mic size={17} />, label: t.practice })}
          {renderNavItem({ id: "progress", icon: <BarChart3 size={17} />, label: t.progress })}
        </nav>
        <div className="side-spacer" />
        <div className="side-goal">
          <div className="side-goal-top"><span>{t.practiceGoal}</span><Target size={14} /></div>
          <strong>{thisWeek.length} / {weekGoal} {t.practices}</strong>
          <p>{thisWeek.length ? t.weeklyChartBody : t.samplePlan}</p>
          <div className="goal-track"><div className="goal-fill" style={{ width: `${Math.min(100, (thisWeek.length / weekGoal) * 100)}%` }} /></div>
        </div>
        <div className="side-foot"><button onClick={() => setView("progress")}><CircleHelp size={14} />{t.learnMore}</button><span>v0.1</span></div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="mobile-brand"><BrandMark /><span className="brand-name">SpeakReady</span></div>
          <div className="crumb">SpeakReady <span>/</span>{view === "home" ? t.home : view === "practice" ? t.practice : t.progress}</div>
          <div className="top-actions">
            <label className="language-menu"><span className="visually-hidden">{t.language}</span><Languages className="lang-icon" size={13} /><select value={locale} aria-label={t.language} onChange={(event) => switchLanguage(event.target.value)}><option value="es">ES</option><option value="en">EN</option><option value="pt">PT</option></select><ChevronDown className="lang-chevron" size={11} /></label>
            <button className="icon-button" aria-label={t.learnMore} onClick={() => setView("progress")}><Info size={16} /></button>
            <div className="avatar" aria-label="SpeakReady">SR</div>
          </div>
        </header>

        <div className="main-inner">
          {view === "home" && renderHomeView()}
          {view === "practice" && renderPracticeView()}
          {view === "progress" && renderProgressView()}
          {renderFooter()}
        </div>
      </main>

      <nav className="mobile-nav" aria-label={t.home}>
        <button className={view === "home" ? "active" : ""} aria-current={view === "home" ? "page" : undefined} onClick={() => setView("home")}><Home size={16} />{t.home}</button>
        <button className={view === "practice" ? "active" : ""} aria-current={view === "practice" ? "page" : undefined} onClick={() => beginPractice()}><Mic size={16} />{t.practice}</button>
        <button className={view === "progress" ? "active" : ""} aria-current={view === "progress" ? "page" : undefined} onClick={() => setView("progress")}><BarChart3 size={16} />{t.progress}</button>
      </nav>
    </div>
  );
}

function AudioWave() {
  return <Activity size={33} strokeWidth={1.7} />;
}
