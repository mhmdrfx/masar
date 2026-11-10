import React, { useState, useEffect, useRef, useId } from "react";
import {
  ExportToolbarCapsule,
  ReportStudioModal,
  buildBrowserDetailedReport,
} from "./ReportStudio.jsx";
import {
  UpdateNotifier,
  UpdateSettingsPanel,
  useAppVersion,
} from "./UpdateManager.jsx";

const PRESETS = [
  { labelEn: "Google DNS", labelAr: "خادم جوجل", value: "8.8.8.8" },
  { labelEn: "Cloudflare", labelAr: "كلاودفلير", value: "1.1.1.1" },
  { labelEn: "Quad9", labelAr: "كواد 9", value: "9.9.9.9" },
];

const I18N = {
  en: {
    dir: "ltr",
    appSubtitle: "Visual MTR & Smart Network Diagnostics",
    tracingLive: "Live Polling",
    tabMtr: "Visual MTR",
    tabDns: "DNS Lookup",
    tabPorts: "Port Scanner",
    tabSpeed: "Speed Benchmark",
    quickTargets: "Quick Targets",
    targetPlaceholder: "Enter IP or Hostname (e.g. 8.8.8.8)",
    startTrace: "Start Trace",
    stopTrace: "Stop",
    copySummary: "Copy Summary",
    copiedSummary: "Copied",
    exportPdf: "PDF Report",
    errorTitle: "Network Socket / Trace Error",
    dismiss: "Dismiss",
    healthScoreTitle: "Connection Health Score",
    hop1Label: "Hop 1: Router",
    ispLabel: "Hops 2–3: ISP",
    totalHopsLabel: "Hops",
    targetLabel: "Target",
    updatedLabel: "Updated",
    badgeHealthy: "HEALTHY PATH",
    badgeWarning: "DEGRADED",
    badgeCritical: "ACTION REQUIRED",
    badgeIdle: "STANDBY",
    topologyTitle: "Network Path Architecture & Geo-IP Topology",
    topologySub: "End-to-end packet flow across local gateway, ISP backbone, and destination",
    stageDevice: "This Device",
    stageDeviceSub: "Raw ICMPv4 Socket",
    stageRouter: "Local Gateway (Hop 1)",
    stageIsp: "ISP & Transit Backbone",
    stageTarget: "Target Destination",
    awaitingProbes: "Awaiting probes",
    reachableHops: "Responding Nodes",
    silentHops: "ICMP Filtered",
    tableTitle: "Real-Time Hop Telemetry (MTR)",
    tableSub: "Per-Hop Packet Loss, Geo-IP/ASN, Latency & 60s Live Sparklines",
    legendHealthy: "Healthy (0% – 2%)",
    legendWarn: "Warning (2% – 5%)",
    legendCrit: "Critical (> 5%)",
    colHop: "Hop",
    colHost: "IP / Hostname",
    colGeo: "Geo-IP / ASN",
    colLoss: "Loss %",
    colSentRecv: "Sent / Recv",
    colLast: "Last",
    colAvg: "Avg",
    colJitter: "Jitter",
    colTrend: "Trend (60s)",
    emptyTitle: "No Active MTR Trace Running",
    emptyDesc: "Select a preset or enter an IP/hostname above and click Start Trace to begin 1-second ICMP path telemetry.",
    timedOut: "Request Timed Out — ICMP Silent",
    roleRouter: "Local Router",
    roleIsp: "ISP Gateway",
    roleTarget: "Target",
    transitHop: "Transit Hop",
    dnsTitle: "DNS Record & Reverse PTR Inspector",
    dnsDesc: "Concurrently resolves A, AAAA, CNAME, MX, NS, TXT, and Reverse PTR records with query latency telemetry.",
    dnsPlaceholder: "Domain or IP (e.g. google.com)",
    dnsBtn: "Lookup DNS",
    dnsResolving: "Resolving...",
    dnsQueryTime: "Query Time",
    dnsRecordsFound: "Records Found",
    dnsColType: "Record Type",
    dnsColValue: "Resolved Value",
    portTitle: "Concurrent TCP Port Scanner",
    portDesc: "Scans standard infrastructure & service ports (SSH, DNS, HTTP, HTTPS, SMB, RDP, MySQL, PostgreSQL, Redis) and measures TCP handshake RTT.",
    portPlaceholder: "Host or IP (e.g. 8.8.8.8)",
    portBtn: "Scan Ports",
    portScanning: "Scanning...",
    portOpenCount: "Open Ports",
    portDuration: "Scan Duration",
    stateOpen: "OPEN",
    stateClosed: "CLOSED",
    speedTitle: "Live Continuous Bandwidth & Global Edge Benchmark",
    speedDesc: "Multi-stream real-time Download/Upload throughput (Mbps) and continuous 1s Anycast edge latency monitoring. Runs live until you click Stop.",
    speedStartBtn: "Start Live Benchmark",
    speedStopBtn: "Stop Benchmark",
    speedDown: "Live Download",
    speedUp: "Live Upload",
    speedPing: "Edge Ping",
    speedJitter: "Edge Jitter",
    speedPeak: "Peak",
    speedBest: "Best",
    speedTotalData: "Data Streamed",
    speedPhaseDown: "Multi-Stream Download (4x Active Streams)",
    speedPhaseUp: "Multi-Stream Upload (3x Active Streams)",
    speedPhaseIdle: "Click Start Live Benchmark to begin continuous real-time telemetry",
    speedEdgesTitle: "Live Global Anycast Edge Latency (1s Continuous Probing)",
    speedAvg: "Avg",
    settingsBtn: "Settings & Guide",
    settingsTitle: "Masar Settings, Theme & Comprehensive Guide",
    settingsSub: "Application identity, appearance mode, and detailed documentation for all diagnostic modules",
    closeBtn: "Close",
    sec1Title: "1. Application Identity & Credits",
    craftedPhrase: "Crafted with Perfection",
    identityDesc:
      "Visual MTR & Smart Network Diagnostics — Real-Time ICMPv4 Route Telemetry, Geo-IP Topology, DNS Inspector, TCP Port Scanner & Live Multi-Stream Bandwidth Benchmark.",
    rightsText: "All Rights Reserved to Developer",
    sec2Title: "2. Appearance Mode (Dark / White Theme)",
    sec2Desc: "Switch the application interface between Dark Slate Mode and Crisp White Mode:",
    darkThemeTitle: "Dark Mode",
    darkThemeDesc: "Deep slate NOC theme optimized for low-light monitoring",
    lightThemeTitle: "White Mode",
    lightThemeDesc: "Crisp high-contrast white theme for bright environments",
    activeThemeBadge: "ACTIVE",
    sec3Title: "3. Comprehensive Guide to All Program Sections",
    sec3Desc: "Detailed explanation of every tool, indicator, and metric inside Masar v1.0:",
    endToEndRtt: "End-to-End RTT",
    endToEndLoss: "Target Loss",
    routeJitter: "Path Jitter",
    streamRxTag: "4x RX Streams",
    streamTxTag: "3x TX Streams",
    cadenceLive: "LIVE 0.5s",
    cadenceIdle: "STANDBY",
    gaugeUnit: "SCORE",
  },
  ar: {
    dir: "rtl",
    appSubtitle: "الفحص البصري للمسار وتشخيص الشبكة الذكي",
    tracingLive: "فحص مباشر",
    tabMtr: "فحص المسار البصري",
    tabDns: "فحص النطاقات",
    tabPorts: "فاحص المنافذ",
    tabSpeed: "قياس السرعة المباشر",
    quickTargets: "أهداف سريعة",
    targetPlaceholder: "أدخل عنوان IP أو اسم النطاق (مثل 8.8.8.8)",
    startTrace: "بدء الفحص",
    stopTrace: "إيقاف",
    copySummary: "نسخ التقرير",
    copiedSummary: "تم النسخ",
    exportPdf: "تقرير PDF",
    errorTitle: "تنبيه محرك الشبكة",
    dismiss: "إغلاق",
    healthScoreTitle: "مؤشر جودة الاتصال",
    hop1Label: "القفزة 1: الراوتر",
    ispLabel: "القفزتان 2–3: المزود",
    totalHopsLabel: "القفزات",
    targetLabel: "الهدف",
    updatedLabel: "آخر تحديث",
    badgeHealthy: "مسار سليم",
    badgeWarning: "تذبذب في المسار",
    badgeCritical: "يوجد خلل",
    badgeIdle: "جاهز للفحص",
    topologyTitle: "خريطة المسار الجغرافي وبنية الاتصال",
    topologySub: "تتبع رحلة الحزم من جهازك مروراً بالراوتر وبوابة مزود الخدمة حتى الوجهة النهائية",
    stageDevice: "جهازك الحالي",
    stageDeviceSub: "مقبس فحص مباشر",
    stageRouter: "الراوتر المحلي (القفزة 1)",
    stageIsp: "بوابة المزود والربط الدولي",
    stageTarget: "الوجهة النهائية",
    awaitingProbes: "بانتظار الاستجابة",
    reachableHops: "عقد مستجيبة",
    silentHops: "عقد صامتة",
    tableTitle: "جدول تحليل القفزات اللحظي",
    tableSub: "نسبة الفقد، الموقع الجغرافي ومزود الخدمة، زمن الاستجابة، والمنحنى الزمني لآخر 60 ثانية",
    legendHealthy: "سليم (0% – 2%)",
    legendWarn: "تحذير (2% – 5%)",
    legendCrit: "خلل حرج (أكثر من 5%)",
    colHop: "القفزة",
    colHost: "العنوان الرقمي / المضيف",
    colGeo: "الموقع / الشبكة",
    colLoss: "الفقد %",
    colSentRecv: "مرسل / مستلم",
    colLast: "الحالي",
    colAvg: "المتوسط",
    colJitter: "التذبذب",
    colTrend: "منحنى (60ث)",
    emptyTitle: "لا يوجد فحص مسار نشط حالياً",
    emptyDesc: "اختر أحد الأهداف السريعة أو أدخل عنوان IP أو نطاقاً في الأعلى ثم اضغط على «بدء الفحص» لتحليل المسار كل ثانية.",
    timedOut: "راوتر صامت — يتجاهل فحص ICMP",
    roleRouter: "الراوتر المحلي",
    roleIsp: "بوابة المزود",
    roleTarget: "الهدف النهائي",
    transitHop: "عقدة عبور",
    dnsTitle: "فاحص سجلات النطاقات والفحص العكسي",
    dnsDesc: "استعلام متوازٍ وسريع عن سجلات النطاقات (A وAAAA وCNAME وMX وNS وTXT) والفحص العكسي (PTR) مع قياس زمن الاستجابة.",
    dnsPlaceholder: "أدخل اسم النطاق أو العنوان (مثل google.com)",
    dnsBtn: "فحص السجلات",
    dnsResolving: "جارٍ الفحص...",
    dnsQueryTime: "زمن الاستعلام",
    dnsRecordsFound: "السجلات المكتشفة",
    dnsColType: "نوع السجل",
    dnsColValue: "القيمة المسجلة",
    portTitle: "فاحص المنافذ المتوازي",
    portDesc: "فحص متوازٍ لمنافذ الخدمات القياسية (SSH وDNS وHTTP وHTTPS وSMB وRDP وقواعد البيانات) مع قياس زمن مصافحة الاتصال.",
    portPlaceholder: "أدخل المضيف أو العنوان (مثل 8.8.8.8)",
    portBtn: "بدء فحص المنافذ",
    portScanning: "جارٍ الفحص...",
    portOpenCount: "المنافذ المفتوحة",
    portDuration: "مدة الفحص",
    stateOpen: "مفتوح",
    stateClosed: "مغلق",
    speedTitle: "القياس الحي والمستمر لسرعة الاتصال والخوادم العالمية",
    speedDesc: "قياس مباشر ودقيق لسرعة التحميل والرفع عبر قنوات متوازية مع مراقبة لحظية لزمن استجابة الخوادم العالمية حتى تضغط على إيقاف.",
    speedStartBtn: "بدء القياس المباشر",
    speedStopBtn: "إيقاف القياس",
    speedDown: "سرعة التحميل الحية",
    speedUp: "سرعة الرفع الحية",
    speedPing: "زمن الاستجابة",
    speedJitter: "تذبذب الاستجابة",
    speedPeak: "الذروة",
    speedBest: "الأفضل",
    speedTotalData: "البيانات المتدفقة",
    speedPhaseDown: "فحص التحميل المتعدد (4 قنوات متوازية نشطة)",
    speedPhaseUp: "فحص الرفع المتعدد (3 قنوات متوازية نشطة)",
    speedPhaseIdle: "اضغط على «بدء القياس المباشر» لتشغيل تدفق الفحص اللحظي المستمر",
    speedEdgesTitle: "استجابة الخوادم السحابية العالمية (فحص حي كل ثانية)",
    speedAvg: "المتوسط",
    settingsBtn: "الإعدادات والدليل",
    settingsTitle: "إعدادات مسار والدليل الشامل",
    settingsSub: "هوية البرنامج وحقوق التطوير، تخصيص المظهر، والشرح المفصل لجميع الأقسام",
    closeBtn: "إغلاق",
    sec1Title: "أولاً: هوية البرنامج وحقوق التطوير",
    craftedPhrase: "صُنع بكل إتقان",
    identityDesc:
      "الفحص البصري للمسار وتشخيص الشبكة الذكي — تتبع لحظي لمسار الحزم، خريطة الموقع الجغرافي، فاحص سجلات النطاقات، فاحص المنافذ المتوازي، والقياس المباشر لسرعة الاتصال.",
    rightsText: "جميع الحقوق محفوظة للمطور",
    sec2Title: "ثانياً: تحويل لون البرنامج (الداكن / الأبيض)",
    sec2Desc: "اختر المظهر المناسب لك بين الوضع الداكن الاحترافي والوضع الأبيض الفاتح مع معاينة شكل البرنامجين:",
    darkThemeTitle: "الوضع الداكن",
    darkThemeDesc: "مظهر ليلي هادئ مريح للعين ومخصص لغرف العمليات والمراقبة المستمرة",
    lightThemeTitle: "الوضع الأبيض",
    lightThemeDesc: "مظهر أبيض نقي عالي الوضوح والتباين للإضاءة النهارية والمكتبية",
    activeThemeBadge: "مُفعّل حالياً",
    sec3Title: "ثالثاً: الشرح المفصل لجميع أقسام البرنامج",
    sec3Desc: "دليل شامل يشرح وظيفة وطريقة قراءة كل أداة وكل مؤشر داخل برنامج مسار (الإصدار 1.0):",
    endToEndRtt: "استجابة الوجهة",
    endToEndLoss: "فقد الوجهة",
    routeJitter: "تذبذب المسار",
    streamRxTag: "4 قنوات تحميل",
    streamTxTag: "3 قنوات رفع",
    cadenceLive: "مباشر 0.5ث",
    cadenceIdle: "جاهز",
    gaugeUnit: "الجودة",
  },
};

