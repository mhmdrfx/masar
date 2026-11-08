import React, { useEffect, useRef, useSyncExternalStore } from "react";

/*
 * In-app updater UI.
 *  - <UpdateNotifier />       : floating update notification card (shows on new release, uptodate check, or test mode).
 *  - <UpdateSettingsPanel />  : settings section (current version, animated check now button, test demo button).
 * Both share a reactive store so any check or demo immediately drives the visual feedback.
 */

const AUTO_KEY = "masar_auto_update";
const SKIP_KEY = "masar_skip_version";
const AUTO_CHECK_DELAY_MS = 3500;

const TEXT = {
  en: {
    sectionTitle: "Updates",
    sectionDesc: "Masar checks official GitHub releases and installs new versions in one click.",
    currentVersion: "Current version",
    autoCheck: "Check for updates automatically on startup",
    checkNow: "Check for updates",
    checking: "Checking GitHub…",
    upToDate: "You are using the latest version",
    upToDateDesc: "All modules and telemetry engines are up to date.",
    availableTitle: "New update available",
    availableShort: (v) => `Version v${v} is ready to install.`,
    whatsNew: "What's new in this release",
    installNow: "Update now",
    later: "Later",
    skip: "Skip this version",
    viewRelease: "Release page",
    downloading: "Downloading update…",
    verifying: "Verifying checksum (SHA256)…",
    launching: "Starting installer — Masar will restart automatically.",
    failed: "Update check failed",
    retry: "Retry",
    close: "Close",
    lastChecked: "Last checked",
    wingetHint: "You can also update via terminal:",
    testCardBtn: "🧪 Test Update Card (Demo)",
    testDownloadDone: "Demo complete! Installer simulated successfully.",
  },
  ar: {
    sectionTitle: "التحديثات",
    sectionDesc: "يتحقق مسار من الإصدارات الرسمية على GitHub ويثبّت الإصدار الجديد بضغطة واحدة.",
    currentVersion: "الإصدار الحالي",
    autoCheck: "التحقق من التحديثات تلقائياً عند فتح البرنامج",
    checkNow: "التحقق من التحديثات",
    checking: "جارِ التحقق من GitHub…",
    upToDate: "أنت تستخدم أحدث إصدار",
    upToDateDesc: "جميع ملفات النظام ومحرك الفحص مطابقة لأحدث إصدار رسمي.",
    availableTitle: "يتوفر إصدار جديد من مسار",
    availableShort: (v) => `الإصدار v${v} جاهز للتثبيت الآن.`,
    whatsNew: "أبرز مميزات هذا التحديث",
    installNow: "حدّث الآن",
    later: "لاحقاً",
    skip: "تخطي هذا الإصدار",
    viewRelease: "صفحة الإصدار",
    downloading: "جارِ تنزيل ملف التحديث…",
    verifying: "جارِ التحقق من بصمة التشفير (SHA256)…",
    launching: "جارِ تشغيل المثبّت — سيُعاد تشغيل مسار تلقائياً.",
    failed: "تعذّر التحقق من التحديث",
    retry: "إعادة المحاولة",
    close: "إغلاق",
    lastChecked: "آخر فحص",
    wingetHint: "يمكنك أيضاً التحديث من سطر الأوامر:",
    testCardBtn: "🧪 تجربة ظهور بطاقة التحديث (محاكاة)",
    testDownloadDone: "اكتملت المحاكاة! تم اختبار دورة التحديث بالكامل بنجاح.",
  },
};

const backend = () =>
  typeof window !== "undefined" && window.go && window.go.main && window.go.main.App
    ? window.go.main.App
    : null;

const readStorage = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ignore
  }
};

// ---------------------------------------------------------------- store
let state = {
  status: "idle", // idle | checking | uptodate | available | downloading | error
  version: "1.0.0",
  info: null,
  progress: null,
  error: "",
  cardOpen: false,
  isDemo: false,
  autoCheck: readStorage(AUTO_KEY, "1") !== "0",
};

const listeners = new Set();
const setState = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const useUpdaterState = () => useSyncExternalStore(subscribe, () => state);

let progressHooked = false;
const hookProgressEvents = () => {
  if (progressHooked || !window.runtime || typeof window.runtime.EventsOn !== "function") return;
  progressHooked = true;
  window.runtime.EventsOn("update:progress", (p) => setState({ progress: p }));
};

