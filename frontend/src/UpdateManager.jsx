import React, { useEffect, useSyncExternalStore } from "react";

/*
 * In-app updater UI.
 *  - <UpdateNotifier />       : auto-checks on startup and shows a floating update card.
 *  - <UpdateSettingsPanel />  : settings section (current version, auto-check toggle, check now).
 * Both share one tiny store so a manual check from Settings also drives the card.
 */

const AUTO_KEY = "masar_auto_update";
const SKIP_KEY = "masar_skip_version";
const AUTO_CHECK_DELAY_MS = 4000;

const TEXT = {
  en: {
    sectionTitle: "Updates",
    sectionDesc: "Masar checks the official GitHub releases and installs new versions in one click.",
    currentVersion: "Current version",
    autoCheck: "Check for updates automatically on startup",
    checkNow: "Check for updates",
    checking: "Checking…",
    upToDate: "You are using the latest version.",
    availableTitle: "A new version of Masar is available",
    availableShort: (v) => `Version ${v} is ready to install.`,
    whatsNew: "What's new",
    installNow: "Update now",
    later: "Later",
    skip: "Skip this version",
    viewRelease: "Release page",
    downloading: "Downloading update…",
    verifying: "Verifying file integrity (SHA256)…",
    launching: "Starting installer — Masar will restart automatically.",
    failed: "Update failed",
    retry: "Retry",
    close: "Close",
    lastChecked: "Last checked",
    wingetHint: "You can also update from the terminal:",
  },
  ar: {
    sectionTitle: "التحديثات",
    sectionDesc: "يتحقق مسار من الإصدارات الرسمية على GitHub ويثبّت الإصدار الجديد بضغطة واحدة.",
    currentVersion: "الإصدار الحالي",
    autoCheck: "التحقق من التحديثات تلقائياً عند فتح البرنامج",
    checkNow: "التحقق من التحديثات",
    checking: "جارِ التحقق…",
    upToDate: "أنت تستخدم أحدث إصدار.",
    availableTitle: "يتوفر إصدار جديد من مسار",
    availableShort: (v) => `الإصدار ${v} جاهز للتثبيت.`,
    whatsNew: "ما الجديد",
    installNow: "حدّث الآن",
    later: "لاحقاً",
    skip: "تخطي هذا الإصدار",
    viewRelease: "صفحة الإصدار",
    downloading: "جارِ تنزيل التحديث…",
    verifying: "جارِ التحقق من سلامة الملف (SHA256)…",
    launching: "جارِ تشغيل المثبّت — سيُعاد تشغيل مسار تلقائياً.",
    failed: "تعذّر التحديث",
    retry: "إعادة المحاولة",
    close: "إغلاق",
    lastChecked: "آخر تحقق",
    wingetHint: "يمكنك أيضاً التحديث من الطرفية:",
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
    // ignore storage errors
  }
};