function localizeHealth(health, hops, lang) {
  if (!health) {
    return { status: "", detail: "" };
  }
  if (lang !== "ar") {
    return { status: health.status, detail: health.detail };
  }

  const st = health.status || "";
  const culprit = hops.find((h) => h.hop === health.culpritHop);
  const finalHop = hops.length > 0 ? hops[hops.length - 1] : null;

  if (st.includes("Ready to Diagnose")) {
    return {
      status: "جاهز لتشخيص مسار الشبكة",
      detail:
        "اختر هدفاً سريعاً (8.8.8.8 أو 1.1.1.1) أو أدخل أي عنوان IP أو اسم نطاق ثم اضغط على «بدء الفحص».",
    };
  }
  if (st.includes("Initializing") || st.includes("Measuring")) {
    return {
      status: "جارٍ اكتشاف وتحليل مسار الشبكة...",
      detail:
        "يتم إرسال نبضات فحص متتالية عبر القفزات لقياس جودة الراوتر المحلي وبوابة مزود الخدمة والوجهة النهائية.",
    };
  }
  if (st.includes("Local Network")) {
    return {
      status: "تم رصد خلل في الشبكة المحلية أو الراوتر (القفزة 1)",
      detail: culprit
        ? `القفزة الأولى (${culprit.ip || "الراوتر المحلي"}) تسجل فقد حزم بنسبة ${culprit.lossPercent.toFixed(1)}% ومتوسط زمن استجابة قدره ${culprit.avgMs.toFixed(1)} مللي ثانية؛ تحقق من إشارة الواي فاي أو كابل الشبكة أو الراوتر.`
        : "تم رصد فقد حزم أو ارتفاع في زمن الاستجابة عند الراوتر المحلي؛ تحقق من إشارة الواي فاي أو كابل الشبكة.",
    };
  }
  if (st.includes("ISP / Backbone")) {
    return {
      status: "تم رصد مشكلة من جهة مزود خدمة الإنترنت",
      detail: culprit
        ? `الراوتر المحلي (القفزة 1) سليم تماماً، لكن القفزة رقم ${culprit.hop} (${culprit.ip || "بوابة المزود"}) تسجل فقد حزم بنسبة ${culprit.lossPercent.toFixed(1)}% ومتوسط استجابة ${culprit.avgMs.toFixed(1)} مللي ثانية؛ يمكنك تصدير التقرير الرسمي وإرساله للدعم الفني.`
        : "الراوتر المحلي سليم، لكن تم رصد فقد حزم أو تأخر عند بوابة مزود الخدمة.",
    };
  }
  if (st.includes("Downstream Transit")) {
    return {
      status: "تذبذب في مسار الربط الدولي أو الخادم الهدف",
      detail: culprit
        ? `الشبكة المحلية وبوابة مزود الخدمة مستقرتان، لكن القفزة رقم ${culprit.hop} (${culprit.ip || "عقدة عبور"}) تسجل فقد حزم بنسبة ${culprit.lossPercent.toFixed(1)}% ومتوسط استجابة ${culprit.avgMs.toFixed(1)} مللي ثانية.`
        : "الشبكة المحلية وبوابة مزود الخدمة مستقرتان، لكن يوجد تذبذب في مسار العبور الدولي.",
    };
  }
  if (st.includes("Connection is Healthy")) {
    return {
      status: "الاتصال سليم — أداء المسار مثالي ومستقر",
      detail:
        finalHop && finalHop.received > 0
          ? `متوسط زمن الاستجابة إلى الوجهة (${finalHop.ip}) هو ${finalHop.avgMs.toFixed(1)} مللي ثانية مع تذبذب منخفض قدره ${finalHop.jitterMs.toFixed(1)} مللي ثانية ونسبة فقد ${finalHop.lossPercent.toFixed(1)}% فقط.`
          : "لا يوجد فقد مؤثر في الحزم عبر الراوتر المحلي أو بوابة مزود الخدمة.",
    };
  }

  return { status: health.status, detail: health.detail };
}

function localizeErrorMessage(rawErr, lang) {
  if (!rawErr) return "";
  const msg = String(rawErr).trim();
  if (!msg) return "";
  const lower = msg.toLowerCase();
  const isAr = lang === "ar";

  if (lower.includes("valid target ipv4") || lower.includes("valid ipv4 address or hostname")) {
    return isAr
      ? "يرجى إدخال عنوان IPv4 صحيح أو اسم نطاق صالح للفحص."
      : "Please enter a valid IPv4 address or hostname.";
  }
  if (lower.includes("valid domain name or ip")) {
    return isAr
      ? "يرجى إدخال اسم نطاق صالح أو عنوان IP صحيح."
      : "Please enter a valid domain name or IP address.";
  }
  if (lower.includes("valid host or ipv4")) {
    return isAr
      ? "يرجى إدخال اسم مضيف صالح أو عنوان IPv4 صحيح."
      : "Please enter a valid host or IPv4 address.";
  }
  if (lower.includes("failed to resolve host") || lower.includes("no such host")) {
    return isAr
      ? "تعذّر تحويل اسم النطاق إلى عنوان رقمي — يرجى التحقق من صحة كتابة النطاق أو من اتصال الإنترنت."
      : "Could not resolve the specified hostname — please check the domain spelling and your internet connection.";
  }
  if (lower.includes("no ipv4 address found")) {
    return isAr
      ? "لم يتم العثور على عنوان IPv4 مرتبط بهذا النطاق."
      : "No IPv4 address was found for the specified hostname.";
  }
  if (lower.includes("is ipv6")) {
    return isAr
      ? "العنوان المدخل من نوع IPv6 — يتطلب محرك مسار عنوان IPv4 أو نطاقاً يدعم IPv4."
      : "The entered address is IPv6 — Masar requires an IPv4 address or dual-stack hostname.";
  }
  if (
    lower.includes("elevated privileges") ||
    lower.includes("access is denied") ||
    lower.includes("permission denied")
  ) {
    return isAr
      ? "يتطلب الفحص المباشر لحزم الشبكة تشغيل برنامج مسار بصلاحية المسؤول (التشغيل كمسؤول) في نظام ويندوز."
      : "Raw ICMPv4 socket access requires Administrator privileges on Windows. Please right-click Masar and choose 'Run as administrator'.";
  }
  if (lower.includes("no trace telemetry available")) {
    return isAr
      ? "لا توجد بيانات فحص مسار حالياً — اضغط على «بدء الفحص» أولاً لاستخراج القراءات."
      : "No trace telemetry is available yet — click 'Start Trace' first to collect path metrics.";
  }
  if (lower.includes("failed to write report")) {
    return isAr
      ? "تعذّر حفظ ملف التقرير في المجلد المحدد — يرجى التحقق من صلاحيات الكتابة."
      : "Could not save the report file to the selected location — please check folder write permissions.";
  }

  return msg;
}

function localizeEdgeProvider(provider, lang) {
  if (lang !== "ar") return provider;
  const p = String(provider || "");
  if (p.includes("Cloudflare")) return "سحابة كلاودفلير العالمية";
  if (p.includes("Google")) return "سحابة جوجل العامة";
  if (p.includes("Quad9")) return "سحابة كواد 9 الأمنية";
  if (p.includes("OpenDNS") || p.includes("Cisco")) return "سحابة أوبن دي إن إس (سيسكو)";
  return p;
}

const INITIAL_HEALTH = {
  score: 100,
  severity: "idle",
  status: "Ready to Diagnose Network Path",
  detail:
    "Select a target preset (8.8.8.8 or 1.1.1.1) or enter any hostname/IPv4 address and click Start Trace.",
  culpritHop: 0,
};

const INITIAL_SPEED = {
  running: false,
  phase: "idle",
  downloadMbps: 0,
  peakDownloadMbps: 0,
  uploadMbps: 0,
  peakUploadMbps: 0,
  pingMs: 0,
  bestPingMs: 0,
  jitterMs: 0,
  totalMB: 0,
  downloadHistory: [],
  uploadHistory: [],
  pingHistory: [],
  edgePings: [
    { provider: "Cloudflare Anycast Edge", endpoint: "1.1.1.1:443", latencyMs: 0, avgMs: 0, bestMs: 0, history: [], status: "idle" },
    { provider: "Google Public Edge", endpoint: "8.8.8.8:443", latencyMs: 0, avgMs: 0, bestMs: 0, history: [], status: "idle" },
    { provider: "Quad9 Security Edge", endpoint: "9.9.9.9:443", latencyMs: 0, avgMs: 0, bestMs: 0, history: [], status: "idle" },
    { provider: "OpenDNS / Cisco Edge", endpoint: "208.67.222.222:443", latencyMs: 0, avgMs: 0, bestMs: 0, history: [], status: "idle" },
  ],
  updatedAt: "--:--:--",
};

const hasWailsBackend = () =>
  typeof window !== "undefined" &&
  window.go &&
  window.go.main &&
  window.go.main.App;

const hasWailsRuntime = () =>
  typeof window !== "undefined" &&
  window.runtime &&
  typeof window.runtime.EventsOn === "function";

function MasarLogo({ size = 24, className = "" }) {
  const rawId = useId();
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const gradId = `waveGrad-${safeId}`;
  const shadowId = `waveShadow-${safeId}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <filter
          id={shadowId}
          x="-10%"
          y="-10%"
          width="120%"
          height="130%"
          filterUnits="userSpaceOnUse"
        >
          <feDropShadow
            dx="0"
            dy="5"
            stdDeviation="5"
            floodColor="#0284c7"
            floodOpacity="0.28"
          />
        </filter>
      </defs>
      <rect
        x="1.5"
        y="1.5"
        width="97"
        height="97"
        rx="24.5"
        fill="#ffffff"
        stroke="#e2e8f0"
        strokeWidth="1.5"
      />
      <path
        d="M18 72C18 42 25 24 35 24C45 24 47 52 50 52C53 52 55 24 65 24C75 24 82 42 82 72C74 72 69 58 65 40C61 52 57 69 50 69C43 69 39 52 35 40C31 58 26 72 18 72Z"
        fill={`url(#${gradId})`}
        filter={`url(#${shadowId})`}
      />
    </svg>
  );
}

/* Miniature Visual Preview Screenshot of Masar UI (Dark Mode vs White Mode) */
function ThemePreviewMiniUI({ mode = "dark" }) {
  const isDark = mode === "dark";
  return (
    <div
      dir="ltr"
      style={{
        backgroundColor: isDark ? "#020617" : "#f1f5f9",
        borderColor: isDark ? "#1e293b" : "#cbd5e1",
        color: isDark ? "#f1f5f9" : "#0f172a",
      }}
      className="w-full rounded-xl overflow-hidden border shadow-md select-none"
    >
      {/* Mini Titlebar */}
      <div
        style={{
          backgroundColor: isDark ? "#020617" : "#f1f5f9",
        }}
        className="h-6 px-2.5 flex items-center justify-between"
      >
        <div className="flex items-center gap-1.5">
          <MasarLogo size={13} />
          <span
            style={{ color: isDark ? "#e2e8f0" : "#1e293b" }}
            className="text-[9px] font-bold"
          >
            Masar مسار
          </span>
          <span
            style={{
              backgroundColor: isDark ? "#082f49" : "#e0f2fe",
              color: isDark ? "#38bdf8" : "#0369a1",
              borderColor: isDark ? "#075985" : "#7dd3fc",
            }}
            className="text-[8px] px-1 rounded font-mono border"
          >
            v1.0
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400/60" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400/60" />
          <span className="w-1.5 h-1.5 rounded-full bg-red-400/80" />
        </div>
      </div>

      {/* Mini Body */}
      <div className="p-2.5 space-y-2">
        {/* Mini Control Card */}
        <div
          style={{
            backgroundColor: isDark ? "#0f172a" : "#ffffff",
            borderColor: isDark ? "#1e293b" : "#e2e8f0",
          }}
          className="rounded-lg p-1.5 border flex items-center justify-between gap-1 shadow-sm"
        >
          <div className="flex items-center gap-1">
            <span
              style={{
                backgroundColor: isDark ? "rgba(14,165,233,0.2)" : "#e0f2fe",
                color: isDark ? "#7dd3fc" : "#0369a1",
                borderColor: isDark ? "rgba(14,165,233,0.4)" : "#7dd3fc",
              }}
              className="px-1.5 py-0.5 rounded text-[8px] font-bold border"
            >
              Visual MTR
            </span>
            <span
              style={{ color: isDark ? "#94a3b8" : "#64748b" }}
              className="px-1 py-0.5 text-[8px]"
            >
              DNS
            </span>
            <span
              style={{ color: isDark ? "#94a3b8" : "#64748b" }}
              className="px-1 py-0.5 text-[8px]"
            >
              Ports
            </span>
          </div>
          <span
            style={{ backgroundColor: "#0ea5e9", color: "#020617" }}
            className="px-2 py-0.5 rounded text-[8px] font-bold"
          >
            ▶ Start
          </span>
        </div>

        {/* Mini Health Card */}
        <div
          style={{
            background: isDark
              ? "linear-gradient(90deg, rgba(6,78,59,0.55) 0%, #0f172a 60%, #0f172a 100%)"
              : "linear-gradient(90deg, #ecfdf5 0%, #ffffff 60%, #ffffff 100%)",
            borderColor: isDark ? "rgba(16,185,129,0.4)" : "#6ee7b7",
          }}
          className="rounded-lg p-2 border flex items-center justify-between shadow-sm"
        >
          <div className="space-y-0.5">
            <span
              style={{
                backgroundColor: isDark ? "rgba(16,185,129,0.2)" : "#d1fae5",
                color: isDark ? "#6ee7b7" : "#047857",
              }}
              className="inline-block text-[7px] font-bold px-1.5 py-0.2 rounded-full"
            >
              HEALTHY PATH
            </span>
            <div
              style={{ color: isDark ? "#ffffff" : "#0f172a" }}
              className="text-[9px] font-bold"
            >
              Optimal Path • 8.8.8.8
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="24" height="24" viewBox="0 0 32 32">
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke={isDark ? "#1e293b" : "#e2e8f0"}
                strokeWidth="3"
              />
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke="#10b981"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="68 90"
                transform="rotate(-90 16 16)"
              />
            </svg>
            <div
              style={{ color: isDark ? "#34d399" : "#059669" }}
              className="text-xs font-extrabold font-mono"
            >
              98%
            </div>
          </div>
        </div>

        {/* Mini Telemetry Table */}
        <div
          style={{
            backgroundColor: isDark ? "#0f172a" : "#ffffff",
            borderColor: isDark ? "#1e293b" : "#e2e8f0",
          }}
          className="rounded-lg border overflow-hidden shadow-sm"
        >
          <div
            style={{
              backgroundColor: isDark ? "#020617" : "#f8fafc",
              color: isDark ? "#94a3b8" : "#64748b",
              borderColor: isDark ? "#1e293b" : "#e2e8f0",
            }}
            className="px-2 py-1 text-[7px] font-mono uppercase flex justify-between border-b"
          >
            <span>#1 192.168.1.1</span>
            <span style={{ color: isDark ? "#34d399" : "#059669" }}>
              0.0% • 1.8ms
            </span>
          </div>
          <div
            style={{ color: isDark ? "#cbd5e1" : "#334155" }}
            className="px-2 py-1 text-[7px] font-mono uppercase flex justify-between"
          >
            <span>#5 8.8.8.8 (dns.google)</span>
            <span style={{ color: isDark ? "#38bdf8" : "#0284c7" }}>
              0.0% • 18.4ms
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Subtle Animated Background Layer for Each Section */
function SectionAmbientBackground({ variant = "mtr" }) {
  const palette = {
    mtr: {
      orb1: "rgba(56, 189, 248, 0.17)",
      orb2: "rgba(16, 185, 129, 0.15)",
      stroke: "#38bdf8",
      beam: "linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.7), rgba(16, 185, 129, 0.5), transparent)",
    },
    dns: {
      orb1: "rgba(56, 189, 248, 0.18)",
      orb2: "rgba(99, 102, 241, 0.15)",
      stroke: "#38bdf8",
      beam: "linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.7), rgba(99, 102, 241, 0.5), transparent)",
    },
    ports: {
      orb1: "rgba(16, 185, 129, 0.18)",
      orb2: "rgba(20, 184, 166, 0.15)",
      stroke: "#10b981",
      beam: "linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.7), rgba(20, 184, 166, 0.5), transparent)",
    },
    speed: {
      orb1: "rgba(56, 189, 248, 0.18)",
      orb2: "rgba(16, 185, 129, 0.16)",
      stroke: "#38bdf8",
      beam: "linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.75), rgba(16, 185, 129, 0.6), transparent)",
    },
  };
  const colors = palette[variant] || palette.mtr;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl z-0"
    >
      {/* Slowly panning dot-matrix grid */}
      <div className="absolute inset-0 masar-grid-pattern opacity-70" />

      {/* Drifting Ambient Orb 1 */}
      <div
        style={{ background: colors.orb1 }}
        className="masar-orb-1 absolute -top-16 -left-12 w-80 h-80 rounded-full blur-3xl"
      />

      {/* Drifting Ambient Orb 2 */}
      <div
        style={{ background: colors.orb2 }}
        className="masar-orb-2 absolute -bottom-16 -right-12 w-80 h-80 rounded-full blur-3xl"
      />

      {/* Subtle Floating Network Signal Wave */}
      <svg
        className="masar-wave-anim absolute bottom-0 left-0 w-[110%] h-24 opacity-[0.16]"
        viewBox="0 0 1200 120"
        fill="none"
        preserveAspectRatio="none"
      >
        <path
          d="M0 70 C 240 20, 420 110, 660 55 C 880 5, 1040 95, 1200 45"
          stroke={colors.stroke}
          strokeWidth="1.6"
          strokeDasharray="6 6"
        />
        <path
          d="M0 95 C 300 45, 540 115, 820 65 C 980 35, 1100 85, 1200 65"
          stroke={colors.stroke}
          strokeWidth="1"
          opacity="0.65"
        />
      </svg>

      {/* Subtle sweeping signal beam along the top edge */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] overflow-hidden">
        <div
          style={{ background: colors.beam }}
          className="masar-beam-line w-1/2 h-full"
        />
      </div>
    </div>
  );
}

function TabIcon({ id, active }) {
  const cls = `w-3.5 h-3.5 ${active ? "text-sky-400" : "text-slate-400"}`;
  if (id === "mtr") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === "dns") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "ports") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LatencySparkline({
  history = [],
  lossPercent = 0,
  width = 104,
  height = 24,
  colorOverride = "",
}) {
  if (!history || history.length === 0) {
    return <span className="text-xs text-slate-600">—</span>;
  }

  const samples = history.slice(-30);
  const minVal = Math.min(...samples);
  const maxVal = Math.max(...samples, minVal + 2);
  const range = Math.max(1, maxVal - minVal);

  const pts = samples.map((val, idx) => {
    const x =
      samples.length === 1
        ? width / 2
        : (idx / (samples.length - 1)) * (width - 6) + 3;
    const y = height - 4 - ((val - minVal) / range) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const strokeColor =
    colorOverride ||
    (lossPercent > 5.0
      ? "#ef4444"
      : lossPercent > 2.0
      ? "#fbbf24"
      : "#10b981");

  const fillColor =
    colorOverride === "#38bdf8"
      ? "rgba(56,189,248,0.16)"
      : lossPercent > 5.0
      ? "rgba(239,68,68,0.16)"
      : lossPercent > 2.0
      ? "rgba(251,191,36,0.16)"
      : "rgba(16,185,129,0.15)";

  const areaPoints = `3,${height - 2} ${pts.join(" ")} ${
    samples.length === 1 ? width / 2 : width - 3
  },${height - 2}`;

  const lastPt = pts[pts.length - 1].split(",");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block overflow-visible"
    >
      <polygon points={areaPoints} fill={fillColor} />
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts.join(" ")}
      />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="2.2" fill={strokeColor} />
    </svg>
  );
}