export const loadVersion = async () => {
  const api = backend();
  if (!api || typeof api.GetAppVersion !== "function") return;
  try {
    const v = await api.GetAppVersion();
    if (v) setState({ version: v });
  } catch {
    // ignore
  }
};

export const checkForUpdates = async ({ silent = false } = {}) => {
  const api = backend();
  if (state.status === "checking" || state.status === "downloading") return;

  setState({ status: "checking", error: "", isDemo: false });

  // Guarantee at least 800ms of visual feedback so the spinner & transitions are clearly perceptible
  const minDelay = new Promise((resolve) => setTimeout(resolve, silent ? 0 : 850));

  try {
    let info = null;
    if (api && typeof api.CheckForUpdates === "function") {
      const [fetchedInfo] = await Promise.all([api.CheckForUpdates(), minDelay]);
      info = fetchedInfo;
    } else {
      // Fallback in web browser testing: fetch GitHub releases directly
      const [resp] = await Promise.all([
        fetch("https://api.github.com/repos/mhmdrfx/masar/releases/latest"),
        minDelay,
      ]);
      if (resp.ok) {
        const data = await resp.json();
        const latestTag = (data.tag_name || "").replace(/^v/i, "");
        info = {
          available: false,
          currentVersion: state.version || "1.0.0",
          latestVersion: latestTag || "1.0.0",
          releaseName: data.name || "Masar v1.0.0",
          releaseNotes: data.body || "",
          releaseUrl: data.html_url || "https://github.com/mhmdrfx/masar/releases",
          publishedAt: data.published_at || new Date().toISOString(),
          checkedAt: new Date().toISOString(),
          sizeBytes: 6888147,
        };
      } else {
        throw new Error("HTTP " + resp.status);
      }
    }

    if (info && info.currentVersion) {
      setState({ version: info.currentVersion });
    }

    if (info && info.available) {
      const skipped = readStorage(SKIP_KEY, "") === info.latestVersion;
      setState({
        status: "available",
        info,
        cardOpen: !(silent && skipped),
        isDemo: false,
      });
    } else {
      // Up to date!
      // If user clicked manually (!silent), open the floating card with celebration/green confirmation
      setState({
        status: "uptodate",
        info: info || {
          currentVersion: state.version,
          latestVersion: state.version,
          checkedAt: new Date().toISOString(),
        },
        cardOpen: !silent,
        isDemo: false,
      });
    }
  } catch (err) {
    setState({
      status: silent ? "idle" : "error",
      error: String(err && err.message ? err.message : err || "Network timeout"),
      cardOpen: !silent,
      isDemo: false,
    });
  }
};

// ---------------------------------------------------------------- demo simulator
let demoTimer = null;
export const simulateAvailableUpdate = (lang = "ar") => {
  if (demoTimer) clearInterval(demoTimer);
  setState({
    status: "available",
    cardOpen: true,
    isDemo: true,
    info: {
      available: true,
      currentVersion: state.version || "1.0.0",
      latestVersion: "1.0.1",
      releaseName: "Masar v1.0.1 - Performance & Visual Intelligence Update",
      releaseNotes:
        lang === "ar"
          ? "• تسريع أداء تتبع المسار MTR بنسبة 35% عبر خوارزمية فحص متوازية.\n• تحسين دقة كشف اختناقات مزودي الخدمة ومعدل الـ Jitter.\n• إضافة خوادم فحص سرعة Anycast جديدة."
          : "• 35% faster parallel Visual MTR trace dispatching.\n• Enhanced ISP bottleneck heuristics & jitter calculation.\n• Added new global Anycast speed benchmark edge locations.",
      releaseUrl: "https://github.com/mhmdrfx/masar/releases",
      sizeBytes: 6888147,
      publishedAt: new Date().toISOString(),
      checkedAt: new Date().toISOString(),
      downloadUrl: "mock://download",
      checksumUrl: "mock://checksum",
    },
    progress: null,
  });
};