// ---------------------------------------------------------------- store
let state = {
  status: "idle", // idle | checking | uptodate | available | downloading | error
  version: "",
  info: null,
  progress: null,
  error: "",
  cardOpen: false,
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

const loadVersion = async () => {
  const api = backend();
  if (!api || typeof api.GetAppVersion !== "function" || state.version) return;
  try {
    setState({ version: await api.GetAppVersion() });
  } catch {
    // ignore
  }
};

export const checkForUpdates = async ({ silent = false } = {}) => {
  const api = backend();
  if (!api || typeof api.CheckForUpdates !== "function") return;
  if (state.status === "checking" || state.status === "downloading") return;

  setState({ status: "checking", error: "" });
  try {
    const info = await api.CheckForUpdates();
    if (info.currentVersion) setState({ version: info.currentVersion });

    if (info.available) {
      const skipped = readStorage(SKIP_KEY, "") === info.latestVersion;
      setState({ status: "available", info, cardOpen: !(silent && skipped) });
    } else {
      setState({ status: "uptodate", info, cardOpen: false });
    }
  } catch (err) {
    setState({ status: silent ? "idle" : "error", error: String(err || ""), cardOpen: !silent });
  }
};

const installUpdate = async () => {
  const api = backend();
  if (!api || typeof api.DownloadAndInstallUpdate !== "function") return;
  hookProgressEvents();
  setState({ status: "downloading", progress: { stage: "downloading", percent: 0 }, error: "", cardOpen: true });
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

// Returns the running version (e.g. "1.1.0") reported by the Go backend, or "" outside Wails.
export function useAppVersion() {
  const s = useUpdaterState();
  useEffect(() => {
    loadVersion();
  }, []);
  return s.version;
}

// ---------------------------------------------------------------- components
function ProgressBlock({ s, tx }) {
  const p = s.progress || {};
  const label =
    p.stage === "verifying" ? tx.verifying : p.stage === "launching" ? tx.launching : tx.downloading;
  const pct = Math.max(0, Math.min(100, Number(p.percent) || 0));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span className="font-mono" dir="ltr">
          {p.stage === "downloading" && p.total > 0
            ? `${formatMB(p.downloaded)} / ${formatMB(p.total)}`
            : `${pct.toFixed(0)}%`}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function UpdateNotifier({ lang = "ar" }) {
  const s = useUpdaterState();
  const tx = TEXT[lang] || TEXT.en;

  useEffect(() => {
    loadVersion();
    if (!backend() || !state.autoCheck) return undefined;
    const timer = setTimeout(() => checkForUpdates({ silent: true }), AUTO_CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!s.cardOpen || !["available", "downloading", "error"].includes(s.status)) return null;

  const info = s.info || {};
  const busy = s.status === "downloading";
  const notes = (info.releaseNotes || "").trim();

  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="masar-modal-animate fixed bottom-4 left-4 z-50 w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-sky-500/40 bg-slate-900/95 backdrop-blur-md shadow-2xl p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-9 w-9 shrink-0 rounded-xl bg-sky-500/15 border border-sky-500/40 flex items-center justify-center text-sky-300 text-lg">
            {s.status === "error" ? "!" : "⬇"}
          </div>
          <div>
            <div className="text-sm font-extrabold text-white">
              {s.status === "error" ? tx.failed : tx.availableTitle}
            </div>
            {s.status !== "error" && info.latestVersion && (
              <div className="text-xs text-slate-400 mt-0.5">
                {tx.availableShort(info.latestVersion)}{" "}
                <span className="font-mono" dir="ltr">
                  (v{s.version || info.currentVersion} → v{info.latestVersion})
                </span>
              </div>
            )}
          </div>
        </div>
        {!busy && (
          <button
            type="button"
            onClick={() => setState({ cardOpen: false })}
            className="text-slate-400 hover:text-white text-sm px-1"
            title={tx.close}
          >
            ✕
          </button>
        )}
      </div>

      {s.status === "error" && (
        <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 break-words" dir="ltr">
          {s.error}
        </p>
      )}

      {s.status === "available" && notes && (
        <div className="space-y-1">
          <div className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">{tx.whatsNew}</div>
          <div className="max-h-28 overflow-y-auto text-xs text-slate-300 whitespace-pre-line leading-relaxed bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-2" dir="auto">
            {notes}
          </div>
        </div>
      )}

      {busy && <ProgressBlock s={s} tx={tx} />}

      {!busy && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={installUpdate}
            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-extrabold transition"
          >
            {s.status === "error" ? tx.retry : tx.installNow}
            {s.status === "available" && info.sizeBytes > 0 && (
              <span className="font-mono opacity-70" dir="ltr"> · {formatMB(info.sizeBytes)}</span>
            )}
          </button>
          {s.status === "available" && (
            <>
              <button
                type="button"
                onClick={() => setState({ cardOpen: false })}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition"
              >
                {tx.later}
              </button>
              <button
                type="button"
                onClick={() => {
                  writeStorage(SKIP_KEY, info.latestVersion || "");
                  setState({ cardOpen: false });
                }}
                className="px-2 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold transition"
              >
                {tx.skip}
              </button>
            </>
          )}
          {info.releaseUrl && (
            <button
              type="button"
              onClick={() => openReleasePage(info.releaseUrl)}
              className="px-2 py-2 text-sky-400 hover:text-sky-300 text-xs font-semibold underline-offset-2 hover:underline transition"
            >
              {tx.viewRelease} ↗
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function UpdateSettingsPanel({ lang = "ar" }) {
  const s = useUpdaterState();
  const tx = TEXT[lang] || TEXT.en;
  const available = !!backend();

  useEffect(() => {
    loadVersion();
  }, []);

  const checkedAt = s.info && s.info.checkedAt ? new Date(s.info.checkedAt) : null;

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-extrabold text-sky-400 uppercase tracking-wider">{tx.sectionTitle}</h3>
        <p className="text-xs text-slate-400 mt-0.5">{tx.sectionDesc}</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span>{tx.currentVersion}:</span>
            <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/40" dir="ltr">
              v{s.version || "1.x"}
            </span>
          </div>

          <button
            type="button"
            disabled={!available || s.status === "checking" || s.status === "downloading"}
            onClick={() => checkForUpdates({ silent: false })}
            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 text-xs font-extrabold transition"
          >
            {s.status === "checking" ? tx.checking : tx.checkNow}
          </button>
        </div>

        {s.status === "uptodate" && (
          <div className="text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
            ✓ {tx.upToDate}
          </div>
        )}
        {s.status === "available" && s.info && (
          <button
            type="button"
            onClick={() => setState({ cardOpen: true })}
            className="w-full text-start text-xs font-bold text-sky-300 bg-sky-500/10 border border-sky-500/30 rounded-lg px-3 py-2 hover:bg-sky-500/15 transition"
          >
            ⬇ {tx.availableShort(s.info.latestVersion)}
          </button>
        )}
        {s.status === "error" && (
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 break-words" dir="ltr">
            {s.error}
          </div>
        )}

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={s.autoCheck}
            onChange={(e) => setAutoCheck(e.target.checked)}
            className="h-4 w-4 accent-sky-500"
          />
          <span className="text-sm text-slate-200">{tx.autoCheck}</span>
        </label>

        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
          {checkedAt && !Number.isNaN(checkedAt.getTime()) && (
            <span>
              {tx.lastChecked}: <span dir="ltr">{checkedAt.toLocaleString(lang === "ar" ? "ar" : "en")}</span>
            </span>
          )}
          <span>
            {tx.wingetHint}{" "}
            <code className="font-mono text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded" dir="ltr">
              winget upgrade mhmdrfx.Masar
            </code>
          </span>
        </div>
      </div>
    </section>
  );
}