function HealthRadialGauge({
  score = 100,
  severity = "idle",
  unitLabel = "SCORE",
  isLight = false,
}) {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  const arcLength = 165.8; // 250 deg of r=38 (C = 238.76)
  const dashOffset = arcLength * (1 - clamped / 100);

  const strokeColor =
    severity === "critical"
      ? "#ef4444"
      : severity === "warning"
      ? "#f59e0b"
      : severity === "healthy"
      ? "#10b981"
      : "#38bdf8";

  const trackColor = isLight ? "#e2e8f0" : "#1e293b";
  const ringColor = isLight ? "rgba(148,163,184,0.28)" : "rgba(51,65,85,0.45)";

  return (
    <div className="relative w-[92px] h-[92px] shrink-0 flex items-center justify-center select-none">
      <svg width="92" height="92" viewBox="0 0 100 100" className="overflow-visible">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={ringColor}
          strokeWidth="1"
          strokeDasharray="2 4"
        />
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke={trackColor}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} 300`}
          transform="rotate(145 50 50)"
        />
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke={strokeColor}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} 300`}
          strokeDashoffset={dashOffset}
          transform="rotate(145 50 50)"
          className="masar-gauge-arc"
          style={{
            filter: isLight ? "none" : `drop-shadow(0 0 6px ${strokeColor}55)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
        <span
          dir="ltr"
          style={{ color: strokeColor }}
          className="text-xl font-extrabold font-mono leading-none tabular-nums"
        >
          {clamped}%
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">
          {unitLabel}
        </span>
      </div>
    </div>
  );
}

function ThroughputArcMeter({
  value = 0,
  peak = 100,
  color = "#38bdf8",
  active = false,
  isLight = false,
}) {
  const scaleMax = Math.max(100, (Number(peak) || 0) * 1.15);
  const pct = Math.max(0, Math.min(100, ((Number(value) || 0) / scaleMax) * 100));
  const arcLength = 104.7; // 250 deg of r=24 (C = 150.8)
  const dashOffset = arcLength * (1 - pct / 100);
  const trackColor = isLight ? "#e2e8f0" : "#1e293b";

  return (
    <div className="relative w-14 h-14 shrink-0 flex items-center justify-center select-none">
      <svg width="56" height="56" viewBox="0 0 64 64" className="overflow-visible">
        <circle
          cx="32"
          cy="32"
          r="24"
          fill="none"
          stroke={trackColor}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} 200`}
          transform="rotate(145 32 32)"
        />
        <circle
          cx="32"
          cy="32"
          r="24"
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} 200`}
          strokeDashoffset={dashOffset}
          transform="rotate(145 32 32)"
          className="masar-gauge-arc"
          style={{
            filter:
              active && !isLight ? `drop-shadow(0 0 5px ${color}66)` : "none",
          }}
        />
      </svg>
      <span
        dir="ltr"
        style={{ color }}
        className="absolute text-[10px] font-mono font-extrabold tabular-nums"
      >
        {Math.round(pct)}%
      </span>
    </div>
  );
}

function ThemeRadioIndicator({ active }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex items-center justify-center shrink-0 rounded-full transition-all duration-200"
      style={{
        width: 18,
        height: 18,
        border: `2px solid ${active ? "#0ea5e9" : "#94a3b8"}`,
        backgroundColor: active ? "#0ea5e9" : "transparent",
        boxShadow: active ? "0 0 0 4px rgba(14, 165, 233, 0.22)" : "none",
      }}
    >
      {active && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6.3l2.3 2.3 4.7-4.9"
            stroke="#ffffff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

// Browser simulation helper for Live Speed Benchmark
function buildSimulatedSpeedSnapshot(prev, tick) {
  const isUpload = tick % 20 >= 12;
  const phase = isUpload ? "upload" : "download";
  const downVal = isUpload ? 642.8 : 642.8;
  const upVal = 318.5;
  const pingVal = 11.2;
  const jitterVal = 0.6;

  const defaultDown = [
    210.4, 245.1, 280.6, 315.2, 360.4, 410.8, 465.2, 512.4, 550.8, 585.2,
    610.5, 628.4, 642.8, 655.1, 670.4, 684.2, 665.8, 652.4, 642.8,
  ];
  const defaultUp = [
    75.2, 98.4, 125.1, 150.5, 185.2, 215.4, 248.1, 275.4, 298.2, 312.4,
    325.5, 335.0, 328.4, 322.1, 318.5,
  ];
  const defaultPing = [
    12.4, 11.8, 12.1, 11.5, 12.6, 11.4, 11.9, 12.2, 11.3, 11.6, 11.2,
  ];

  const downHist = prev?.downloadHistory?.length > 5 ? [...prev.downloadHistory, downVal].slice(-40) : defaultDown;
  const upHist = prev?.uploadHistory?.length > 5 ? [...prev.uploadHistory, upVal].slice(-40) : defaultUp;
  const pingHist = prev?.pingHistory?.length > 5 ? [...prev.pingHistory, pingVal].slice(-40) : defaultPing;

  const baseEdges = [
    { provider: "Cloudflare Anycast Edge", endpoint: "1.1.1.1:443", base: 11.2, hist: [11.8, 12.1, 11.4, 11.9, 11.2, 11.5, 11.1, 11.4, 11.2] },
    { provider: "Google Public Edge", endpoint: "8.8.8.8:443", base: 16.8, hist: [17.5, 16.9, 17.2, 16.8, 17.1, 16.7, 16.9, 16.8] },
    { provider: "Quad9 Security Edge", endpoint: "9.9.9.9:443", base: 21.4, hist: [22.4, 21.8, 22.1, 21.4, 21.9, 21.3, 21.6, 21.4] },
    { provider: "OpenDNS / Cisco Edge", endpoint: "208.67.222.222:443", base: 24.1, hist: [25.2, 24.6, 24.9, 24.1, 24.5, 23.9, 24.3, 24.1] },
  ];

  const edgePings = baseEdges.map((be) => {
    const hist = be.hist;
    const sum = hist.reduce((a, b) => a + b, 0);
    return {
      provider: be.provider,
      endpoint: be.endpoint,
      latencyMs: be.base,
      avgMs: Number((sum / hist.length).toFixed(1)),
      bestMs: Number(Math.min(...hist).toFixed(1)),
      history: hist,
      status: "online",
    };
  });

  return {
    running: true,
    phase,
    downloadMbps: downVal,
    peakDownloadMbps: 684.2,
    uploadMbps: upVal,
    peakUploadMbps: 335.0,
    pingMs: pingVal,
    bestPingMs: 9.8,
    jitterMs: jitterVal,
    totalMB: 148.4,
    downloadHistory: downHist,
    uploadHistory: upHist,
    pingHistory: pingHist,
    edgePings,
    updatedAt: "18:42:15",
  };
}

// Browser simulation helper for MTR
function buildSimulatedSnapshot(target, tick, scenario) {
  const baseHops = [
    {
      hop: 1,
      ip: "192.168.1.1",
      hostname: "home-gateway.local",
      location: "Local LAN / Gateway",
      asn: "Private RFC1918",
      baseRtt: scenario === "wifi_loss" ? 42.0 : 2.1,
      lossRate: scenario === "wifi_loss" ? 8.5 : 0.0,
      jitter: scenario === "wifi_loss" ? 18.4 : 0.4,
    },
    {
      hop: 2,
      ip: "10.24.0.1",
      hostname: "bng-core-01.isp.net",
      location: "SA • Riyadh",
      asn: "AS39891 STC Gateway",
      baseRtt: scenario === "isp_loss" ? 95.0 : 9.4,
      lossRate: scenario === "isp_loss" ? 6.8 : 0.0,
      jitter: scenario === "isp_loss" ? 22.1 : 1.1,
    },
    {
      hop: 3,
      ip: "172.16.12.45",
      hostname: "pe-backbone-04.isp.net",
      location: "SA • Jeddah IXP",
      asn: "AS39891 Backbone",
      baseRtt: 14.2,
      lossRate: 0.0,
      jitter: 1.3,
    },
    {
      hop: 4,
      ip: "72.14.215.85",
      hostname: "peer-ix.google.com",
      location: "AE • Dubai Peering",
      asn: "AS15169 Google Edge",
      baseRtt: 19.8,
      lossRate: 0.0,
      jitter: 1.5,
    },
    {
      hop: 5,
      ip: target || "8.8.8.8",
      hostname:
        target === "8.8.8.8"
          ? "dns.google"
          : target === "1.1.1.1"
          ? "one.one.one.one"
          : "target.endpoint.net",
      location: "Global Anycast",
      asn: target === "1.1.1.1" ? "AS13335 Cloudflare" : "AS15169 Google LLC",
      baseRtt: 24.6,
      lossRate:
        scenario === "wifi_loss" ? 7.2 : scenario === "isp_loss" ? 5.9 : 0.0,
      jitter: 1.4,
      reachedDest: true,
    },
  ];

  const hops = baseHops.map((h) => {
    const sent = Math.max(12, tick);
    const lost = Math.round((sent * h.lossRate) / 100);
    const received = Math.max(0, sent - lost);
    const lossPercent = sent > 0 ? ((sent - received) / sent) * 100 : 0;
    const history = Array.from({ length: Math.min(20, Math.max(12, tick)) }, (_, idx) =>
      Number(
        Math.max(
          0.5,
          h.baseRtt + Math.sin(idx + h.hop) * h.jitter * 0.7
        ).toFixed(1)
      )
    );
    const lastMs = history[history.length - 1] || h.baseRtt;
    return {
      hop: h.hop,
      ip: h.ip,
      hostname: h.hostname,
      location: h.location,
      asn: h.asn,
      sent,
      received,
      lossPercent: Number(lossPercent.toFixed(1)),
      lastMs: Number(lastMs.toFixed(1)),
      avgMs: Number(h.baseRtt.toFixed(1)),
      bestMs: Number(Math.max(0.4, h.baseRtt - h.jitter).toFixed(1)),
      worstMs: Number((h.baseRtt + h.jitter * 1.8).toFixed(1)),
      jitterMs: Number(h.jitter.toFixed(1)),
      history,
      reachedDest: Boolean(h.reachedDest),
    };
  });

  const health = {
    score: 98,
    severity: "healthy",
    status: "Connection is Healthy — Optimal Path Performance",
    detail: `End-to-end latency to ${target || "8.8.8.8"} is 24.6 ms (jitter 1.4 ms, loss 0.0%).`,
    culpritHop: 0,
  };

  return {
    target: target || "8.8.8.8",
    resolvedIp: target || "8.8.8.8",
    updatedAt: "18:42:15",
    hops,
    health,
    running: true,
  };
}

const getUrlQueryParam = (key) => {
  if (typeof window === "undefined") return null;
  try {
    return new URLSearchParams(window.location.search).get(key);
  } catch {
    return null;
  }
};

export default function App() {
  const [lang, setLang] = useState(() => {
    const q = getUrlQueryParam("lang");
    if (q === "ar" || q === "en") return q;
    try {
      return localStorage.getItem("masar_lang") || "ar";
    } catch {
      return "ar";
    }
  });
  const [uiTheme, setUiTheme] = useState(() => {
    const q = getUrlQueryParam("theme");
    if (q === "light" || q === "dark") return q;
    try {
      return localStorage.getItem("masar_theme") || "dark";
    } catch {
      return "dark";
    }
  });
  const [settingsOpen, setSettingsOpen] = useState(() => getUrlQueryParam("settings") === "1");
  const [reportModalOpen, setReportModalOpen] = useState(() => getUrlQueryParam("report") === "1");
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const q = getUrlQueryParam("tab");
    return q && ["mtr", "dns", "ports", "speed"].includes(q) ? q : "mtr";
  });
  const [target, setTarget] = useState(() => getUrlQueryParam("target") || "8.8.8.8");
  const [isRunning, setIsRunning] = useState(() => getUrlQueryParam("trace") === "1");
  const [isMaximized, setIsMaximized] = useState(false);
  const [snapshot, setSnapshot] = useState(() => {
    if (getUrlQueryParam("trace") === "1" || getUrlQueryParam("report") === "1") {
      return buildSimulatedSnapshot(getUrlQueryParam("target") || "8.8.8.8", 15, "healthy");
    }
    return {
      target: "8.8.8.8",
      resolvedIp: "8.8.8.8",
      updatedAt: "--:--:--",
      hops: [],
      health: INITIAL_HEALTH,
    };
  });
  const [errorBanner, setErrorBanner] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const [exportFeedback, setExportFeedback] = useState("");
  const [reportNotice, setReportNotice] = useState("");
  const reportNoticeTimerRef = useRef(null);
  const [simScenario] = useState("healthy");
  const simTimerRef = useRef(null);
  const simTickRef = useRef(15);

  // Multi-Tools State
  const [dnsTarget, setDnsTarget] = useState("google.com");
  const [dnsLoading, setDnsLoading] = useState(false);
  const [dnsReport, setDnsReport] = useState(null);

  const [portHost, setPortHost] = useState("8.8.8.8");
  const [portLoading, setPortLoading] = useState(false);
  const [portReport, setPortReport] = useState(null);

  // Continuous Live Speed Benchmark State
  const [speedRunning, setSpeedRunning] = useState(() => getUrlQueryParam("speed") === "1");
  const [speedSnap, setSpeedSnap] = useState(() => {
    if (getUrlQueryParam("speed") === "1") {
      return buildSimulatedSpeedSnapshot(INITIAL_SPEED, 8);
    }
    return INITIAL_SPEED;
  });
  const speedSimTimerRef = useRef(null);
  const speedSimTickRef = useRef(8);

  const appVersion = useAppVersion();
  const versionDisplay = appVersion ? `v${appVersion}` : "v1.0.0";

  const t = I18N[lang] || I18N.en;

  const selectLanguage = (nextLang) => {
    setLang(nextLang);
    try {
      localStorage.setItem("masar_lang", nextLang);
    } catch {
      // ignore storage error
    }
    setTimeout(() => setLangMenuOpen(false), 180);
  };

  const selectTheme = (nextTheme) => {
    setUiTheme(nextTheme);
    try {
      localStorage.setItem("masar_theme", nextTheme);
    } catch {
      // ignore storage error
    }
  };

  useEffect(() => {
    const isLight = uiTheme === "light";
    if (typeof document !== "undefined") {
      const rootEl = document.documentElement;
      const bodyEl = document.body;
      rootEl.classList.toggle("theme-light", isLight);
      rootEl.classList.toggle("dark", !isLight);
      rootEl.style.colorScheme = isLight ? "light" : "dark";
      if (bodyEl) {
        bodyEl.classList.toggle("theme-light", isLight);
      }
    }
    const applyNativeWindowTheme = () => {
      if (!hasWailsRuntime()) return;
      if (isLight) {
        window.runtime.WindowSetLightTheme?.();
        window.runtime.WindowSetBackgroundColour?.(241, 245, 249, 255);
      } else {
        window.runtime.WindowSetDarkTheme?.();
        window.runtime.WindowSetBackgroundColour?.(5, 8, 17, 255);
      }
    };
    applyNativeWindowTheme();
    const timer = setTimeout(applyNativeWindowTheme, 120);
    return () => clearTimeout(timer);
  }, [uiTheme]);

  useEffect(() => {
    if (!hasWailsRuntime()) return;

    const offUpdate = window.runtime.EventsOn("mtr:update", (snap) => {
      if (snap) {
        setSnapshot(snap);
        if (typeof snap.running === "boolean") {
          setIsRunning(snap.running);
        }
      }
    });

    const offStatus = window.runtime.EventsOn("mtr:status", (st) => {
      if (st && typeof st.running === "boolean") {
        setIsRunning(st.running);
      }
    });

    const offError = window.runtime.EventsOn("mtr:error", (errMsg) => {
      if (errMsg) {
        setErrorBanner(String(errMsg));
        setIsRunning(false);
      }
    });

    const offSpeedUpdate = window.runtime.EventsOn("speed:update", (snap) => {
      if (snap) {
        setSpeedSnap(snap);
        if (typeof snap.running === "boolean") {
          setSpeedRunning(snap.running);
        }
      }
    });

    const offSpeedStatus = window.runtime.EventsOn("speed:status", (st) => {
      if (st && typeof st.running === "boolean") {
        setSpeedRunning(st.running);
      }
    });

    const syncInterval = setInterval(async () => {
      if (!hasWailsBackend()) return;
      try {
        if (window.go.main.App.GetLastSnapshot) {
          const snap = await window.go.main.App.GetLastSnapshot();
          if (snap) {
            if (typeof snap.running === "boolean") {
              setIsRunning(snap.running);
            }
            if (snap.hops && snap.hops.length > 0) {
              setSnapshot(snap);
            }
          }
        }
        if (window.go.main.App.GetLastSpeedSnapshot) {
          const sp = await window.go.main.App.GetLastSpeedSnapshot();
          if (sp && typeof sp.running === "boolean") {
            setSpeedRunning(sp.running);
            if (sp.running || sp.totalMB > 0) {
              setSpeedSnap(sp);
            }
          }
        }
      } catch {
        // ignore transient RPC errors
      }
    }, 500);

    return () => {
      clearInterval(syncInterval);
      if (typeof offUpdate === "function") offUpdate();
      if (typeof offStatus === "function") offStatus();
      if (typeof offError === "function") offError();
      if (typeof offSpeedUpdate === "function") offSpeedUpdate();
      if (typeof offSpeedStatus === "function") offSpeedStatus();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
      if (speedSimTimerRef.current) clearInterval(speedSimTimerRef.current);
      if (reportNoticeTimerRef.current) clearTimeout(reportNoticeTimerRef.current);
    };
  }, []);

  const handleMinimize = () => {
    if (window.runtime?.WindowMinimise) {
      window.runtime.WindowMinimise();
    }
  };

  const handleToggleMaximize = async () => {
    if (window.runtime?.WindowToggleMaximise) {
      window.runtime.WindowToggleMaximise();
      if (window.runtime?.WindowIsMaximised) {
        try {
          const max = await window.runtime.WindowIsMaximised();
          setIsMaximized(Boolean(max));
          return;
        } catch {
          // fallback toggle
        }
      }
    }
    setIsMaximized((prev) => !prev);
  };

  const handleClose = () => {
    if (window.runtime?.Quit) {
      window.runtime.Quit();
    } else if (typeof window !== "undefined") {
      window.close();
    }
  };

  const handleStartStop = async () => {
    setErrorBanner("");
    if (isRunning) {
      await stopTrace();
    } else {
      await startTrace(target);
    }
  };

  const startTrace = async (targetHost) => {
    const clean = (targetHost || "").trim();
    if (!clean) {
      setErrorBanner("Please enter a valid target IPv4 address or hostname.");
      return;
    }

    if (hasWailsBackend()) {
      try {
        setIsRunning(true);
        await window.go.main.App.StartTrace(clean);
      } catch (err) {
        setIsRunning(false);
        setErrorBanner(typeof err === "string" ? err : err?.message || String(err));
      }
    } else {
      startBrowserSimulation(clean, simScenario);
    }
  };

  const stopTrace = async () => {
    if (hasWailsBackend()) {
      try {
        await window.go.main.App.StopTrace();
      } catch (err) {
        console.error(err);
      }
      setIsRunning(false);
    } else {
      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
      setIsRunning(false);
    }
  };

  const startBrowserSimulation = (cleanTarget, scenario) => {
    if (simTimerRef.current) clearInterval(simTimerRef.current);
    simTickRef.current = 0;
    setIsRunning(true);

    const runSimStep = () => {
      simTickRef.current += 1;
      const tick = simTickRef.current;
      const simulated = buildSimulatedSnapshot(cleanTarget, tick, scenario);
      setSnapshot(simulated);
    };

    runSimStep();
    simTimerRef.current = setInterval(runSimStep, 1000);
  };

  const showReportConfirmation = (msg) => {
    setReportNotice(msg);
    if (reportNoticeTimerRef.current) {
      clearTimeout(reportNoticeTimerRef.current);
    }
    reportNoticeTimerRef.current = setTimeout(() => {
      setReportNotice("");
    }, 6500);
  };

  const handleCopySummary = async () => {
    setErrorBanner("");
    try {
      let reportText = "";
      if (hasWailsBackend()) {
        if (window.go.main.App.CopySupportSummaryWithLang) {
          reportText = await window.go.main.App.CopySupportSummaryWithLang(lang);
        } else {
          reportText = await window.go.main.App.CopySupportSummary();
        }
      } else {
        const locH = localizeHealth(snapshot?.health, snapshot?.hops || [], lang);
        reportText = buildBrowserDetailedReport(snapshot, lang, locH, appVersion);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(reportText);
        }
      }
      if (reportText) {
        setCopyFeedback(t.copiedSummary);
        setTimeout(() => setCopyFeedback(""), 2600);
        showReportConfirmation(
          lang === "ar"
            ? "تم نسخ التقرير التشخيصي الشامل (مع تحليل المقاطع وشرح جميع البيانات المستخرجة) إلى الحافظة — جاهز للصق فوراً."
            : "Detailed diagnostic report (including segment breakdown & metric reference guide) copied to clipboard."
        );
      }
    } catch (err) {
      setErrorBanner(typeof err === "string" ? err : err?.message || String(err));
    }
  };

  const handleExportReport = async (format) => {
    setErrorBanner("");
    try {
      if (hasWailsBackend() && window.go.main.App.ExportReport) {
        const savedPath = window.go.main.App.ExportReportWithLang
          ? await window.go.main.App.ExportReportWithLang(format, lang)
          : await window.go.main.App.ExportReport(`${format}:${lang}`);
        if (savedPath) {
          const fmtUpper = format.toUpperCase();
          setExportFeedback(fmtUpper);
          setTimeout(() => setExportFeedback(""), 2800);
          if (format === "html") {
            showReportConfirmation(
              lang === "ar" ? (
                <>
                  تم حفظ التقرير الرسمي القابل للطباعة بصيغة PDF في المسار:{" "}
                  <bdi dir="ltr" className="font-mono px-1">
                    {savedPath}
                  </bdi>{" "}
                  — افتح الملف واضغط على «حفظ كملف PDF / طباعة التقرير».
                </>
              ) : (
                <>
                  Official printable PDF/HTML report saved to:{" "}
                  <span className="font-mono">{savedPath}</span> — Open it and click "Save as PDF / Print".
                </>
              )
            );
          } else {
            showReportConfirmation(
              lang === "ar" ? (
                <>
                  تم تصدير ملف البيانات المفصل (<bdi dir="ltr" className="font-mono">{fmtUpper}</bdi>) مع قاموس شرح المؤشرات في:{" "}
                  <bdi dir="ltr" className="font-mono px-1">
                    {savedPath}
                  </bdi>
                </>
              ) : (
                <>
                  Detailed {fmtUpper} report with metric dictionary saved to:{" "}
                  <span className="font-mono">{savedPath}</span>
                </>
              )
            );
          }
        }
      } else {
        const locH = localizeHealth(snapshot?.health, snapshot?.hops || [], lang);
        const blobData =
          format === "json"
            ? JSON.stringify(snapshot, null, 2)
            : buildBrowserDetailedReport(snapshot, lang, locH, appVersion);
        const blob = new Blob([blobData], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `masar-report-${snapshot.target}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        setExportFeedback(format.toUpperCase());
        setTimeout(() => setExportFeedback(""), 2800);
        showReportConfirmation(
          lang === "ar"
            ? `تم تنزيل ملف التقرير (${format.toUpperCase()}) بنجاح.`
            : `Report file (${format.toUpperCase()}) downloaded successfully.`
        );
      }
    } catch (err) {
      setErrorBanner(typeof err === "string" ? err : err?.message || String(err));
    }
  };

  const handlePresetSelect = (presetVal) => {
    setTarget(presetVal);
    if (isRunning) {
      startTrace(presetVal);
    }
  };

  const handleRunDNS = async (e) => {
    if (e) e.preventDefault();
    setDnsLoading(true);
    setErrorBanner("");
    try {
      if (hasWailsBackend() && window.go.main.App.RunDNSLookup) {
        const res = await window.go.main.App.RunDNSLookup(dnsTarget);
        setDnsReport(res);
      } else {
        setDnsReport({
          target: dnsTarget,
          queryTimeMs: 14.2,
          checkedAt: new Date().toTimeString().slice(0, 8),
          records: [
            { type: "A", value: "142.250.185.46" },
            { type: "AAAA", value: "2a00:1450:4001:810::200e" },
            { type: "MX", value: "10 smtp.google.com" },
            { type: "NS", value: "ns1.google.com" },
            { type: "TXT", value: "v=spf1 include:_spf.google.com ~all" },
          ],
        });
      }
    } catch (err) {
      setErrorBanner(typeof err === "string" ? err : err?.message || String(err));
    } finally {
      setDnsLoading(false);
    }
  };

  const handleRunPortScan = async (e) => {
    if (e) e.preventDefault();
    setPortLoading(true);
    setErrorBanner("");
    try {
      if (hasWailsBackend() && window.go.main.App.RunPortScan) {
        const res = await window.go.main.App.RunPortScan(portHost, []);
        setPortReport(res);
      } else {
        setPortReport({
          host: portHost,
          resolvedIp: portHost,
          openCount: 2,
          totalPorts: 6,
          durationMs: 312.5,
          results: [
            { port: 22, service: "SSH", state: "closed", latencyMs: 0 },
            { port: 53, service: "DNS", state: "open", latencyMs: 18.4 },
            { port: 80, service: "HTTP", state: "closed", latencyMs: 0 },
            { port: 443, service: "HTTPS", state: "open", latencyMs: 19.1 },
            { port: 3306, service: "MySQL", state: "closed", latencyMs: 0 },
            { port: 3389, service: "RDP", state: "closed", latencyMs: 0 },
          ],
        });
      }
    } catch (err) {
      setErrorBanner(typeof err === "string" ? err : err?.message || String(err));
    } finally {
      setPortLoading(false);
    }
  };

  // Continuous Live Speed Benchmark Toggle (Start / Stop)
  const handleToggleSpeedBenchmark = async () => {
    setErrorBanner("");
    if (speedRunning) {
      if (hasWailsBackend() && window.go.main.App.StopSpeedBenchmark) {
        await window.go.main.App.StopSpeedBenchmark();
      }
      if (speedSimTimerRef.current) {
        clearInterval(speedSimTimerRef.current);
        speedSimTimerRef.current = null;
      }
      setSpeedRunning(false);
    } else {
      if (hasWailsBackend() && window.go.main.App.StartSpeedBenchmark) {
        try {
          setSpeedRunning(true);
          await window.go.main.App.StartSpeedBenchmark();
        } catch (err) {
          setSpeedRunning(false);
          setErrorBanner(typeof err === "string" ? err : err?.message || String(err));
        }
      } else {
        speedSimTickRef.current = 0;
        setSpeedRunning(true);
        speedSimTimerRef.current = setInterval(() => {
          speedSimTickRef.current += 1;
          const tk = speedSimTickRef.current;
          setSpeedSnap((prev) => buildSimulatedSpeedSnapshot(prev, tk));
        }, 500);
      }
    }
  };

  const health = snapshot?.health || INITIAL_HEALTH;
  const hops = snapshot?.hops || [];
  const localizedHealth = localizeHealth(health, hops, lang);
  const localizedErrorBanner = localizeErrorMessage(errorBanner, lang);

  const hop1 = hops.find((h) => h.hop === 1) || null;
  const transitHops = hops.filter((h) => h.hop > 1 && !h.reachedDest);
  const respondingTransit = transitHops.filter((h) => h.received > 0);
  const silentTransitCount = transitHops.length - respondingTransit.length;
  const primaryIspHop = respondingTransit[0] || transitHops[0] || null;
  const destHop =
    hops.find((h) => h.reachedDest) ||
    (hops.length > 1 ? hops[hops.length - 1] : null);

  const getHealthTheme = (severity) => {
    const isLight = uiTheme === "light";
    switch (severity) {
      case "healthy":
        return {
          border: isLight ? "border-emerald-300" : "border-emerald-500/40",
          bg: isLight
            ? "from-emerald-50 via-white to-white"
            : "from-emerald-950/50 via-slate-900/90 to-slate-900/90",
          badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
          bar: "bg-emerald-500",
          scoreText: "text-emerald-400",
          label: t.badgeHealthy,
        };
      case "warning":
        return {
          border: isLight ? "border-amber-300" : "border-amber-500/50",
          bg: isLight
            ? "from-amber-50 via-white to-white"
            : "from-amber-950/50 via-slate-900/90 to-slate-900/90",
          badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
          bar: "bg-amber-400",
          scoreText: "text-amber-400",
          label: t.badgeWarning,
        };
      case "critical":
        return {
          border: isLight ? "border-red-300" : "border-red-500/60",
          bg: isLight
            ? "from-red-50 via-white to-white"
            : "from-red-950/55 via-slate-900/90 to-slate-900/90",
          badge: "bg-red-500/20 text-red-300 border-red-500/40",
          bar: "bg-red-500",
          scoreText: "text-red-400",
          label: t.badgeCritical,
        };
      default:
        return {
          border: "border-slate-800",
          bg: isLight
            ? "from-white via-white to-slate-50"
            : "from-slate-900 via-slate-900 to-slate-950",
          badge: "bg-slate-800 text-slate-300 border-slate-700",
          bar: "bg-sky-500",
          scoreText: "text-sky-400",
          label: t.badgeIdle,
        };
    }
  };

  const theme = getHealthTheme(health.severity);

  const getLossColorClass = (lossPct, sent, received) => {
    if (!sent || sent === 0 || (received === 0 && lossPct === 0)) {
      return "text-slate-500";
    }
    if (lossPct > 5.0) return "text-red-500 font-bold";
    if (lossPct > 2.0) return "text-amber-400 font-semibold";
    return "text-emerald-400 font-medium";
  };

  const getRowHighlightClass = (hop) => {
    if (hop.lossPercent > 5.0) {
      return "bg-red-950/20 hover:bg-red-950/35";
    }
    if (hop.lossPercent > 2.0) {
      return "bg-amber-950/15 hover:bg-amber-950/25";
    }
    return "hover:bg-slate-800/50";
  };

  const guideSections =
    lang === "ar"
      ? [
          {
            badge: "القسم الأول",
            title: "الفحص البصري للمسار وخريطة الموقع الجغرافي",
            summary:
              "الأداة الرئيسية في البرنامج؛ تجمع بين فحص الاستجابة وتتبع المسار في وقت واحد كل ثانية لاكتشاف مكان التقطيع أو ارتفاع زمن الاستجابة بدقة.",
            points: [
              "مؤشر جودة الاتصال (من 0% إلى 100%): يقيّم كفاءة خطك تلقائياً ويخبرك باللغة الواضحة هل الاتصال سليم أم يوجد خلل من الشبكة المنزلية والراوتر (القفزة 1) أو من مزود الخدمة (القفزتين 2 و3) أو من الخادم البعيد.",
              "خريطة المسار المعماري (4 مراحل): تعرض مسار الحزم بصرياً عبر أربع محطات: جهازك الحالي، ثم الراوتر المحلي، ثم بوابة المزود والربط الدولي، وصولاً إلى الوجهة النهائية.",
              "جدول القفزات اللحظي: يعرض لكل راوتر في الطريق رقم القفزة، والعنوان الرقمي واسم المضيف، والموقع الجغرافي ومزود الخدمة، ونسبة الفقد، وعدد الحزم المرسلة والمستلمة، وزمن الاستجابة الحالي والمتوسط، والتذبذب الزمني، ومنحنى الاستقرار لآخر 60 ثانية.",
              "الراوترات الصامتة: إذا كان أحد راوترات العبور يحجب رسائل الفحص أمنياً بينما يستجيب الخادم النهائي دون فقد، يضع البرنامج علامة (—) ولا يحتسبه كعطل وهمي.",
            ],
          },
          {
            badge: "القسم الثاني",
            title: "فاحص سجلات النطاقات والفحص العكسي",
            summary:
              "أداة لفحص خوادم أسماء النطاقات وتحليل جميع السجلات المرتبطة بأي موقع أو عنوان رقمي في أجزاء من الثانية.",
            points: [
              "فحص متوازٍ للسجلات: يستعلم في اللحظة نفسها عن سجلات A (عنوان IPv4)، وAAAA (عنوان IPv6)، وCNAME (الاسم البديل)، وMX (خوادم البريد)، وNS (خوادم النطاق)، وTXT (سجلات التحقق والحماية).",
              "الفحص العكسي: عند إدخال عنوان رقمي مثل (8.8.8.8) يقوم البرنامج بجلب الاسم العكسي المسجل لهذا العنوان في سجلات PTR.",
              "زمن الاستعلام: يقيس سرعة استجابة خادم النطاقات الحالي على شبكتك بالمللي ثانية.",
            ],
          },
          {
            badge: "القسم الثالث",
            title: "فاحص المنافذ المتوازي",
            summary:
              "يفحص المنافذ الأساسية لأي خادم أو جهاز على الشبكة لمعرفة الخدمات النشطة أو المحجوبة وسرعة استجابتها.",
            points: [
              "المنافذ المفحوصة: يفحص بشكل متوازٍ منافذ الخدمات القياسية مثل SSH (22)، وDNS (53)، وHTTP (80)، وHTTPS (443)، وSMB (445)، وMySQL (3306)، وRDP (3389)، وPostgreSQL (5432)، وRedis (6379).",
              "حالة المنفذ وزمن الاتصال: يوضح لكل منفذ ما إذا كان مفتوحاً باللون الأخضر أو مغلقاً، ويحسب زمن مصافحة الاتصال بالمللي ثانية.",
            ],
          },
          {
            badge: "القسم الرابع",
            title: "قياس السرعة المباشر والخوادم العالمية",
            summary:
              "محرك قياس سرعة واستجابة حي ومستمر يعمل عبر اتصالك الفعلي ولا يتوقف إلا عند ضغطك على زر الإيقاف.",
            points: [
              "قياس متعدد القنوات: يفتح 4 قنوات متوازية للتحميل و3 قنوات للرفع لقياس السرعة الفعلية لخط الإنترنت بالميجابت في الثانية مع تسجيل أعلى ذروة سرعة وحجم البيانات المتدفقة.",
              "مراقبة الخوادم العالمية كل ثانية: يقيس زمن الاستجابة والتذبذب بشكل متواصل كل ثانية نحو أشهر السحب العالمية (كلاودفلير وجوجل وكواد 9 وأوبن دي إن إس) مع رسم منحنى استقرار حي لكل خادم.",
            ],
          },
          {
            badge: "القسم الخامس",
            title: "تصدير التقارير الاحترافية وشرح البيانات",
            summary:
              "أدوات توثيق حالة الشبكة لمشاركتها مع الدعم الفني لشركة الاتصالات أو فريق تقنية المعلومات.",
            points: [
              "نسخ التقرير النصي: ينسخ تقريراً تشخيصياً شاملاً ومنسقاً بضغطة واحدة للصقه في تذاكر الدعم الفني أو المحادثات.",
              "التقرير الرسمي القابل للطباعة (PDF / HTML): ينشئ وثيقة رسمية تحمل شعار مسار وملخص التشخيص وجدول القفزات وشرح المؤشرات جاهزة للحفظ بصيغة PDF.",
              "تصدير JSON وCSV: لحفظ البيانات المهيكلة أو فتحها مباشرة في برنامج Microsoft Excel بدعم كامل للغة العربية.",
            ],
          },
        ]
      : [
          {
            badge: "Section 1",
            title: "Visual MTR & Geo-IP Route Topology",
            summary:
              "Combines real-time Ping and Traceroute every second over raw ICMPv4 sockets to pinpoint packet loss and latency bottlenecks.",
            points: [
              "Connection Health Score (0% – 100%): Automatically evaluates Hop 1 (Local Router/Wi-Fi), Hops 2-3 (ISP Gateway), and the target server to deliver a plain-language verdict.",
              "4-Stage Route Architecture: Visualizes packet flow from This Device → Local Gateway (Hop 1) → ISP & Transit Backbone → Target Destination.",
              "Real-Time Telemetry Table: Displays Hop #, IP/Hostname, Geo-IP Location & ASN, Loss %, Sent/Recv counts, Last/Avg RTT (ms), Jitter (ms), and a live 60-second sparkline.",
              "Smart ICMP Silent Filtering: Intermediate routers that drop ICMP Time Exceeded packets while downstream hops reply cleanly are marked as silent (—) rather than false 100% packet loss.",
            ],
          },
          {
            badge: "Section 2",
            title: "DNS Record & Reverse PTR Inspector",
            summary:
              "Concurrently resolves domain records and reverse IP lookups while measuring DNS resolver latency.",
            points: [
              "Concurrent Record Resolution: Queries A, AAAA, CNAME, MX, NS, and TXT records simultaneously.",
              "Reverse PTR Lookup: Resolves PTR hostnames when given an IPv4/IPv6 address.",
              "Query Time Telemetry: Measures exact DNS response time in milliseconds (ms).",
            ],
          },
          {
            badge: "Section 3",
            title: "Concurrent TCP Port Scanner",
            summary:
              "Tests standard infrastructure and service ports in parallel to verify reachability and firewall rules.",
            points: [
              "Standard Ports Scanned: Probes ports 22 (SSH), 53 (DNS), 80 (HTTP), 443 (HTTPS), 445 (SMB), 3306 (MySQL), 3389 (RDP), 5432 (PostgreSQL), 6379 (Redis), and 8080 (HTTP-Alt).",
              "Handshake Latency: Reports OPEN/CLOSED status and exact TCP three-way handshake RTT in milliseconds.",
            ],
          },
          {
            badge: "Section 4",
            title: "Live Continuous Bandwidth & Global Edge Benchmark",
            summary:
              "Streams multi-connection download/upload bandwidth tests and 1-second global Anycast edge pings continuously until stopped.",
            points: [
              "Multi-Stream Bandwidth Engine: Uses 4 parallel download streams and 3 upload streams to measure real-time and peak throughput (Mbps) and total data streamed (MB).",
              "Global Anycast Edge Matrix: Continuously probes Cloudflare, Google, Quad9, and OpenDNS edges every second with Best/Avg latency and live sparklines.",
            ],
          },
          {
            badge: "Section 5",
            title: "Diagnostic Reports & Export (Copy / PDF / JSON / CSV)",
            summary:
              "One-click reporting tools designed for ISP support tickets and network engineering documentation.",
            points: [
              "Copy Summary: Copies a formatted ASCII report directly to your clipboard.",
              "PDF / HTML Report: Generates a printable branded diagnostic report with health verdict and hop table.",
              "JSON & CSV Exports: Exports structured telemetry for Excel or monitoring pipelines.",
            ],
          },
        ];

  return (
    <div
      dir={t.dir}
      lang={lang}
      className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none pt-10 transition-colors duration-300 ${
        uiTheme === "light" ? "theme-light" : ""
      }`}
    >
      {/* Sleek Custom Frameless Titlebar */}
      <div
        dir="ltr"
        className="wails-drag h-10 w-full bg-slate-950/95 flex items-center justify-between px-3 select-none z-50 fixed top-0 left-0 right-0 backdrop-blur-md"
        style={{ WebkitAppRegion: "drag", "--wails-draggable": "drag" }}
        onDoubleClick={handleToggleMaximize}
      >
        {/* Left: Branding + Window Title */}
        <div className="flex items-center gap-2.5 pointer-events-none">
          <MasarLogo size={21} className="shrink-0 drop-shadow-sm" />
          <span className="text-xs font-semibold text-slate-200 tracking-wide flex items-center gap-1.5">
            <span>Masar</span>
            <span>مسار</span>
            <span className="text-[10px] text-sky-400 bg-sky-950/70 border border-sky-800/50 px-1.5 py-0.2 rounded font-mono">
              {versionDisplay}
            </span>
          </span>
          <span className="hidden sm:inline-block text-[11px] text-slate-500 border-l border-slate-800 pl-2.5">
            {t.appSubtitle}
          </span>
          {(isRunning || speedRunning) && (
            <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full ml-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {t.tracingLive}
            </span>
          )}
        </div>

        {/* Right: Window Controls */}
        <div
          className="wails-no-drag flex items-center gap-1"
          style={{ WebkitAppRegion: "no-drag", "--wails-draggable": "no-drag" }}
        >
          <button
            type="button"
            onClick={handleMinimize}
            className="h-7 w-9 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition"
            title={lang === "ar" ? "تصغير" : "Minimize"}
          >
            <svg width="10" height="2" viewBox="0 0 10 2" fill="currentColor">
              <rect width="10" height="2" rx="1" />
            </svg>
          </button>

          <button
            type="button"
            onClick={handleToggleMaximize}
            className="h-7 w-9 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition"
            title={
              isMaximized
                ? lang === "ar"
                  ? "استعادة الحجم"
                  : "Restore"
                : lang === "ar"
                ? "تكبير"
                : "Maximize"
            }
          >
            {isMaximized ? (
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              >
                <rect x="2" y="0.5" width="7.5" height="7.5" rx="1" />
                <path d="M0.5 2.5V9.5H7.5" />
              </svg>
            ) : (
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              >
                <rect x="0.5" y="0.5" width="9" height="9" rx="1" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="h-7 w-9 flex items-center justify-center rounded hover:bg-red-600 text-slate-400 hover:text-white transition"
            title={lang === "ar" ? "إغلاق" : "Close"}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            >
              <path d="M1 1L9 9M9 1L1 9" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Top Section: Same rounded-2xl border and max-w-7xl alignment edges as the cards below */}
      <header className="max-w-7xl w-full mx-auto px-6 pt-5">
        <div className="relative overflow-hidden bg-slate-900/60 border border-slate-800/90 rounded-2xl p-4 shadow-lg flex flex-col gap-3">
          <SectionAmbientBackground variant={activeTab} />
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            {/* Harmonized Vector Tool Navigation Bar */}
            <nav className="masar-well flex items-center bg-slate-950 border border-slate-800/90 rounded-xl p-1 gap-1">
              {[
                { id: "mtr", label: t.tabMtr },
                { id: "dns", label: t.tabDns },
                { id: "ports", label: t.tabPorts },
                { id: "speed", label: t.tabSpeed },
              ].map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setErrorBanner("");
                      setActiveTab(tab.id);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
                      active
                        ? "bg-sky-500/15 text-sky-300 border border-sky-500/35 shadow-sm"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent"
                    }`}
                  >
                    <TabIcon id={tab.id} active={active} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Quick Targets & Target Controls (Shown on Visual MTR Tab) */}
            {activeTab === "mtr" && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="masar-well flex items-center bg-slate-950 border border-slate-800/90 rounded-xl p-1 gap-1">
                  {PRESETS.map((preset) => {
                    const active = target.trim() === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => handlePresetSelect(preset.value)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                          active
                            ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent"
                        }`}
                      >
                        {lang === "ar" ? preset.labelAr : preset.labelEn}{" "}
                        <span className="font-mono text-[11px] opacity-75">
                          ({preset.value})
                        </span>
                      </button>
                    );
                  })}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    startTrace(target);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    dir="ltr"
                    type="text"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder={t.targetPlaceholder}
                    className="masar-well w-48 sm:w-56 bg-slate-950 border border-slate-700/80 focus:border-sky-500 focus:outline-none rounded-xl px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 font-mono"
                  />

                  <button
                    type="button"
                    onClick={handleStartStop}
                    className={`px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2 shadow-sm ${
                      isRunning
                        ? "bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40"
                        : "bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-500/20"
                    }`}
                  >
                    {isRunning ? (
                      <>
                        <span className="w-2 h-2 rounded-sm bg-red-400" />
                        <span>{t.stopTrace}</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3 fill-current" viewBox="0 0 12 12">
                          <path d="M2.5 1.5L10.5 6L2.5 10.5V1.5Z" />
                        </svg>
                        <span>{t.startTrace}</span>
                      </>
                    )}
                  </button>
                </form>

                <ExportToolbarCapsule
                  lang={lang}
                  hopsCount={hops.length}
                  copyFeedback={copyFeedback}
                  exportFeedback={exportFeedback}
                  onCopySummary={handleCopySummary}
                  onExportReport={handleExportReport}
                  onOpenStudio={() => setReportModalOpen(true)}
                />
              </div>
            )}
          </div>
        </div>
      </header>

      {localizedErrorBanner && (
        <div className="max-w-7xl w-full mx-auto px-6 pt-4">
          <div className="rounded-xl bg-red-950/60 border border-red-500/50 px-4 py-3 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-red-400 font-bold text-lg leading-none mt-0.5">
                ⚠
              </span>
              <div>
                <h3 className="text-sm font-semibold text-red-200">
                  {t.errorTitle}
                </h3>
                <p className="text-xs text-red-300/90 mt-0.5 leading-relaxed">
                  {localizedErrorBanner}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setErrorBanner("")}
              className="text-xs text-red-300 hover:text-white px-2.5 py-0.5 rounded bg-red-900/40 shrink-0 font-semibold"
            >
              {t.dismiss}
            </button>
          </div>
        </div>
      )}

      {activeTab === "mtr" && (
        <main
          key="tab-mtr"
          className="masar-tab-animate flex-1 max-w-7xl w-full mx-auto px-6 py-5 pb-16 flex flex-col gap-5"
        >
          {reportNotice && (
            <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/40 px-4 py-3 flex items-center justify-between gap-4 shadow-md">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 text-xs font-bold shrink-0">
                  ✓
                </span>
                <p className="text-xs text-emerald-200 font-semibold leading-relaxed break-all">
                  {reportNotice}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportNotice("")}
                className="text-xs text-emerald-300 hover:text-white px-2.5 py-0.5 rounded-lg bg-emerald-950/50 border border-emerald-500/30 shrink-0 font-semibold"
              >
                {t.dismiss}
              </button>
            </div>
          )}

          <section
            className={`masar-stagger-1 relative overflow-hidden rounded-2xl border ${theme.border} bg-gradient-to-r ${theme.bg} p-5 shadow-xl`}
          >
            <SectionAmbientBackground variant="mtr" />
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${theme.badge}`}
                  >
                    {theme.label}
                  </span>
                  <span className="text-xs text-slate-400">
                    {t.targetLabel}:{" "}
                    <bdi dir="ltr" className="font-mono text-slate-300">
                      {snapshot.target || target}
                      {snapshot.resolvedIp &&
                      snapshot.resolvedIp !== snapshot.target
                        ? ` (${snapshot.resolvedIp})`
                        : ""}
                    </bdi>
                  </span>
                  {snapshot.updatedAt && snapshot.updatedAt !== "--:--:--" && (
                    <span className="text-xs text-slate-500">
                      • {t.updatedLabel}:{" "}
                      <bdi dir="ltr" className="font-mono">
                        {snapshot.updatedAt}
                      </bdi>
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                    {localizedHealth.status}
                  </h2>

                  <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
                    {localizedHealth.detail}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <div className="masar-well px-3 py-1.5 rounded-xl border border-slate-800/80 flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {t.endToEndRtt}:
                    </span>
                    <span className="text-xs font-mono font-bold text-sky-400" dir="ltr">
                      {destHop && destHop.received > 0
                        ? `${destHop.avgMs.toFixed(1)} ms`
                        : "—"}
                    </span>
                  </div>

                  <div className="masar-well px-3 py-1.5 rounded-xl border border-slate-800/80 flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {t.routeJitter}:
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400" dir="ltr">
                      {destHop && destHop.received > 1
                        ? `${destHop.jitterMs.toFixed(1)} ms`
                        : "—"}
                    </span>
                  </div>

                  <div className="masar-well px-3 py-1.5 rounded-xl border border-slate-800/80 flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {t.endToEndLoss}:
                    </span>
                    <span
                      className={`text-xs font-mono font-bold ${
                        destHop && destHop.lossPercent > 2
                          ? "text-red-400"
                          : "text-slate-200"
                      }`}
                      dir="ltr"
                    >
                      {destHop && destHop.sent > 0
                        ? `${destHop.lossPercent.toFixed(1)}%`
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="lg:w-[348px] masar-well bg-slate-950/75 border border-slate-800/90 rounded-2xl p-4 flex items-center gap-4 shrink-0">
                <HealthRadialGauge
                  score={health.score}
                  severity={health.severity}
                  unitLabel={t.gaugeUnit}
                  isLight={uiTheme === "light"}
                />

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold truncate">
                    {t.healthScoreTitle}
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-slate-300 truncate">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            !hop1 || hop1.received === 0
                              ? "bg-slate-500"
                              : hop1.lossPercent > 5
                              ? "bg-red-500"
                              : hop1.lossPercent > 2
                              ? "bg-amber-400"
                              : "bg-emerald-400"
                          }`}
                        />
                        <span className="truncate">{t.hop1Label}</span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 shrink-0" dir="ltr">
                        {hop1 && hop1.received > 0
                          ? `${hop1.avgMs.toFixed(1)}ms`
                          : "—"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-slate-300 truncate">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            !primaryIspHop || primaryIspHop.received === 0
                              ? "bg-slate-500"
                              : primaryIspHop.lossPercent > 5
                              ? "bg-red-500"
                              : primaryIspHop.lossPercent > 2
                              ? "bg-amber-400"
                              : "bg-emerald-400"
                          }`}
                        />
                        <span className="truncate">{t.ispLabel}</span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 shrink-0" dir="ltr">
                        {primaryIspHop && primaryIspHop.received > 0
                          ? `${primaryIspHop.avgMs.toFixed(1)}ms`
                          : "—"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/70">
                      <span className="text-[11px] text-slate-400">
                        {t.totalHopsLabel}
                      </span>
                      <span className="font-mono text-xs font-bold text-sky-400" dir="ltr">
                        {hops.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {hops.length > 0 && (
            <section className="masar-stagger-2 relative overflow-hidden bg-slate-900/60 border border-slate-800/90 rounded-2xl p-4 shadow-lg space-y-3">
              <SectionAmbientBackground variant="mtr" />
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-sky-400 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="6" cy="6" r="3" />
                    <circle cx="18" cy="18" r="3" />
                    <path d="M8.5 8.5l7 7M15 6h3v3M6 15v3h3" strokeLinecap="round" />
                  </svg>
                  <span className="text-xs font-bold text-slate-200">
                    {t.topologyTitle}
                  </span>
                  <span className="hidden sm:inline text-xs text-slate-500">
                    — {t.topologySub}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1" dir="ltr">
                  {hops.map((h) => {
                    const isTimeout = !h.ip;
                    const isBad = h.lossPercent > 5.0;
                    const isWarn = h.lossPercent > 2.0;
                    return (
                      <span
                        key={h.hop}
                        title={
                          lang === "ar"
                            ? isTimeout
                              ? `القفزة #${h.hop}: ${t.timedOut}`
                              : `القفزة #${h.hop}: ${h.ip} (${h.avgMs.toFixed(1)} مللي ثانية)`
                            : isTimeout
                            ? `Hop #${h.hop}: ${t.timedOut}`
                            : `Hop #${h.hop}: ${h.ip} (${h.avgMs.toFixed(1)} ms)`
                        }
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono border transition ${
                          isTimeout
                            ? "bg-slate-950/80 border-slate-800 text-slate-500"
                            : isBad
                            ? "bg-red-950/50 border-red-500/40 text-red-300 font-bold"
                            : isWarn
                            ? "bg-amber-950/40 border-amber-500/40 text-amber-300"
                            : h.reachedDest
                            ? "bg-sky-500/20 border-sky-500/40 text-sky-300 font-bold"
                            : "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
                        }`}
                      >
                        #{h.hop} {isTimeout ? "•" : `${Math.round(h.avgMs)}ms`}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="masar-lift-card masar-well bg-slate-950/80 border border-slate-800/90 rounded-xl p-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold">
                      <span className="font-mono text-[10px] text-sky-400">01</span>
                      <span>{t.stageDevice}</span>
                    </div>
                    <div className="text-xs font-bold text-slate-200">
                      Masar ICMPv4
                    </div>
                    <div className="text-[11px] text-sky-400">
                      {t.stageDeviceSub}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M8 21h8M12 17v4" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                <div
                  className={`masar-lift-card masar-well rounded-xl p-3 border flex items-center justify-between ${
                    hop1 && hop1.lossPercent > 5
                      ? "bg-red-950/25 border-red-500/40"
                      : "bg-slate-950/80 border-slate-800/90"
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold">
                      <span className="font-mono text-[10px] text-emerald-400">02</span>
                      <span className="truncate">{t.stageRouter}</span>
                    </div>
                    {hop1?.ip ? (
                      <div className="text-xs font-mono font-bold text-slate-100 truncate text-start" dir="ltr">
                        {hop1.ip}
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-slate-300 truncate">
                        {t.awaitingProbes}
                      </div>
                    )}
                    <div className="text-[11px] text-emerald-400 truncate">
                      {hop1 && hop1.received > 0 ? (
                        lang === "ar" ? (
                          <>
                            <bdi dir="ltr" className="font-mono">
                              {hop1.avgMs.toFixed(1)} ms
                            </bdi>{" "}
                            • فقد{" "}
                            <bdi dir="ltr" className="font-mono">
                              {hop1.lossPercent.toFixed(1)}%
                            </bdi>
                          </>
                        ) : (
                          <span className="font-mono" dir="ltr">
                            {`${hop1.avgMs.toFixed(1)} ms • ${hop1.lossPercent.toFixed(1)}% loss`}
                          </span>
                        )
                      ) : (
                        t.timedOut
                      )}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-center text-slate-300 shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="14" width="20" height="6" rx="2" />
                      <path d="M6 17h.01M10 17h.01M12 10V4M8 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                <div className="masar-lift-card masar-well bg-slate-950/80 border border-slate-800/90 rounded-xl p-3 flex items-center justify-between">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold">
                      <span className="font-mono text-[10px] text-amber-400">03</span>
                      <span className="truncate">{t.stageIsp}</span>
                    </div>
                    {primaryIspHop?.ip ? (
                      <div className="text-xs font-mono font-bold text-slate-100 truncate text-start" dir="ltr">
                        {primaryIspHop.ip}
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-slate-200 truncate">
                        {`${respondingTransit.length} ${t.reachableHops}`}
                      </div>
                    )}
                    <div className="text-[11px] text-slate-400 truncate">
                      {primaryIspHop?.location || primaryIspHop?.asn ? (
                        <bdi dir="ltr" className="font-mono">
                          {primaryIspHop.location || primaryIspHop.asn}
                        </bdi>
                      ) : (
                        `${respondingTransit.length} ${t.reachableHops} • ${silentTransitCount} ${t.silentHops}`
                      )}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-center text-slate-300 shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M3.6 9h16.8M3.6 15h16.8" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                <div className="masar-lift-card bg-sky-950/20 border border-sky-500/35 rounded-xl p-3 flex items-center justify-between">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-sky-300 font-semibold">
                      <span className="font-mono text-[10px] text-sky-400">04</span>
                      <span className="truncate">{t.stageTarget}</span>
                    </div>
                    <div className="text-xs font-mono font-bold text-white truncate text-start" dir="ltr">
                      {destHop?.ip || snapshot.resolvedIp || target}
                    </div>
                    <div className="text-[11px] text-sky-300/90 truncate">
                      {destHop && destHop.received > 0 ? (
                        <>
                          <bdi dir="ltr" className="font-mono">
                            {destHop.avgMs.toFixed(1)} ms
                          </bdi>{" "}
                          •{" "}
                          {destHop.location ? (
                            <bdi dir="ltr" className="font-mono">
                              {destHop.location}
                            </bdi>
                          ) : lang === "ar" ? (
                            "شبكة عالمية"
                          ) : (
                            "Anycast"
                          )}
                        </>
                      ) : (
                        <bdi dir="ltr" className="font-mono">
                          {snapshot.target}
                        </bdi>
                      )}
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-300 shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="9" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="masar-stagger-3 relative flex-1 bg-slate-900/60 border border-slate-800/90 rounded-2xl overflow-hidden flex flex-col shadow-xl">
            <SectionAmbientBackground variant="mtr" />
            <div className="relative z-10 px-5 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-900/90">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-200">
                  {t.tableTitle}
                </h3>
                <span className="text-xs text-slate-500">— {t.tableSub}</span>
              </div>

              <div className="flex flex-wrap items-center gap-3.5 text-xs">
                <span className="inline-flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  {t.legendHealthy}
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  {t.legendWarn}
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {t.legendCrit}
                </span>

                <button
                  type="button"
                  onClick={() => setReportModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/35 text-[11px] font-bold transition flex items-center gap-1"
                >
                  <span>{lang === "ar" ? "؟" : "?"}</span>
                  <span>
                    {lang === "ar" ? "شرح الأعمدة والبيانات" : "Explain Metrics"}
                  </span>
                </button>
              </div>
            </div>

            <div className="relative z-10 overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse" dir="ltr">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-950/60">
                    <th className="py-3 px-4 w-14">{t.colHop}</th>
                    <th className="py-3 px-4">{t.colHost}</th>
                    <th className="py-3 px-4">{t.colGeo}</th>
                    <th className="py-3 px-4 text-right">{t.colLoss}</th>
                    <th className="py-3 px-4 text-right">{t.colSentRecv}</th>
                    <th className="py-3 px-4 text-right">{t.colLast}</th>
                    <th className="py-3 px-4 text-right">{t.colAvg}</th>
                    <th className="py-3 px-4 text-right">{t.colJitter}</th>
                    <th className="py-3 px-4 text-center">{t.colTrend}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm font-mono">
                  {hops.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-12 px-6 text-center text-slate-500 font-sans"
                      >
                        <div className="max-w-3xl mx-auto space-y-6">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-start" dir={t.dir}>
                            {[
                              {
                                step: "01",
                                title: t.stageDevice,
                                sub: t.stageDeviceSub,
                                subLtr: false,
                                accent: "text-sky-400 border-sky-500/30 bg-sky-500/10",
                              },
                              {
                                step: "02",
                                title: t.stageRouter,
                                sub:
                                  lang === "ar"
                                    ? "الشبكة المحلية • 192.168.1.x"
                                    : "192.168.1.x • LAN/Wi-Fi",
                                subLtr: lang !== "ar",
                                accent: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
                              },
                              {
                                step: "03",
                                title: t.stageIsp,
                                sub:
                                  lang === "ar"
                                    ? "مقسم المزود والربط الدولي"
                                    : "ASN • IXP Peering",
                                subLtr: lang !== "ar",
                                accent: "text-amber-400 border-amber-500/30 bg-amber-500/10",
                              },
                              {
                                step: "04",
                                title: t.stageTarget,
                                sub:
                                  lang === "ar"
                                    ? `الخادم الهدف (${target})`
                                    : `${target} • Anycast Edge`,
                                subLtr: lang !== "ar",
                                accent: "text-sky-300 border-sky-400/40 bg-sky-500/15",
                              },
                            ].map((node, i) => (
                              <div
                                key={i}
                                className="masar-lift-card masar-well bg-slate-950/75 border border-slate-800/90 rounded-xl p-3 space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                      lang === "ar" ? "" : "font-mono"
                                    } ${node.accent}`}
                                  >
                                    {lang === "ar"
                                      ? `المرحلة ${node.step}`
                                      : `HOP ${node.step}`}
                                  </span>
                                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400/60 animate-pulse" />
                                </div>
                                <div className="text-xs font-bold text-slate-200 truncate">
                                  {node.title}
                                </div>
                                <div
                                  className={`text-[11px] text-slate-500 truncate ${
                                    node.subLtr ? "font-mono" : ""
                                  }`}
                                  dir={node.subLtr ? "ltr" : t.dir}
                                >
                                  {node.sub}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-sm font-bold text-slate-200">
                              {t.emptyTitle}
                            </p>
                            <p className="text-xs text-slate-400 max-w-lg mx-auto">
                              {t.emptyDesc}
                            </p>
                          </div>

                          {/* Quick-Start Interactive Target Pills */}
                          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                            {PRESETS.map((preset) => (
                              <button
                                key={preset.value}
                                type="button"
                                onClick={() => {
                                  setTarget(preset.value);
                                  startTrace(preset.value);
                                }}
                                className="masar-lift-card masar-well px-3.5 py-2 rounded-xl bg-slate-950/90 hover:bg-sky-500/15 border border-slate-800 hover:border-sky-500/40 text-xs font-semibold text-slate-200 hover:text-sky-300 flex items-center gap-2"
                              >
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span>
                                  {lang === "ar" ? preset.labelAr : preset.labelEn}
                                </span>
                                <span className="font-mono text-[11px] text-sky-400">
                                  {preset.value}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      const maxPathRtt = Math.max(
                        25,
                        ...hops.map((x) => (x.received > 0 ? x.avgMs : 0))
                      );
                      return hops.map((hop) => {
                        const timedOut = !hop.ip;
                        const isCulprit =
                          health.culpritHop > 0 &&
                          health.culpritHop === hop.hop;
                        const rttBarPct =
                          hop.received > 0
                            ? Math.max(
                                8,
                                Math.min(100, (hop.avgMs / maxPathRtt) * 100)
                              )
                            : 0;

                        return (
                          <tr
                            key={hop.hop}
                            className={`masar-telemetry-row transition-colors ${getRowHighlightClass(
                              hop
                            )}`}
                          >
                            <td className="py-2.5 px-4 font-bold text-slate-300">
                              <div className="flex items-center gap-1.5">
                                <span>{hop.hop}</span>
                                {isCulprit && (
                                  <span
                                    title={
                                      lang === "ar"
                                        ? "مصدر الخلل الرئيسي المرصود تلقائياً"
                                        : "Primary bottleneck identified by Smart Health Evaluator"
                                    }
                                    className="text-xs text-red-400"
                                  >
                                    ▲
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-2.5 px-4">
                              {timedOut ? (
                                <span className="text-slate-500 italic text-xs font-sans">
                                  * * * (<bdi>{t.timedOut}</bdi>)
                                </span>
                              ) : (
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                  <span className="text-slate-100 font-semibold">
                                    {hop.ip}
                                  </span>
                                  {hop.hostname && (
                                    <span className="text-xs text-slate-400 truncate max-w-[210px]">
                                      ({hop.hostname})
                                    </span>
                                  )}
                                  {hop.hop === 1 && (
                                    <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                      <bdi>{t.roleRouter}</bdi>
                                    </span>
                                  )}
                                  {(hop.hop === 2 || hop.hop === 3) && (
                                    <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/70">
                                      <bdi>{t.roleIsp}</bdi>
                                    </span>
                                  )}
                                  {hop.reachedDest && (
                                    <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                      <bdi>{t.roleTarget}</bdi>
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-4 font-sans text-xs">
                              {timedOut ? (
                                <span className="text-slate-600">—</span>
                              ) : (
                                <div className="flex flex-col">
                                  <span className="text-slate-200 font-medium">
                                    <bdi>{hop.location || t.transitHop}</bdi>
                                  </span>
                                  {hop.asn && (
                                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">
                                      {hop.asn}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            <td
                              className={`py-2.5 px-4 text-right ${getLossColorClass(
                                hop.lossPercent,
                                hop.sent,
                                hop.received
                              )}`}
                            >
                              {hop.received === 0 && hop.lossPercent === 0
                                ? "—"
                                : `${hop.lossPercent.toFixed(1)}%`}
                            </td>

                            <td className="py-2.5 px-4 text-right text-slate-300">
                              {hop.sent} / {hop.received}
                            </td>

                            <td className="py-2.5 px-4 text-right text-slate-200">
                              {hop.received > 0 ? `${hop.lastMs.toFixed(1)}` : "—"}
                            </td>

                            <td className="py-2.5 px-4 text-right text-slate-200">
                              {hop.received > 0 ? (
                                <div className="inline-flex flex-col items-end gap-1">
                                  <span>{hop.avgMs.toFixed(1)}</span>
                                  <span className="w-12 h-1 rounded-full bg-slate-800 overflow-hidden">
                                    <span
                                      className={`block h-full rounded-full ${
                                        hop.avgMs > 120
                                          ? "bg-red-500"
                                          : hop.avgMs > 60
                                          ? "bg-amber-400"
                                          : "bg-sky-400"
                                      }`}
                                      style={{ width: `${rttBarPct}%` }}
                                    />
                                  </span>
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>

                            <td
                              className={`py-2.5 px-4 text-right ${
                                hop.jitterMs > 15
                                  ? "text-amber-400 font-semibold"
                                  : "text-slate-300"
                              }`}
                            >
                              {hop.received > 1
                                ? `${hop.jitterMs.toFixed(1)}`
                                : "0.0"}
                            </td>

                            <td className="py-2 px-4 text-center">
                              <LatencySparkline
                                history={hop.history}
                                lossPercent={hop.lossPercent}
                              />
                            </td>
                          </tr>
                        );
                      });
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}

      {/* TAB 2: DNS LOOKUP */}
      {activeTab === "dns" && (
        <main
          key="tab-dns"
          className="masar-tab-animate flex-1 max-w-7xl w-full mx-auto px-6 py-5 pb-16 flex flex-col gap-5"
        >
          <div className="masar-stagger-1 relative overflow-hidden bg-slate-900/60 border border-slate-800/90 rounded-2xl p-6 space-y-4 shadow-xl">
            <SectionAmbientBackground variant="dns" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">{t.dnsTitle}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{t.dnsDesc}</p>
              </div>
              <form onSubmit={handleRunDNS} className="flex items-center gap-2">
                <input
                  dir="ltr"
                  type="text"
                  value={dnsTarget}
                  onChange={(e) => setDnsTarget(e.target.value)}
                  placeholder={t.dnsPlaceholder}
                  className="masar-well w-64 bg-slate-950 border border-slate-700 focus:border-sky-500 focus:outline-none rounded-xl px-3 py-1.5 text-sm font-mono"
                />
                <button
                  type="submit"
                  disabled={dnsLoading}
                  className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm transition shadow-sm shadow-sky-500/20"
                >
                  {dnsLoading ? t.dnsResolving : t.dnsBtn}
                </button>
              </form>
            </div>

            {dnsReport ? (
              <div className="relative z-10 space-y-3 pt-2">
                <div className="masar-well flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 bg-slate-950/70 px-4 py-2.5 rounded-xl border border-slate-800">
                  <span>
                    {t.targetLabel}:{" "}
                    <bdi dir="ltr" className="font-mono text-slate-200 font-semibold">
                      {dnsReport.target}
                    </bdi>
                  </span>
                  <span className="text-sky-400 font-semibold">
                    {t.dnsQueryTime}:{" "}
                    <bdi dir="ltr" className="font-mono">
                      {dnsReport.queryTimeMs} ms
                    </bdi>
                  </span>
                  <span>
                    {t.dnsRecordsFound}:{" "}
                    <bdi dir="ltr" className="font-mono text-slate-200 font-semibold">
                      {dnsReport.records?.length || 0}
                    </bdi>
                  </span>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-800">
                  <table className="w-full text-left border-collapse text-sm font-mono" dir="ltr">
                    <thead>
                      <tr className="bg-slate-950 text-[11px] uppercase text-slate-400 border-b border-slate-800">
                        <th className="py-2.5 px-4 w-32">{t.dnsColType}</th>
                        <th className="py-2.5 px-4">{t.dnsColValue}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(dnsReport.records || []).map((rec, i) => (
                        <tr key={i} className="masar-telemetry-row hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 text-xs font-bold">
                              {rec.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-200 break-all">
                            {rec.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="relative z-10 pt-3 space-y-4">
                <div className="flex flex-wrap items-center gap-2" dir="ltr">
                  {["google.com", "cloudflare.com", "1.1.1.1", "quad9.net"].map(
                    (dom) => (
                      <button
                        key={dom}
                        type="button"
                        onClick={() => {
                          setDnsTarget(dom);
                        }}
                        className={`masar-lift-card masar-well px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold ${
                          dnsTarget === dom
                            ? "bg-sky-500/20 border-sky-500/40 text-sky-300"
                            : "bg-slate-950/75 border-slate-800 text-slate-300 hover:border-sky-500/35"
                        }`}
                      >
                        {dom}
                      </button>
                    )
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5" dir={t.dir}>
                  {[
                    {
                      type: "A",
                      desc: lang === "ar" ? "عنوان مضيف IPv4" : "IPv4 Host Address",
                    },
                    {
                      type: "AAAA",
                      desc: lang === "ar" ? "عنوان مضيف IPv6" : "IPv6 Host Address",
                    },
                    {
                      type: "CNAME",
                      desc: lang === "ar" ? "الاسم البديل للنطاق" : "Canonical Alias",
                    },
                    {
                      type: "MX",
                      desc: lang === "ar" ? "خوادم البريد الإلكتروني" : "Mail Exchange",
                    },
                    {
                      type: "NS",
                      desc: lang === "ar" ? "خوادم النطاق المعتمدة" : "Authoritative NS",
                    },
                    {
                      type: "TXT / PTR",
                      desc: lang === "ar" ? "سجلات التحقق والفحص العكسي" : "SPF, DMARC & rDNS",
                    },
                  ].map((item) => (
                    <div
                      key={item.type}
                      className="masar-lift-card masar-well bg-slate-950/75 border border-slate-800/90 rounded-xl p-3 space-y-1"
                    >
                      <span
                        dir="ltr"
                        className="inline-block px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[11px] font-mono font-bold"
                      >
                        {item.type}
                      </span>
                      <div className="text-[11px] text-slate-400">
                        {item.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {activeTab === "ports" && (
        <main
          key="tab-ports"
          className="masar-tab-animate flex-1 max-w-7xl w-full mx-auto px-6 py-5 pb-16 flex flex-col gap-5"
        >
          <div className="masar-stagger-1 relative overflow-hidden bg-slate-900/60 border border-slate-800/90 rounded-2xl p-6 space-y-4 shadow-xl">
            <SectionAmbientBackground variant="ports" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">{t.portTitle}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{t.portDesc}</p>
              </div>
              <form
                onSubmit={handleRunPortScan}
                className="flex items-center gap-2"
              >
                <input
                  dir="ltr"
                  type="text"
                  value={portHost}
                  onChange={(e) => setPortHost(e.target.value)}
                  placeholder={t.portPlaceholder}
                  className="masar-well w-64 bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:outline-none rounded-xl px-3 py-1.5 text-sm font-mono"
                />
                <button
                  type="submit"
                  disabled={portLoading}
                  className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition shadow-sm shadow-emerald-500/20"
                >
                  {portLoading ? t.portScanning : t.portBtn}
                </button>
              </form>
            </div>

            {portReport ? (
              <div className="relative z-10 space-y-3 pt-2">
                <div className="masar-well flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 bg-slate-950/70 px-4 py-2.5 rounded-xl border border-slate-800">
                  <bdi dir="ltr" className="font-mono text-slate-200 font-semibold">
                    {portReport.host} ({portReport.resolvedIp})
                  </bdi>
                  <span className="text-emerald-400 font-bold">
                    {t.portOpenCount}:{" "}
                    <bdi dir="ltr" className="font-mono">
                      {portReport.openCount} / {portReport.totalPorts}
                    </bdi>
                  </span>
                  <span>
                    {t.portDuration}:{" "}
                    <bdi dir="ltr" className="font-mono text-slate-200 font-semibold">
                      {portReport.durationMs} ms
                    </bdi>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5" dir="ltr">
                  {(portReport.results || []).map((r) => {
                    const isOpen = r.state === "open";
                    return (
                      <div
                        key={r.port}
                        className={`masar-lift-card p-3 rounded-xl border font-mono text-xs flex items-center justify-between ${
                          isOpen
                            ? "bg-emerald-950/35 border-emerald-500/50 text-emerald-200"
                            : "masar-well bg-slate-950/60 border-slate-800/80 text-slate-500"
                        }`}
                      >
                        <div>
                          <div className="font-bold text-sm">:{r.port}</div>
                          <div className="text-[11px] opacity-80">
                            {r.service}
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isOpen
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-slate-800 text-slate-500"
                            }`}
                          >
                            {isOpen ? t.stateOpen : t.stateClosed}
                          </span>
                          {isOpen && (
                            <div className="text-[11px] text-emerald-400 mt-1">
                              {r.latencyMs.toFixed(1)} ms
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="relative z-10 pt-3 space-y-4">
                <div className="flex flex-wrap items-center gap-2" dir="ltr">
                  {["8.8.8.8", "1.1.1.1", "google.com", "cloudflare.com"].map(
                    (hst) => (
                      <button
                        key={hst}
                        type="button"
                        onClick={() => setPortHost(hst)}
                        className={`masar-lift-card masar-well px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold ${
                          portHost === hst
                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                            : "bg-slate-950/75 border-slate-800 text-slate-300 hover:border-emerald-500/35"
                        }`}
                      >
                        {hst}
                      </button>
                    )
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5" dir="ltr">
                  {[
                    { port: 22, svc: "SSH" },
                    { port: 53, svc: "DNS" },
                    { port: 80, svc: "HTTP" },
                    { port: 443, svc: "HTTPS" },
                    { port: 445, svc: "SMB" },
                    { port: 3306, svc: "MySQL" },
                    { port: 3389, svc: "RDP" },
                    { port: 5432, svc: "PostgreSQL" },
                    { port: 6379, svc: "Redis" },
                    { port: 8080, svc: "HTTP-Alt" },
                  ].map((item) => (
                    <div
                      key={item.port}
                      className="masar-lift-card masar-well bg-slate-950/75 border border-slate-800/90 rounded-xl p-2.5 flex items-center justify-between font-mono text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-200">:{item.port}</div>
                        <div className="text-[10px] text-slate-500">{item.svc}</div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[9px] font-bold">
                        TCP
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {activeTab === "speed" && (
        <main
          key="tab-speed"
          className="masar-tab-animate flex-1 max-w-7xl w-full mx-auto px-6 py-5 pb-16 flex flex-col gap-5"
        >
          <div className="masar-stagger-1 relative overflow-hidden bg-slate-900/60 border border-slate-800/90 rounded-2xl p-6 space-y-6 shadow-xl">
            <SectionAmbientBackground variant="speed" />
            {/* Header + Start/Stop Live Button */}
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-lg font-bold text-white">
                    {t.speedTitle}
                  </h2>
                  {speedRunning && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                      {speedSnap.phase === "upload"
                        ? t.speedPhaseUp
                        : t.speedPhaseDown}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">{t.speedDesc}</p>
              </div>

              <button
                type="button"
                onClick={handleToggleSpeedBenchmark}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg shrink-0 ${
                  speedRunning
                    ? "bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40"
                    : "bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-500/20"
                }`}
              >
                {speedRunning ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-sm bg-red-400" />
                    <span>{t.speedStopBtn}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 12 12">
                      <path d="M2.5 1.5L10.5 6L2.5 10.5V1.5Z" />
                    </svg>
                    <span>{t.speedStartBtn}</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  className={`masar-lift-card masar-well bg-slate-950/85 border rounded-2xl p-5 flex flex-col justify-between gap-3 transition ${
                    speedRunning && speedSnap.phase === "download"
                      ? "border-sky-500/60 shadow-lg shadow-sky-500/10"
                      : "border-slate-800/90"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-wider text-slate-300 font-bold">
                      {t.speedDown}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                      {t.streamRxTag}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 my-1">
                    <div>
                      <div className="text-4xl font-extrabold text-sky-400 font-mono tracking-tight" dir="ltr">
                        {speedSnap.downloadMbps.toFixed(1)}
                        <span className="text-xs font-medium text-slate-400 ml-1.5">
                          Mbps
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        <span>{t.speedPeak}: </span>
                        <bdi dir="ltr" className="font-mono text-sky-300 font-semibold">
                          {speedSnap.peakDownloadMbps.toFixed(1)} Mbps
                        </bdi>
                      </div>
                    </div>

                    <ThroughputArcMeter
                      value={speedSnap.downloadMbps}
                      peak={speedSnap.peakDownloadMbps}
                      color="#38bdf8"
                      active={speedRunning && speedSnap.phase === "download"}
                      isLight={uiTheme === "light"}
                    />
                  </div>

                  <div className="pt-2.5 border-t border-slate-800/60 flex items-center justify-center">
                    <LatencySparkline
                      history={speedSnap.downloadHistory}
                      width={250}
                      height={34}
                      colorOverride="#38bdf8"
                    />
                  </div>
                </div>

                <div
                  className={`masar-lift-card masar-well bg-slate-950/85 border rounded-2xl p-5 flex flex-col justify-between gap-3 transition ${
                    speedRunning && speedSnap.phase === "upload"
                      ? "border-emerald-500/60 shadow-lg shadow-emerald-500/10"
                      : "border-slate-800/90"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-wider text-slate-300 font-bold">
                      {t.speedUp}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      {t.streamTxTag}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 my-1">
                    <div>
                      <div className="text-4xl font-extrabold text-emerald-400 font-mono tracking-tight" dir="ltr">
                        {speedSnap.uploadMbps.toFixed(1)}
                        <span className="text-xs font-medium text-slate-400 ml-1.5">
                          Mbps
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        <span>{t.speedPeak}: </span>
                        <bdi dir="ltr" className="font-mono text-emerald-300 font-semibold">
                          {speedSnap.peakUploadMbps.toFixed(1)} Mbps
                        </bdi>
                      </div>
                    </div>

                    <ThroughputArcMeter
                      value={speedSnap.uploadMbps}
                      peak={speedSnap.peakUploadMbps}
                      color="#10b981"
                      active={speedRunning && speedSnap.phase === "upload"}
                      isLight={uiTheme === "light"}
                    />
                  </div>

                  <div className="pt-2.5 border-t border-slate-800/60 flex items-center justify-center">
                    <LatencySparkline
                      history={speedSnap.uploadHistory}
                      width={250}
                      height={34}
                      colorOverride="#10b981"
                    />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                <div className="masar-lift-card masar-well bg-slate-950/85 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                      {t.speedPing}
                    </span>
                    <span className="text-[11px] text-emerald-400">
                      <span>{t.speedBest}: </span>
                      <bdi dir="ltr" className="font-mono font-semibold">
                        {speedSnap.bestPingMs.toFixed(1)} ms
                      </bdi>
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3" dir="ltr">
                    <div className="text-2xl font-extrabold text-white font-mono">
                      {speedSnap.pingMs.toFixed(1)}
                      <span className="text-xs font-normal text-slate-400 ml-1">
                        ms
                      </span>
                    </div>
                    <LatencySparkline
                      history={speedSnap.pingHistory}
                      width={128}
                      height={26}
                    />
                  </div>
                </div>

                <div className="masar-lift-card masar-well bg-slate-950/85 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                      {t.speedJitter}
                    </span>
                    <span className="text-[11px] text-slate-300">
                      <span>{t.speedTotalData}: </span>
                      <bdi dir="ltr" className="font-mono font-semibold">
                        {speedSnap.totalMB.toFixed(1)} MB
                      </bdi>
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-2xl font-extrabold text-amber-400 font-mono" dir="ltr">
                      {speedSnap.jitterMs.toFixed(1)}
                      <span className="text-xs font-normal text-slate-400 ml-1">
                        ms
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                      <span dir="ltr">{speedSnap.updatedAt}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded border font-semibold ${
                          speedRunning
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}
                      >
                        {speedRunning ? t.cadenceLive : t.cadenceIdle}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Global Anycast Edge Latency Matrix */}
            <div className="relative z-10 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {t.speedEdgesTitle}
                </h3>
                {!speedRunning && speedSnap.downloadMbps === 0 && (
                  <span className="text-xs text-slate-500">
                    {t.speedPhaseIdle}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3" dir={t.dir}>
                {(() => {
                  const edges = speedSnap.edgePings || [];
                  const maxEdgeRtt = Math.max(
                    35,
                    ...edges.map((e) => (e.status === "online" ? e.latencyMs : 0))
                  );
                  return edges.map((ep, idx) => {
                    const barPct =
                      ep.status === "online"
                        ? Math.max(
                            10,
                            Math.min(100, (ep.latencyMs / maxEdgeRtt) * 100)
                          )
                        : 0;
                    return (
                      <div
                        key={idx}
                        className="masar-lift-card masar-well bg-slate-950/80 border border-slate-800/90 rounded-xl px-4 py-3 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-200 truncate">
                            {localizeEdgeProvider(ep.provider, lang)}
                          </div>
                          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                            <bdi dir="ltr" className="font-mono">
                              {ep.endpoint}
                            </bdi>
                            {ep.bestMs > 0 && (
                              <span className="text-slate-400">
                                • {t.speedBest}:{" "}
                                <bdi dir="ltr" className="font-mono">
                                  {ep.bestMs.toFixed(1)} ms
                                </bdi>{" "}
                                • {t.speedAvg}:{" "}
                                <bdi dir="ltr" className="font-mono">
                                  {ep.avgMs.toFixed(1)} ms
                                </bdi>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0" dir="ltr">
                          <LatencySparkline
                            history={ep.history}
                            width={96}
                            height={24}
                          />
                          <div className="text-right font-mono w-20">
                            {ep.status === "online" ? (
                              <div className="inline-flex flex-col items-end gap-1 w-full">
                                <span className="text-emerald-400 font-bold text-sm">
                                  {ep.latencyMs.toFixed(1)} ms
                                </span>
                                <span className="w-16 h-1 rounded-full bg-slate-800 overflow-hidden">
                                  <span
                                    className="block h-full rounded-full bg-emerald-400 transition-all duration-300"
                                    style={{ width: `${barPct}%` }}
                                  />
                                </span>
                              </div>
                            ) : ep.status === "timeout" ? (
                              <span className="text-red-400 text-xs font-sans">
                                <bdi>{lang === "ar" ? "انتهت المهلة" : "Timeout"}</bdi>
                              </span>
                            ) : (
                              <span className="text-slate-600 text-xs">—</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Bottom-Right Corner Dock: Language Switcher + Settings Icon */}
      <div
        dir="ltr"
        className="fixed bottom-3 right-6 z-40 flex items-center gap-3"
      >
        {/* Animated Morphing Language Capsule */}
        <div className="h-8 min-w-[32px] flex items-center bg-slate-900/95 border border-slate-800/90 hover:border-sky-500/40 rounded-xl px-0.5 shadow-lg transition-all duration-300 ease-out">
          <button
            type="button"
            onClick={() => setLangMenuOpen((prev) => !prev)}
            className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-300 ${
              langMenuOpen
                ? "bg-sky-500/20 text-sky-300"
                : "text-slate-400 hover:text-sky-400 hover:bg-slate-800"
            }`}
            title={lang === "ar" ? "تغيير اللغة" : "Switch Language"}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-300 ease-out ${
                langMenuOpen ? "rotate-180 scale-110 text-sky-400" : ""
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </button>

          {/* Expanding Animated Language Options */}
          <div
            className={`flex items-center overflow-hidden transition-all duration-300 ease-out ${
              langMenuOpen
                ? "max-w-[148px] opacity-100 pl-1 pr-1 gap-1"
                : "max-w-0 opacity-0 pl-0 gap-0 pointer-events-none"
            }`}
          >
            <button
              type="button"
              onClick={() => selectLanguage("ar")}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all duration-200 ${
                lang === "ar"
                  ? "bg-sky-500 text-slate-950 shadow-sm scale-100"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white scale-95"
              }`}
            >
              العربية
            </button>
            <button
              type="button"
              onClick={() => selectLanguage("en")}
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all duration-200 ${
                lang === "en"
                  ? "bg-sky-500 text-slate-950 shadow-sm scale-100"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white scale-95"
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* Settings & Guide Icon Button */}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="group w-8 h-8 rounded-xl bg-slate-900/95 hover:bg-slate-800 border border-slate-800/90 hover:border-sky-500/40 shadow-lg flex items-center justify-center text-slate-400 hover:text-sky-400 transition-all duration-300"
          title={t.settingsBtn}
        >
          <svg
            className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* SETTINGS, CREDITS, THEME SWITCHER & COMPREHENSIVE GUIDE MODAL */}
      {settingsOpen && (
        <div
          className={`masar-backdrop-animate fixed inset-x-0 bottom-0 top-10 z-40 flex items-center justify-center p-4 sm:p-6 ${
            uiTheme === "light"
              ? "bg-slate-300/45 backdrop-blur-md"
              : "bg-black/75 backdrop-blur-sm"
          }`}
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="masar-modal-animate relative bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <SectionAmbientBackground variant="mtr" />
            {/* Modal Header */}
            <div className="relative z-10 px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-3">
                <MasarLogo size={34} className="shrink-0 drop-shadow-sm" />
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-white">
                    {t.settingsTitle}
                  </h2>
                  <p className="text-xs text-slate-400">{t.settingsSub}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-slate-700 text-xs font-bold transition"
              >
                ✕ {t.closeBtn}
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="relative z-10 p-6 overflow-y-auto space-y-7">
              {/* 1. CREDITS & APP IDENTITY (@mhmdrfx + Crafted Phrase + App Logo) */}
              <section className="space-y-3">
                <h3 className="text-sm font-extrabold text-sky-400 uppercase tracking-wider">
                  {t.sec1Title}
                </h3>

                <div
                  className={`rounded-2xl border p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-lg bg-gradient-to-br ${
                    uiTheme === "light"
                      ? "from-sky-50 via-white to-emerald-50 border-sky-300"
                      : "from-sky-950/40 via-slate-950/90 to-emerald-950/30 border-sky-500/35"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-start">
                    <MasarLogo
                      size={82}
                      className={`shrink-0 ${
                        uiTheme === "light"
                          ? "drop-shadow-[0_10px_20px_rgba(14,165,233,0.16)]"
                          : "drop-shadow-[0_12px_24px_rgba(2,6,23,0.65)]"
                      }`}
                    />

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <span className="text-xl font-extrabold text-white">
                          {lang === "ar" ? "مسار Masar" : "Masar"}
                        </span>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/40">
                          {versionDisplay}
                        </span>
                      </div>

                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs font-bold">
                        <span>✦</span>
                        <span>{t.craftedPhrase}</span>
                        <span>✦</span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed max-w-md">
                        {t.identityDesc}
                      </p>
                    </div>
                  </div>

                  {/* Developer Rights Badge (@mhmdrfx) */}
                  <div className="bg-slate-950/90 border border-sky-500/40 rounded-2xl px-6 py-4 text-center space-y-2 shrink-0 shadow-xl">
                    <div className="text-[11px] text-slate-400 font-semibold">
                      {t.rightsText}
                    </div>
                    <div
                      dir="ltr"
                      style={{
                        fontFamily:
                          "'Segoe UI Variable Display', 'Trebuchet MS', 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
                        letterSpacing: "0.06em",
                      }}
                      className="inline-flex items-center justify-center gap-0.5 text-lg font-extrabold bg-sky-950/60 border border-sky-500/40 px-4 py-1.5 rounded-xl shadow-inner select-all"
                    >
                      <span className="text-sky-400 font-bold">@</span>
                      <span className="text-white tracking-wider">mhmdrfx</span>
                    </div>
                    <div className="text-[11px] text-emerald-400 font-bold">
                      {t.craftedPhrase} ♥
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. THEME SWITCHER (DARK MODE VS WHITE MODE WITH VISUAL PREVIEWS) */}
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-extrabold text-sky-400 uppercase tracking-wider">
                    {t.sec2Title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{t.sec2Desc}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => selectTheme("dark")}
                    className={`masar-lift-card text-start rounded-2xl p-4 border-2 transition-all flex flex-col justify-between gap-3 ${
                      uiTheme === "dark"
                        ? "border-sky-500 bg-sky-950/20 shadow-lg shadow-sky-500/10"
                        : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                    }`}
                  >
                    <div className="w-full space-y-1">
                      <div className="w-full flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ThemeRadioIndicator active={uiTheme === "dark"} />
                          <span className="text-sm font-bold text-white">
                            {t.darkThemeTitle}
                          </span>
                        </div>
                        {uiTheme === "dark" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500 text-slate-950">
                            ✓ {t.activeThemeBadge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 w-full">
                        {t.darkThemeDesc}
                      </p>
                    </div>

                    <ThemePreviewMiniUI mode="dark" />
                  </button>

                  <button
                    type="button"
                    onClick={() => selectTheme("light")}
                    className={`masar-lift-card text-start rounded-2xl p-4 border-2 transition-all flex flex-col justify-between gap-3 ${
                      uiTheme === "light"
                        ? "border-sky-500 bg-sky-950/20 shadow-lg shadow-sky-500/10"
                        : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                    }`}
                  >
                    <div className="w-full space-y-1">
                      <div className="w-full flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ThemeRadioIndicator active={uiTheme === "light"} />
                          <span className="text-sm font-bold text-white">
                            {t.lightThemeTitle}
                          </span>
                        </div>
                        {uiTheme === "light" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500 text-slate-950">
                            ✓ {t.activeThemeBadge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 w-full">
                        {t.lightThemeDesc}
                      </p>
                    </div>

                    <ThemePreviewMiniUI mode="light" />
                  </button>
                </div>
              </section>

              {/* 3. IN-APP UPDATES & WINGET CHANNEL */}
              <UpdateSettingsPanel lang={lang} />

              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-extrabold text-sky-400 uppercase tracking-wider">
                    {t.sec3Title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{t.sec3Desc}</p>
                </div>

                <div className="space-y-3">
                  {guideSections.map((sec, idx) => (
                    <div
                      key={idx}
                      className="masar-lift-card masar-well rounded-2xl bg-slate-950/80 border border-slate-800/90 p-4 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/30">
                          {sec.badge}
                        </span>
                        <h4 className="text-sm font-bold text-white">
                          {sec.title}
                        </h4>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {sec.summary}
                      </p>

                      <ul className="space-y-1.5 pt-1">
                        {sec.points.map((pt, pIdx) => (
                          <li
                            key={pIdx}
                            className="text-xs text-slate-400 leading-relaxed flex items-start gap-2"
                          >
                            <span className="text-sky-400 font-bold mt-0.5">
                              •
                            </span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* EXTRACTED DATA BREAKDOWN, REPORT STUDIO & 12-METRIC REFERENCE MODAL */}
      <ReportStudioModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        lang={lang}
        uiTheme={uiTheme}
        snapshot={snapshot}
        localizedHealth={localizedHealth}
        copyFeedback={copyFeedback}
        exportFeedback={exportFeedback}
        reportNotice={reportNotice}
        onCopySummary={handleCopySummary}
        onExportReport={handleExportReport}
        onStartTraceNow={() => startTrace(target)}
        SectionAmbientBackground={SectionAmbientBackground}
      />

      {/* FLOATING UPDATE NOTIFIER */}
      <UpdateNotifier lang={lang} />
    </div>
  );
}