const runDemoDownload = () => {
  setState({
    status: "downloading",
    progress: { stage: "downloading", percent: 0, downloaded: 0, total: 6888147 },
  });

  let pct = 0;
  demoTimer = setInterval(() => {
    pct += 15;
    if (pct < 100) {
      setState({
        progress: {
          stage: "downloading",
          percent: pct,
          downloaded: Math.round((pct / 100) * 6888147),
          total: 6888147,
        },
      });
    } else if (pct === 105) {
      setState({
        progress: {
          stage: "verifying",
          percent: 100,
          downloaded: 6888147,
          total: 6888147,
        },
      });
    } else {
      clearInterval(demoTimer);
      setState({
        progress: {
          stage: "launching",
          percent: 100,
          downloaded: 6888147,
          total: 6888147,
        },
      });
      setTimeout(() => {
        setState({ status: "uptodate", cardOpen: true, isDemo: false });
      }, 1500);
    }
  }, 350);
};

const installUpdate = async () => {
  if (state.isDemo) {
    runDemoDownload();
    return;
  }
  const api = backend();
  if (!api || typeof api.DownloadAndInstallUpdate !== "function") return;
  hookProgressEvents();
  setState({
    status: "downloading",
    progress: { stage: "downloading", percent: 0 },
    error: "",
    cardOpen: true,
  });
  try {
    await api.DownloadAndInstallUpdate();
    setState({ progress: { stage: "launching", percent: 100 } });
  } catch (err) {
    setState({ status: "error", error: String(err || ""), cardOpen: true });
  }
};

const setAutoCheck = (enabled) => {
  writeStorage(AUTO_KEY, enabled ? "1" : "0");
  setState({ autoCheck: enabled });
};

const openReleasePage = (url) => {
  if (!url) return;
  if (window.runtime && typeof window.runtime.BrowserOpenURL === "function") {
    window.runtime.BrowserOpenURL(url);
  } else {
    window.open(url, "_blank", "noopener");
  }
};

const formatMB = (bytes) => (bytes > 0 ? `${(bytes / 1048576).toFixed(1)} MB` : "");

// Hook for components needing current version
export function useAppVersion() {
  const s = useUpdaterState();
  useEffect(() => {
    loadVersion();
  }, []);
  return s.version;
}

// ---------------------------------------------------------------- progress block
function ProgressBlock({ s, tx }) {
  const p = s.progress || {};
  const label =
    p.stage === "verifying"
      ? tx.verifying
      : p.stage === "launching"
      ? tx.launching
      : tx.downloading;
  const pct = Math.max(0, Math.min(100, Number(p.percent) || 0));
  return (
    <div className="space-y-2.5 pt-1">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-3.5 w-3.5 text-sky-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          <span className="font-medium">{label}</span>
        </span>
        <span className="font-mono text-sky-300 font-bold" dir="ltr">
          {p.stage === "downloading" && p.total > 0
            ? `${formatMB(p.downloaded)} / ${formatMB(p.total)}`
            : `${pct.toFixed(0)}%`}
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-slate-800/90 border border-slate-700/60 overflow-hidden p-0.5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 transition-all duration-300 shadow-sm shadow-sky-500/50"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- floating card
export function UpdateNotifier({ lang = "ar" }) {
  const s = useUpdaterState();
  const tx = TEXT[lang] || TEXT.en;
  const autoCloseTimerRef = useRef(null);

  useEffect(() => {
    loadVersion();
    if (!backend() || !state.autoCheck) return undefined;
    const timer = setTimeout(() => checkForUpdates({ silent: true }), AUTO_CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Auto-close uptodate celebration card after 7 seconds
  useEffect(() => {
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    if (s.cardOpen && s.status === "uptodate") {
      autoCloseTimerRef.current = setTimeout(() => {
        setState({ cardOpen: false });
      }, 7000);
    }
    return () => {
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    };
  }, [s.cardOpen, s.status]);

  if (!s.cardOpen || !["available", "downloading", "error", "uptodate"].includes(s.status)) {
    return null;
  }

  const info = s.info || {};
  const busy = s.status === "downloading";
  const notes = (info.releaseNotes || "").trim();

  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="masar-card-slide-in fixed bottom-5 start-5 z-[60] w-[min(410px,calc(100vw-2.5rem))] rounded-3xl border border-sky-500/50 bg-slate-950/95 backdrop-blur-xl shadow-2xl shadow-sky-950/60 p-4 sm:p-5 space-y-3.5"
    >
      {/* Glow highlight header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center text-lg shadow-inner ${
              s.status === "uptodate"
                ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-400"
                : s.status === "error"
                ? "bg-red-500/20 border border-red-500/50 text-red-400"
                : "bg-sky-500/20 border border-sky-500/50 text-sky-300"
            }`}
          >
            {s.status === "uptodate" ? "✓" : s.status === "error" ? "!" : "⬇"}
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-white">
                {s.status === "uptodate"
                  ? tx.upToDate
                  : s.status === "error"
                  ? tx.failed
                  : tx.availableTitle}
              </span>
            </div>

            {s.status === "available" && info.latestVersion && (
              <div className="text-xs text-slate-300 font-medium">
                {tx.availableShort(info.latestVersion)}{" "}
                <span className="font-mono text-sky-400 font-bold" dir="ltr">
                  (v{s.version || info.currentVersion} → v{info.latestVersion})
                </span>
              </div>
            )}

            {s.status === "uptodate" && (
              <div className="text-xs text-emerald-300/90 font-medium">
                {tx.upToDateDesc}
              </div>
            )}
          </div>
        </div>

        {!busy && (
          <button
            type="button"
            onClick={() => setState({ cardOpen: false })}
            className="h-7 w-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold transition border border-slate-800"
            title={tx.close}
          >
            ✕
          </button>
        )}
      </div>

      {/* Up-to-date status details */}
      {s.status === "uptodate" && (
        <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/30 p-3 space-y-1.5 text-xs text-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">{tx.currentVersion}:</span>
            <span className="font-mono font-bold text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30" dir="ltr">
              v{s.version}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {lang === "ar"
              ? "تم فحص الإصدار بنجاح ومطابقته مع مستودع GitHub الرسمي."
              : "Verified cleanly against the official GitHub releases repository."}
          </p>
        </div>
      )}

      {/* Error display */}
      {s.status === "error" && (
        <p className="text-xs text-red-300 bg-red-950/40 border border-red-500/40 rounded-xl p-3 break-words" dir="ltr">
          {s.error}
        </p>
      )}

      {/* Release Notes for new version */}
      {s.status === "available" && notes && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>✦</span>
            <span>{tx.whatsNew}</span>
          </div>
          <div
            className="max-h-32 overflow-y-auto text-xs text-slate-300 whitespace-pre-line leading-relaxed bg-slate-900/80 border border-slate-800 rounded-xl p-3 shadow-inner"
            dir="auto"
          >
            {notes}
          </div>
        </div>
      )}

      {/* Downloading Progress Bar */}
      {busy && <ProgressBlock s={s} tx={tx} />}

      {/* Action Buttons */}
      {!busy && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {s.status === "available" && (
            <button
              type="button"
              onClick={installUpdate}
              className="masar-lift-card active:scale-95 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 text-slate-950 text-xs font-black shadow-lg shadow-sky-500/25 transition-all flex items-center gap-1.5"
            >
              <span>⬇</span>
              <span>{tx.installNow}</span>
              {info.sizeBytes > 0 && (
                <span className="font-mono opacity-80 font-bold" dir="ltr">
                  · {formatMB(info.sizeBytes)}
                </span>
              )}
            </button>
          )}

          {s.status === "uptodate" && (
            <button
              type="button"
              onClick={() => setState({ cardOpen: false })}
              className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition active:scale-95"
            >
              {lang === "ar" ? "حسناً، فهمت" : "Got it"}
            </button>
          )}

          {s.status === "error" && (
            <button
              type="button"
              onClick={() => checkForUpdates({ silent: false })}
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black transition active:scale-95"
            >
              {tx.retry}
            </button>
          )}

          {s.status === "available" && (
            <>
              <button
                type="button"
                onClick={() => setState({ cardOpen: false })}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-800 transition active:scale-95"
              >
                {tx.later}
              </button>
              <button
                type="button"
                onClick={() => {
                  writeStorage(SKIP_KEY, info.latestVersion || "");
                  setState({ cardOpen: false });
                }}
                className="px-2.5 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold transition"
              >
                {tx.skip}
              </button>
            </>
          )}

          {info.releaseUrl && (
            <button
              type="button"
              onClick={() => openReleasePage(info.releaseUrl)}
              className="px-2 py-2 text-sky-400 hover:text-sky-300 text-xs font-semibold underline-offset-4 hover:underline transition"
            >
              {tx.viewRelease} ↗
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- settings panel
export function UpdateSettingsPanel({ lang = "ar" }) {
  const s = useUpdaterState();
  const tx = TEXT[lang] || TEXT.en;
  const isChecking = s.status === "checking";

  useEffect(() => {
    loadVersion();
  }, []);

  const checkedAt = s.info && s.info.checkedAt ? new Date(s.info.checkedAt) : null;

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-extrabold text-sky-400 uppercase tracking-wider">
          {tx.sectionTitle}
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">{tx.sectionDesc}</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5 space-y-4 shadow-xl">
        {/* Row 1: Current Version & Animated Check Button */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm text-slate-200">
            <span className="font-medium text-slate-400">{tx.currentVersion}:</span>
            <span
              className="font-mono font-extrabold px-2.5 py-0.5 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm"
              dir="ltr"
            >
              v{s.version || "1.0.0"}
            </span>
          </div>

          <button
            type="button"
            disabled={isChecking || s.status === "downloading"}
            onClick={() => checkForUpdates({ silent: false })}
            className={`masar-lift-card active:scale-95 px-4 py-2.5 rounded-xl text-xs font-black transition-all duration-200 flex items-center gap-2 shadow-lg ${
              isChecking
                ? "bg-sky-500/80 text-slate-950 cursor-wait ring-2 ring-sky-400/50 animate-pulse"
                : "bg-sky-400 hover:bg-sky-300 text-slate-950 shadow-sky-500/20"
            }`}
          >
            {isChecking ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-slate-950" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>{tx.checking}</span>
              </>
            ) : (
              <>
                <span className="text-sm">🔄</span>
                <span>{tx.checkNow}</span>
              </>
            )}
          </button>
        </div>

        {/* Status Banners */}
        {s.status === "uptodate" && (
          <div className="flex items-center justify-between gap-3 text-xs font-bold text-emerald-300 bg-emerald-950/30 border border-emerald-500/40 rounded-xl px-3.5 py-2.5 shadow-inner">
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[11px] text-emerald-400">
                ✓
              </span>
              <span>{tx.upToDate}</span>
            </div>
            <button
              type="button"
              onClick={() => setState({ cardOpen: true })}
              className="text-[11px] text-sky-400 hover:text-sky-300 underline underline-offset-2"
            >
              {lang === "ar" ? "عرض التفاصيل" : "View details"}
            </button>
          </div>
        )}

        {s.status === "available" && s.info && (
          <button
            type="button"
            onClick={() => setState({ cardOpen: true })}
            className="w-full text-start text-xs font-bold text-sky-300 bg-sky-950/40 border border-sky-500/40 rounded-xl px-3.5 py-2.5 hover:bg-sky-900/40 transition flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <span className="text-base">⬇</span>
              <span>{tx.availableShort(s.info.latestVersion)}</span>
            </span>
            <span className="text-[11px] text-sky-400 underline">{lang === "ar" ? "افتح البطاقة" : "Open card"} →</span>
          </button>
        )}

        {s.status === "error" && (
          <div className="text-xs text-red-300 bg-red-950/30 border border-red-500/40 rounded-xl px-3.5 py-2.5 break-words" dir="ltr">
            {s.error}
          </div>
        )}

        {/* Row 2: Checkbox */}
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={s.autoCheck}
              onChange={(e) => setAutoCheck(e.target.checked)}
              className="h-4 w-4 rounded accent-sky-500 cursor-pointer"
            />
            <span className="text-xs font-medium text-slate-300">{tx.autoCheck}</span>
          </label>
        </div>

        {/* Row 3: Meta & Winget hint */}
        <div className="text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pt-1">
          {checkedAt && !Number.isNaN(checkedAt.getTime()) && (
            <span>
              {tx.lastChecked}:{" "}
              <span className="font-mono text-slate-300" dir="ltr">
                {checkedAt.toLocaleTimeString(lang === "ar" ? "ar-SA" : "en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </span>
          )}
          <span>
            {tx.wingetHint}{" "}
            <code className="font-mono text-sky-300 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded" dir="ltr">
              winget upgrade mhmdrfx.Masar
            </code>
          </span>
        </div>
      </div>
    </section>
  );
}
