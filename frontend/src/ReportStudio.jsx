import React, { useState } from "react";

function formatArabicCount(n, singular, dual, pluralFew, pluralMany) {
  const count = Number(n) || 0;
  if (count === 0) return `0 ${singular}`;
  if (count === 1) return `${singular} (${count})`;
  if (count === 2) return `${dual} (${count})`;
  if (count >= 3 && count <= 10) return `${count} ${pluralFew}`;
  return `${count} ${pluralMany}`;
}

function formatEnglishCount(n, singular, plural) {
  const count = Number(n) || 0;
  return `${count} ${count === 1 ? singular : plural}`;
}

export function buildBrowserDetailedReport(snap, lang = "ar", localizedHealth = null, customVersion = "") {
  const isAr = lang === "ar";
  const hops = snap?.hops || [];
  const health = snap?.health || { score: 100, severity: "idle", status: "", detail: "" };
  const verdictTitle = localizedHealth?.status || health.status || "";
  const verdictDetail = localizedHealth?.detail || health.detail || "";
  const verStr = customVersion ? `v${customVersion}` : "v1.x";

  const hop1 = hops.find((h) => h.hop === 1) || null;
  const ispHop =
    hops.find((h) => (h.hop === 2 || h.hop === 3) && h.received > 0) ||
    hops.find((h) => h.hop === 2 || h.hop === 3) ||
    null;
  const destHop =
    hops.find((h) => h.reachedDest) || (hops.length > 0 ? hops[hops.length - 1] : null);
  const silentCount = hops.filter(
    (h) => !h.ip || (h.received === 0 && h.lossPercent === 0)
  ).length;

  const readiness = evaluateReadinessFront(destHop, isAr);
  const nowStr = new Date().toLocaleString(isAr ? "ar-SA" : "en-US");

  if (isAr) {
    const hopsText = formatArabicCount(
      hops.length,
      "قفزة واحدة",
      "قفزتان",
      "قفزات",
      "قفزة"
    );
    const lines = [
      "================================================================================================================",
      `                    مسار (الإصدار ${customVersion || "الرسمي"}) — التقرير التشخيصي الشامل ومفسر البيانات المستخرجة                        `,
      "================================================================================================================",
      "[أولاً] الملخص التنفيذي للفحص",
      `• الهدف المفحوص          : ${snap?.target || "—"} (${snap?.resolvedIp || "—"})`,
      `• وقت استخراج التقرير    : ${nowStr} (آخر تحديث: ${snap?.updatedAt || "—"})`,
      `• مؤشر جودة الاتصال      : ${health.score}%`,
      `• التشخيص الذكي التلقائي : ${verdictTitle}`,
      `• التفسير الفني المفصل   : ${verdictDetail}`,
      "----------------------------------------------------------------------------------------------------------------",
      "[ثانياً] تحليل مقاطع المسار وعزل مصدر الخلل",
      hop1 && hop1.received > 0
        ? `• الراوتر المحلي (القفزة 1) : ${hop1.ip} — المتوسط ${hop1.avgMs.toFixed(1)} ms | الفقد ${hop1.lossPercent.toFixed(1)}% | التذبذب ${hop1.jitterMs.toFixed(1)} ms`
        : "• الراوتر المحلي (القفزة 1) : صامت ICMP أو لم يستجب مباشرة (لا يؤثر طالما الوجهة سليمة)",
      ispHop && ispHop.received > 0
        ? `• بوابة المزود (القفزة ${ispHop.hop}) : ${ispHop.ip} — المتوسط ${ispHop.avgMs.toFixed(1)} ms | الفقد ${ispHop.lossPercent.toFixed(1)}% | التذبذب ${ispHop.jitterMs.toFixed(1)} ms`
        : "• بوابة المزود              : عبور مباشر نحو الشبكة الدولية",
      destHop && destHop.received > 0
        ? `• الوجهة النهائية (#${destHop.hop})      : ${destHop.ip} — المتوسط ${destHop.avgMs.toFixed(1)} ms (الأفضل ${destHop.bestMs.toFixed(1)} / الأسوأ ${destHop.worstMs.toFixed(1)} ms) | الفقد ${destHop.lossPercent.toFixed(1)}%`
        : "• الوجهة النهائية           : لا توجد ردود مستلمة بعد",
      `• إجمالي القفزات المكتشفة   : ${hopsText} (منها ${silentCount} عقد عبور صامتة تتجاهل ICMP بشكل طبيعي)`,
      "----------------------------------------------------------------------------------------------------------------",
      "[ثالثاً] كفاءة الاتصال للاستخدامات العملية",
      `• الألعاب التنافسية         : ${readiness.gaming.badge} — ${readiness.gaming.desc}`,
      `• المكالمات والاجتماعات     : ${readiness.calls.badge} — ${readiness.calls.desc}`,
      `• البث فائق الدقة 4K        : ${readiness.streaming.badge} — ${readiness.streaming.desc}`,
      "----------------------------------------------------------------------------------------------------------------",
      "[رابعاً] سجل قراءات القفزات التفصيلي",
    ];

    for (const h of hops) {
      const host = h.hostname ? `${h.ip} (${h.hostname})` : h.ip || "* * * (عقدة صامتة ICMP)";
      const ev = evaluateSingleHopFront(h, true);
      lines.push(
        `  - القفزة #${String(h.hop).padStart(2, "0")}: ${host} | الفقد: ${h.lossPercent.toFixed(1)}% (${h.sent}/${h.received}) | الحالي: ${h.lastMs.toFixed(1)} ms | المتوسط: ${h.avgMs.toFixed(1)} ms | التذبذب: ${h.jitterMs.toFixed(1)} ms | الحالة: ${ev.status}`
      );
    }

    lines.push(
      "----------------------------------------------------------------------------------------------------------------",
      "[خامساً] دليل شرح البيانات المستخرجة",
      "• نسبة الفقد %        : من 0% إلى 2% سليم تماماً | من 2% إلى 5% تحذير متوسط | أكثر من 5% خلل يسبب تقطيعاً واضحاً.",
      "• متوسط الاستجابة     : زمن الذهاب والعودة بالمللي ثانية؛ أقل من 35 مللي ثانية ممتاز، ومن 35 إلى 85 مللي ثانية جيد جداً دولياً.",
      "• تباين الاستجابة     : مدى استقرار زمن الاستجابة بين كل نبضة وأخرى؛ أقل من 10 مللي ثانية مثالي للألعاب والصوت.",
      "• العقد الصامتة ICMP  : راوتر عبور يتجاهل رسائل الفحص أمنياً؛ لا يمثل أي عطل طالما استجابت الوجهة النهائية دون فقد.",
      "================================================================================================================"
    );
    return lines.join("\n");
  }

  const hopsEn = formatEnglishCount(hops.length, "Hop", "Hops");
  const silentEn = formatEnglishCount(silentCount, "harmless ICMP-filtered transit hop", "harmless ICMP-filtered transit hops");

  const lines = [
    "================================================================================================================",
    `                 MASAR ${verStr} — EXECUTIVE NETWORK DIAGNOSTIC REPORT & EXTRACTED METRIC GUIDE                      `,
    "================================================================================================================",
    "[1] EXECUTIVE SUMMARY",
    `• Target Endpoint        : ${snap?.target || "—"} (${snap?.resolvedIp || "—"})`,
    `• Generated At           : ${nowStr} (Last Sample: ${snap?.updatedAt || "—"})`,
    `• Connection Health Score: ${health.score}% [${(health.severity || "idle").toUpperCase()}]`,
    `• Automated Verdict      : ${verdictTitle}`,
    `• Technical Detail       : ${verdictDetail}`,
    "----------------------------------------------------------------------------------------------------------------",
    "[2] SEGMENT ISOLATION ANALYSIS",
    hop1 && hop1.received > 0
      ? `• Local Gateway (Hop 1)  : ${hop1.ip} — Avg ${hop1.avgMs.toFixed(1)} ms | Loss ${hop1.lossPercent.toFixed(1)}% | Jitter ${hop1.jitterMs.toFixed(1)} ms`
      : "• Local Gateway (Hop 1)  : ICMP silent or awaiting reply",
    ispHop && ispHop.received > 0
      ? `• ISP Gateway (Hop ${ispHop.hop})    : ${ispHop.ip} — Avg ${ispHop.avgMs.toFixed(1)} ms | Loss ${ispHop.lossPercent.toFixed(1)}% | Jitter ${ispHop.jitterMs.toFixed(1)} ms`
      : "• ISP Gateway            : Direct transit routing",
    destHop && destHop.received > 0
      ? `• Final Target (Hop ${destHop.hop})   : ${destHop.ip} — Avg ${destHop.avgMs.toFixed(1)} ms (Best ${destHop.bestMs.toFixed(1)} / Worst ${destHop.worstMs.toFixed(1)} ms) | Loss ${destHop.lossPercent.toFixed(1)}%`
      : "• Final Target           : Awaiting probe responses",
    `• Total Discovered Hops  : ${hopsEn} (${silentEn})`,
    "----------------------------------------------------------------------------------------------------------------",
    "[3] APPLICATION READINESS",
    `• Competitive Gaming     : ${readiness.gaming.badge} — ${readiness.gaming.desc}`,
    `• VoIP & Video Calls     : ${readiness.calls.badge} — ${readiness.calls.desc}`,
    `• 4K Streaming & Cloud   : ${readiness.streaming.badge} — ${readiness.streaming.desc}`,
    "----------------------------------------------------------------------------------------------------------------",
    "[4] HOP-BY-HOP TELEMETRY TABLE",
    "Hop  | IP / Hostname                  | Loss %  | Sent/Recv  | Last    | Avg     | Jitter  | Verdict",
    "-----+--------------------------------+---------+------------+---------+---------+---------+----------------------------",
  ];

  for (const h of hops) {
    const host = h.hostname ? `${h.ip} (${h.hostname})` : h.ip || "* * * (ICMP Silent)";
    const ev = evaluateSingleHopFront(h, false);
    lines.push(
      `${String(h.hop).padEnd(4)} | ${host.slice(0, 30).padEnd(30)} | ${h.lossPercent
        .toFixed(1)
        .padStart(5)}%  | ${`${h.sent}/${h.received}`.padEnd(10)} | ${h.lastMs
        .toFixed(1)
        .padStart(5)}ms | ${h.avgMs.toFixed(1).padStart(5)}ms | ${h.jitterMs
        .toFixed(1)
        .padStart(5)}ms | ${ev.status}`
    );
  }

  lines.push(
    "----------------------------------------------------------------------------------------------------------------",
    "[5] EXTRACTED METRIC GUIDE",
    "• Loss %      : 0%–2% Healthy | 2%–5% Warning | >5% Critical packet drops causing stalls and lag.",
    "• Avg RTT (ms): Round-Trip Time in milliseconds (<35 ms Optimal, 35–85 ms Good international, >150 ms High).",
    "• Jitter (ms) : Mean packet-to-packet RTT variance (<10 ms ideal for gaming and real-time voice).",
    "• ICMP Silent : Transit router filtering ICMP Time-Exceeded replies; harmless when destination loss is 0%.",
    "================================================================================================================"
  );
  return lines.join("\n");
}

function evaluateSingleHopFront(h, isAr) {
  if (!h || !h.ip || (h.received === 0 && h.lossPercent === 0)) {
    return {
      tone: "slate",
      status: isAr ? "صامت ICMP — فلترة طبيعية" : "ICMP Silent — Harmless",
    };
  }
  if (h.lossPercent > 5.0) {
    return {
      tone: "red",
      status: isAr ? "فقد حزم مرتفع (أكثر من 5%)" : "Critical Loss (>5%)",
    };
  }
  if (h.lossPercent > 2.0 || h.jitterMs > 20.0) {
    return {
      tone: "amber",
      status: isAr ? "تذبذب متوسط يحتاج إلى مراقبة" : "Moderate Jitter / Loss",
    };
  }
  return {
    tone: "emerald",
    status: isAr ? "مستقر وسليم تماماً" : "Healthy & Stable",
  };
}

export function evaluateReadinessFront(destHop, isAr) {
  if (!destHop || destHop.received === 0) {
    return isAr
      ? {
          gaming: {
            tone: "slate",
            badge: "بانتظار القراءات",
            desc: "ابدأ فحص المسار لقياس كفاءة زمن الاستجابة وثباتها للألعاب التنافسية.",
          },
          calls: {
            tone: "slate",
            badge: "بانتظار القراءات",
            desc: "ابدأ فحص المسار لتقييم ثبات الصوت والفيديو اللحظي.",
          },
          streaming: {
            tone: "slate",
            badge: "بانتظار القراءات",
            desc: "ابدأ فحص المسار لتحليل استقرار نقل البيانات وجودة البث.",
          },
        }
      : {
          gaming: {
            tone: "slate",
            badge: "Awaiting Telemetry",
            desc: "Start a trace to evaluate RTT and jitter for online gaming.",
          },
          calls: {
            tone: "slate",
            badge: "Awaiting Telemetry",
            desc: "Start a trace to measure voice and video stability.",
          },
          streaming: {
            tone: "slate",
            badge: "Awaiting Telemetry",
            desc: "Start a trace to verify packet delivery stability.",
          },
        };
  }

  const loss = destHop.lossPercent || 0;
  const avg = destHop.avgMs || 0;
  const jit = destHop.jitterMs || 0;

  let gaming, calls, streaming;

  if (loss <= 0.5 && avg <= 45 && jit <= 6) {
    gaming = isAr
      ? {
          tone: "emerald",
          badge: "ممتاز (احترافي)",
          desc: `استجابة فورية (${avg.toFixed(1)} مللي ثانية) وتباين شبه معدوم (${jit.toFixed(1)} مللي ثانية) دون أي تقطيع.`,
        }
      : {
          tone: "emerald",
          badge: "Pro Grade",
          desc: `Ultra-responsive ${avg.toFixed(1)} ms RTT and ${jit.toFixed(1)} ms jitter with crisp hit registration.`,
        };
  } else if (loss <= 2.0 && avg <= 95 && jit <= 15) {
    gaming = isAr
      ? {
          tone: "sky",
          badge: "جيد ومستقر",
          desc: `مناسب للعب عبر الخوادم الإقليمية والدولية (${avg.toFixed(1)} مللي ثانية) باستقرار جيد.`,
        }
      : {
          tone: "sky",
          badge: "Playable & Stable",
          desc: `Solid international routing (${avg.toFixed(1)} ms RTT, ${loss.toFixed(1)}% loss).`,
        };
  } else {
    gaming = isAr
      ? {
          tone: "red",
          badge: "غير مستقر للألعاب",
          desc: `يوجد فقد (${loss.toFixed(1)}%) أو تذبذب (${jit.toFixed(1)} مللي ثانية) قد يسبب تأخراً أو ارتداداً أثناء اللعب.`,
        }
      : {
          tone: "red",
          badge: "Lag / Rubber-Banding Risk",
          desc: `Elevated loss (${loss.toFixed(1)}%) or jitter (${jit.toFixed(1)} ms) impacts real-time sync.`,
        };
  }

  if (loss <= 1.0 && avg <= 120 && jit <= 18) {
    calls = isAr
      ? {
          tone: "emerald",
          badge: "نقاء عالٍ جداً",
          desc: "ثبات ممتاز لمكالمات الصوت والاجتماعات المرئية المباشرة دون تقطيع صوتي.",
        }
      : {
          tone: "emerald",
          badge: "Crystal Clear",
          desc: "Ideal packet pacing for Zoom, Teams, Discord, and VoIP calls.",
        };
  } else if (loss <= 3.0 && jit <= 30) {
    calls = isAr
      ? {
          tone: "amber",
          badge: "مقبول مع تذبذب طفيف",
          desc: "يعمل بصورة عامة مع احتمالية ظهور تقطعات لحظية قصيرة عند ضغط الشبكة.",
        }
      : {
          tone: "amber",
          badge: "Moderate",
          desc: "Usable for calls, though brief audio jitter may occur under load.",
        };
  } else {
    calls = isAr
      ? {
          tone: "red",
          badge: "تقطيع صوتي محتمل",
          desc: "ارتفاع الفقد أو التذبذب يؤدي إلى تأخر أو تقطع ملحوظ في الصوت والصورة.",
        }
      : {
          tone: "red",
          badge: "Audio Drop Risk",
          desc: "High packet loss or jitter will degrade real-time audio and video streams.",
        };
  }

  if (loss <= 1.5) {
    streaming = isAr
      ? {
          tone: "emerald",
          badge: "مثالي للبث 4K",
          desc: "نقل حزم نقي ومستقر يدعم البث فائق الدقة والتخزين السحابي بسلاسة تامة.",
        }
      : {
          tone: "emerald",
          badge: "Optimal 4K Ready",
          desc: "Clean packet delivery ensures smooth buffering and rapid TCP throughput.",
        };
  } else if (loss <= 4.0) {
    streaming = isAr
      ? {
          tone: "amber",
          badge: "جيد مع إعادة إرسال",
          desc: "يعمل البث بصورة جيدة، لكن فقد الحزم يقلل من أقصى سرعة فعلية لتحميل الملفات الكبيرة.",
        }
      : {
          tone: "amber",
          badge: "Fair (TCP Retries)",
          desc: "Streaming works via buffering, but packet drops throttle peak download speed.",
        };
  } else {
    streaming = isAr
      ? {
          tone: "red",
          badge: "بطء وتوقف متكرر",
          desc: "فقد الحزم المرتفع يجبر التطبيقات على إعادة طلب البيانات ويخفض دقة العرض تلقائياً.",
        }
      : {
          tone: "red",
          badge: "Buffering Likely",
          desc: "Significant packet loss forces heavy TCP retransmissions and quality drops.",
        };
  }

  return { gaming, calls, streaming };
}

export function ExportToolbarCapsule({
  lang,
  hopsCount,
  copyFeedback,
  exportFeedback,
  onCopySummary,
  onExportReport,
  onOpenStudio,
}) {
  const isAr = lang === "ar";
  const hasData = hopsCount > 0;

  const labels = isAr
    ? {
        copy: "نسخ التقرير",
        copied: "تم النسخ",
        pdf: "تقرير PDF",
        saved: "تم الحفظ",
        guide: "شرح البيانات والتقارير",
        needTraceTip: "ابدأ فحص المسار أولاً لاستخراج وتصدير القراءات الحية",
        copyTip: "نسخ التقرير التشخيصي المفصل مع شرح المؤشرات إلى الحافظة",
        pdfTip: "تصدير التقرير الرسمي المنسق للطباعة والحفظ بصيغة PDF",
        jsonTip: "تصدير كافة البيانات المستخرجة والمنحنيات بصيغة JSON",
        csvTip: "تصدير جدول القراءات وشرح المصطلحات لبرنامج Excel بصيغة CSV",
        guideTip: "فتح نافذة التحليل التفصيلي وشرح جميع البيانات المستخرجة",
      }
    : {
        copy: "Copy Summary",
        copied: "Copied",
        pdf: "PDF Report",
        saved: "Saved",
        guide: "Data & Report Guide",
        needTraceTip: "Start a trace first to export live extracted telemetry",
        copyTip: "Copy full executive diagnostic summary & metric guide to clipboard",
        pdfTip: "Export official printable A4/Letter HTML/PDF diagnostic report",
        jsonTip: "Export structured telemetry, 60s history & field glossary as JSON",
        csvTip: "Export Excel-ready UTF-8 CSV table with hop interpretations",
        guideTip: "Open interactive breakdown & complete guide to all extracted data",
      };

  const exportItems = [
    {
      fmt: "html",
      label: labels.pdf,
      tip: hasData ? labels.pdfTip : labels.needTraceTip,
      accent: true,
      icon: (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="13" y2="17" />
        </svg>
      ),
    },
    {
      fmt: "json",
      label: "JSON",
      tip: hasData ? labels.jsonTip : labels.needTraceTip,
      mono: true,
      icon: (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1" />
          <path d="M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1" />
        </svg>
      ),
    },
    {
      fmt: "csv",
      label: "CSV",
      tip: hasData ? labels.csvTip : labels.needTraceTip,
      mono: true,
      icon: (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      ),
    },
  ];

  return (
    <div className="masar-well flex flex-wrap items-center bg-slate-950 border border-slate-700/80 rounded-xl p-1 gap-1 shadow-sm">
      {/* 1. Copy Summary Button */}
      <button
        type="button"
        onClick={onCopySummary}
        disabled={!hasData}
        title={hasData ? labels.copyTip : labels.needTraceTip}
        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 border ${
          !hasData
            ? "text-slate-400 opacity-60 border-transparent cursor-not-allowed"
            : copyFeedback
            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm"
            : "bg-slate-900/90 text-slate-200 border-slate-800/90 hover:bg-sky-500/15 hover:text-sky-300 hover:border-sky-500/35"
        }`}
      >
        {copyFeedback ? (
          <svg className="w-3.5 h-3.5 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 shrink-0 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
        <span>{copyFeedback ? labels.copied : labels.copy}</span>
      </button>

      <span className="h-4 w-px bg-slate-800 mx-0.5" />

      {/* 2. File Export Buttons: PDF Report, JSON, CSV */}
      {exportItems.map((item) => {
        const isSaved = exportFeedback === item.fmt.toUpperCase();
        return (
          <button
            key={item.fmt}
            type="button"
            disabled={!hasData}
            title={item.tip}
            onClick={() => onExportReport(item.fmt)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 border ${
              item.mono ? "font-mono" : ""
            } ${
              !hasData
                ? "text-slate-400 opacity-60 border-transparent cursor-not-allowed"
                : isSaved
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm"
                : item.accent
                ? "bg-sky-950/60 text-sky-300 border-sky-500/30 hover:bg-sky-500/20 hover:border-sky-500/50"
                : "bg-slate-900/80 text-slate-200 border-slate-800/80 hover:bg-slate-800 hover:text-sky-300 hover:border-sky-500/35"
            }`}
          >
            {isSaved ? (
              <svg className="w-3.5 h-3.5 shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              item.icon
            )}
            <span>{isSaved ? labels.saved : item.label}</span>
          </button>
        );
      })}

      <span className="h-4 w-px bg-slate-800 mx-0.5" />

      {/* 3. Always-Accessible Interactive Data & Report Guide Studio Button */}
      <button
        type="button"
        onClick={onOpenStudio}
        title={labels.guideTip}
        className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 shadow-sm"
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" strokeLinecap="round" />
          <path d="M12 8h.01" strokeLinecap="round" />
        </svg>
        <span>{labels.guide}</span>
        {hasData && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        )}
      </button>
    </div>
  );
}

export function ReportStudioModal({
  open,
  onClose,
  lang,
  uiTheme,
  snapshot,
  localizedHealth,
  copyFeedback,
  exportFeedback,
  reportNotice,
  onCopySummary,
  onExportReport,
  onStartTraceNow,
  SectionAmbientBackground,
}) {
  const [activeFilter, setActiveFilter] = useState("all");

  if (!open) return null;

  const isAr = lang === "ar";
  const hops = snapshot?.hops || [];
  const hasData = hops.length > 0;
  const health = snapshot?.health || { score: 100, severity: "idle" };

  const hop1 = hops.find((h) => h.hop === 1) || null;
  const transitHops = hops.filter((h) => h.hop > 1 && !h.reachedDest);
  const respondingTransit = transitHops.filter((h) => h.received > 0);
  const silentCount = hops.filter(
    (h) => !h.ip || (h.received === 0 && h.lossPercent === 0)
  ).length;
  const respondingCount = hops.length - silentCount;
  const ispHop = respondingTransit[0] || transitHops[0] || null;
  const destHop =
    hops.find((h) => h.reachedDest) || (hops.length > 0 ? hops[hops.length - 1] : null);

  const readiness = evaluateReadinessFront(destHop, isAr);
  const previewText = hasData
    ? buildBrowserDetailedReport(snapshot, lang, localizedHealth)
    : "";

  const toneBadgeClass = (tone) => {
    switch (tone) {
      case "emerald":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/35";
      case "sky":
        return "bg-sky-500/15 text-sky-300 border-sky-500/35";
      case "amber":
        return "bg-amber-500/15 text-amber-300 border-amber-500/35";
      case "red":
        return "bg-red-500/20 text-red-300 border-red-500/40";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const hopsCountAr = formatArabicCount(
    hops.length,
    "قفزة واحدة",
    "قفزتان",
    "قفزات",
    "قفزة"
  );
  const hopsCountEn = formatEnglishCount(hops.length, "Hop", "Hops");

  const metricCards = isAr
    ? [
        {
          num: "01",
          code: "Hop # / TTL",
          title: "رقم القفزة وترتيب المحطة",
          liveVal: hasData ? hopsCountAr : "من 1 إلى 30 قفزة",
          liveIsLtr: false,
          desc: "يرسل برنامج مسار نبضات فحص بتدرج زمن حياة يبدأ من 1 وحتى 30 ليكشف كل راوتر تعبره بياناتك بالترتيب. القفزة الأولى هي دائماً راوترك المنزلي أو المكتبي، والقفزتان الثانية والثالثة تمثلان مقسم وبوابة شركة الاتصالات، تليها عقد الربط الدولي حتى الوصول إلى الخادم الهدف.",
          good: "مسار مباشر ومختصر (من 5 إلى 14 قفزة)",
          warn: "مسار طويل نسبياً (من 15 إلى 22 قفزة)",
          crit: "توجيه غير مباشر (أكثر من 25 قفزة)",
        },
        {
          num: "02",
          code: "IP & Hostname",
          title: "عنوان الراوتر والاسم العكسي للمضيف",
          liveVal: destHop?.ip
            ? `${destHop.ip}${destHop.hostname ? ` (${destHop.hostname})` : ""}`
            : "8.8.8.8 (dns.google)",
          liveIsLtr: true,
          desc: "العنوان الرقمي الفريد لكل راوتر على المسار متبوعاً باسمه المسجل في سجلات الفحص العكسي للنطاقات. قراءة هذا الاسم تكشف للمختصين اسم المدينة، ونوع مقسم المزود، وهوية الخادم النهائي.",
          good: "عنوان رقمي واضح مع سجل عكسي معرف",
          warn: "عنوان رقمي بدون اسم عكسي مسجل",
          crit: "تغير متكرر وغير مستقر في عنوان العقدة",
        },
        {
          num: "03",
          code: "Geo-IP & ASN",
          title: "الموقع الجغرافي ورقم النظام المستقل",
          liveVal: destHop?.asn || destHop?.location || "AS15169 • Global",
          liveIsLtr: true,
          desc: "يستخرج البرنامج الدولة والمدينة التي يتواجد فيها الراوتر إلى جانب رقم النظام المستقل للشبكة المالكة له (مثل شبكات جوجل أو كلاودفلير أو مشغلي الاتصالات المحليين) لتتبع مسار خروج البيانات دولياً.",
          good: "ربط إقليمي مباشر بمسار جغرافي قصير",
          warn: "عبور عبر قارة بعيدة قبل الوصول للهدف",
          crit: "اختناق عند نقطة تبادل دولية مزدحمة",
        },
        {
          num: "04",
          code: "Loss %",
          title: "نسبة فقد الحزم المئوية",
          liveVal:
            destHop && destHop.sent > 0
              ? `${destHop.lossPercent.toFixed(1)}%`
              : "0.0%",
          liveIsLtr: true,
          desc: "أهم رقم لتشخيص التقطيع على الإطلاق؛ يحسب نسبة النبضات التي لم تعد من إجمالي المرسل. العبرة دائماً باستمرار الفقد حتى الوجهة النهائية؛ فإذا بدأ الفقد عند القفزة الأولى فالمشكلة من الشبكة المنزلية، وإذا بدأ من القفزة الثانية واستمر للنهاية فالمشكلة من خط المزود.",
          good: "من 0% إلى 2% مسار نقي ومثالي",
          warn: "من 2% إلى 5% فقد متوسط يسبب تذبذباً",
          crit: "أكثر من 5% خلل يسبب تقطيعاً واضحاً",
        },
        {
          num: "05",
          code: "Sent / Recv",
          title: "عدد الحزم المرسلة والمستلمة",
          liveVal:
            destHop && destHop.sent > 0
              ? `${destHop.sent} / ${destHop.received}`
              : "1 / 1",
          liveIsLtr: true,
          desc: "عداد النبضات التي أرسلها البرنامج (بمعدل نبضة كل ثانية لكل قفزة) مقابل الردود المستلمة فعلياً. عند تقديم بلاغ فني لشركة الاتصالات، يُنصح بترك الفحص يعمل لمدة 30 إلى 60 ثانية على الأقل لتكوين عينة إحصائية موثوقة.",
          good: "تطابق تام بين المرسل والمستلم",
          warn: "نقص طفيف متقطع في الردود المستلمة",
          crit: "اتساع مستمر في الفارق بين المرسل والمستلم",
        },
        {
          num: "06",
          code: "Last RTT (ms)",
          title: "زمن الاستجابة اللحظي الحالي",
          liveVal:
            destHop && destHop.received > 0
              ? `${destHop.lastMs.toFixed(1)} ms`
              : "— ms",
          liveIsLtr: true,
          desc: "زمن رحلة آخر حزمة خرجت من جهازك إلى القفزة وعادت إليك مقيساً بالمللي ثانية (جزء من ألف من الثانية). يعكس حالة الخط في هذه الثانية تحديداً ويكشف الارتفاعات المفاجئة فور حدوثها.",
          good: "أقل من 35 مللي ثانية محلياً وإقليمياً",
          warn: "من 35 إلى 110 مللي ثانية للربط الدولي",
          crit: "أعلى من 150 مللي ثانية تأخر ملحوظ",
        },
        {
          num: "07",
          code: "Avg RTT (ms)",
          title: "المتوسط الحسابي لزمن الاستجابة",
          liveVal:
            destHop && destHop.received > 0
              ? `${destHop.avgMs.toFixed(1)} ms`
              : "— ms",
          liveIsLtr: true,
          desc: "مجموع أزمنة جميع الردود المستلمة مقسوماً على عددها منذ بداية جلسة الفحص. يُعد الرقم الأكثر دقة للحكم على سرعة استجابة الخادم الحقيقية بعيداً عن أي قفزة عابرة لثانية واحدة.",
          good: "أقل من 45 مللي ثانية للألعاب التنافسية",
          warn: "من 45 إلى 100 مللي ثانية مستقر للتصفح",
          crit: "أعلى من 150 مللي ثانية مسار بعيد أو مزدحم",
        },
        {
          num: "08",
          code: "Best / Worst",
          title: "أفضل وأسوأ زمن استجابة مسجل",
          liveVal:
            destHop && destHop.received > 0
              ? `${destHop.bestMs.toFixed(1)} / ${destHop.worstMs.toFixed(1)} ms`
              : "— / — ms",
          liveIsLtr: true,
          desc: "يمثل «الأفضل» الحد الفيزيائي الأدنى لانتقال الإشارة في الألياف نحو الخادم، بينما يكشف «الأسوأ» أقصى اختناق حدث أثناء الفحص. اتساع الفارق الكبير بينهما يدل على ازدحام طوابير البيانات عند سحب سرعات عالية بالمنزل.",
          good: "فارق ضيق بين القراءتين (أقل من 15 مللي ثانية)",
          warn: "فارق متوسط (من 15 إلى 45 مللي ثانية)",
          crit: "قفزات حادة تتجاوز 80 مللي ثانية فوق الأفضل",
        },
        {
          num: "09",
          code: "Jitter (ms)",
          title: "تباين الاستجابة الزمني (التذبذب)",
          liveVal:
            destHop && destHop.received > 0
              ? `${destHop.jitterMs.toFixed(1)} ms`
              : "— ms",
          liveIsLtr: true,
          desc: "يقيس مقدار التفاوت وعدم الانتظام بين كل قراءة استجابة والقراءة التي تليها مباشرة. حتى لو كان متوسط الاستجابة منخفضاً، فإن ارتفاع هذا التباين يسبب ارتداد الحركة في الألعاب وتقطع الصوت في المكالمات.",
          good: "من 0 إلى 8 مللي ثانية ثبات فائق",
          warn: "من 8 إلى 20 مللي ثانية تذبذب متوسط",
          crit: "أعلى من 20 مللي ثانية عدم استقرار واضح",
        },
        {
          num: "10",
          code: "Trend (60s)",
          title: "المنحنى البياني الحي لآخر 60 ثانية",
          liveVal:
            destHop?.history?.length > 0
              ? formatArabicCount(
                  destHop.history.length,
                  "عينة زمنية واحدة",
                  "عينتان زمنيتان",
                  "عينات زمنية",
                  "عينة زمنية"
                )
              : "حتى 60 عينة حية",
          liveIsLtr: false,
          desc: "رسم موجي لحظي يوثق آخر 60 قراءة زمنية لكل قفزة على حدة، ويُدرج أيضاً كرسم متجه داخل التقرير الرسمي للطباعة. الخط الأفقي الهادئ يعني اتصالاً صخرياً، أما التموجات الحادة فتعني تداخل إشارة لاسلكية أو ضغط تحميل بالخلفية.",
          good: "خط انسيابي شبه أفقي باللون الأخضر",
          warn: "تموجات متوسطة باللون الأصفر",
          crit: "قمم حادة متكررة باللون الأحمر",
        },
        {
          num: "11",
          code: "ICMP Silent",
          title: "الراوترات الصامتة وتجاهل رسائل الفحص",
          liveVal: hasData
            ? formatArabicCount(
                silentCount,
                "عقدة صامتة واحدة",
                "عقدتان صامتتان",
                "عقد صامتة",
                "عقدة صامتة"
              )
            : "فلترة طبيعية غير مؤثرة",
          liveIsLtr: false,
          desc: "معلومة جوهرية في هندسة الشبكات: راوترات العبور الدولية تنقل ملايين الحزم في الثانية، لذلك تبرمجها شركات الاتصالات لتجاهل رسائل الفحص لحماية معالجاتها بينما تمرر بياناتك بسرعة كاملة؛ لذا لا تُحتسب كعطل طالما كانت الوجهة النهائية سليمة.",
          good: "عقدة صامتة بالمنتصف مع فقد 0% بالوجهة",
          warn: "صمت في القفزة الأولى بسبب جدار الحماية",
          crit: "انقطاع كامل في استجابة الوجهة النهائية",
        },
        {
          num: "12",
          code: "Health Score",
          title: "مؤشر الجودة الذكي وعزل مصدر المشكلة",
          liveVal: `${health.score}%`,
          liveIsLtr: true,
          desc: "يقارن محرك التحليل الذكي في مسار أداء القفزة الأولى (الراوتر المنزلي) مع بوابة المزود ومع الوجهة النهائية في اللحظة نفسها، ليمنحك درجة تقييم مئوية ويحدد بدقة مصدر الخلل دون الحاجة إلى خبرة شبكات متقدمة.",
          good: "من 85% إلى 100% اتصال صحي ومثالي",
          warn: "من 60% إلى 84% تذبذب أو ارتفاع استجابة",
          crit: "أقل من 60% خلل يتطلب المعالجة",
        },
      ]
    : [
        {
          num: "01",
          code: "Hop # / TTL",
          title: "Hop Sequence & Time-To-Live Step",
          liveVal: hasData ? `${hopsCountEn} Discovered` : "TTL 1 → 30",
          liveIsLtr: true,
          desc: "Masar dispatches ICMPv4 probes with incrementing Time-To-Live (TTL 1..30) to map every router along your path in exact order. Hop #1 is always your local LAN/Wi-Fi router, Hops #2–#3 are your ISP access/aggregation gateways, followed by IXP peering nodes up to the destination.",
          good: "Direct route (5–14 hops)",
          warn: "Extended path (15–22 hops)",
          crit: "Suboptimal / routing loop (>25 hops)",
        },
        {
          num: "02",
          code: "IP & Hostname",
          title: "Router IPv4 Address & Reverse DNS",
          liveVal: destHop?.ip
            ? `${destHop.ip}${destHop.hostname ? ` (${destHop.hostname})` : ""}`
            : "8.8.8.8 (dns.google)",
          liveIsLtr: true,
          desc: "Displays each hop's numeric IPv4 address alongside its asynchronously resolved PTR hostname. Carrier hostnames often encode city airport codes, router roles (bng, core, peer), and link speeds.",
          good: "Resolved IP + descriptive PTR record",
          warn: "Public IP without PTR record",
          crit: "Frequent route flapping between IPs",
        },
        {
          num: "03",
          code: "Geo-IP & ASN",
          title: "Geographic Location & Autonomous System",
          liveVal: destHop?.asn || destHop?.location || "AS15169 • Global",
          liveIsLtr: true,
          desc: "Identifies the physical country/city and Autonomous System Number (e.g., AS15169 Google, AS13335 Cloudflare, or regional telecom ASNs) operating each router so you can verify regional vs. intercontinental routing.",
          good: "Direct regional IXP peering",
          warn: "Detour through distant continent",
          crit: "Congested international transit link",
        },
        {
          num: "04",
          code: "Loss %",
          title: "Packet Loss Percentage",
          liveVal:
            destHop && destHop.sent > 0
              ? `${destHop.lossPercent.toFixed(1)}% at Target`
              : "0.0%",
          liveIsLtr: true,
          desc: "The primary indicator of connection drops: ((Sent - Recv) / Sent) × 100. True packet loss is confirmed when loss begins at a specific hop AND persists through the final destination. Loss starting at Hop 1 points to Wi-Fi/LAN; loss starting at Hop 2+ points to your ISP.",
          good: "0% – 2% Clean & Healthy",
          warn: "2% – 5% Moderate Degradation",
          crit: "> 5% Critical Packet Drops",
        },
        {
          num: "05",
          code: "Sent / Recv",
          title: "Transmitted vs. Received Probes",
          liveVal:
            destHop && destHop.sent > 0
              ? `${destHop.sent} Sent / ${destHop.received} Recv`
              : "1 Probe / sec",
          liveIsLtr: true,
          desc: "Counts total 1-second ICMP Echo probes sent to each hop vs. valid replies received. Running a trace for at least 30–60 samples provides statistically solid evidence when escalating tickets to your ISP.",
          good: "1:1 parity (e.g., 60 / 60)",
          warn: "Occasional missed echo replies",
          crit: "Sustained drop gap between Sent & Recv",
        },
        {
          num: "06",
          code: "Last RTT (ms)",
          title: "Latest Round-Trip Latency",
          liveVal:
            destHop && destHop.received > 0
              ? `${destHop.lastMs.toFixed(1)} ms`
              : "— ms",
          liveIsLtr: true,
          desc: "Exact Round-Trip Time in milliseconds for the most recent packet to reach that hop and return. Useful for spotting real-time spikes the instant network load changes.",
          good: "< 35 ms (Optimal local/regional)",
          warn: "35 – 110 ms (Normal international)",
          crit: "> 150 ms (High latency route)",
        },
        {
          num: "07",
          code: "Avg RTT (ms)",
          title: "Cumulative Average Latency",
          liveVal:
            destHop && destHop.received > 0
              ? `${destHop.avgMs.toFixed(1)} ms`
              : "— ms",
          liveIsLtr: true,
          desc: "Mean Round-Trip Time across all received probes during the active session. Smooths out single-second anomalies to represent true baseline route responsiveness.",
          good: "< 45 ms for Competitive Gaming",
          warn: "45 – 100 ms Solid General/VoIP",
          crit: "> 150 ms Long-Haul / Congested",
        },
        {
          num: "08",
          code: "Best / Worst",
          title: "Minimum Floor & Peak Latency Spike",
          liveVal:
            destHop && destHop.received > 0
              ? `${destHop.bestMs.toFixed(1)} / ${destHop.worstMs.toFixed(1)} ms`
              : "Min / Max ms",
          liveIsLtr: true,
          desc: "Best RTT reflects the physical fiber propagation floor, whereas Worst RTT captures the highest congestion spike. A narrow spread proves queue stability; a wide gap diagnoses Bufferbloat under heavy downloads or uploads.",
          good: "Tight spread (< 15 ms gap)",
          warn: "Moderate spikes (15 – 45 ms gap)",
          crit: "Severe bufferbloat (> 80 ms spikes)",
        },
        {
          num: "09",
          code: "Jitter (ms)",
          title: "Inter-Packet Latency Variance",
          liveVal:
            destHop && destHop.received > 0
              ? `${destHop.jitterMs.toFixed(1)} ms`
              : "— ms",
          liveIsLtr: true,
          desc: "Measures the average fluctuation between consecutive ping samples. Low jitter is just as critical as low ping—high jitter causes rubber-banding in games and choppy VoIP audio even when average latency looks fine.",
          good: "0 – 8 ms Rock-Solid Pacing",
          warn: "8 – 20 ms Mild Fluctuation",
          crit: "> 20 ms Unstable Real-Time Timing",
        },
        {
          num: "10",
          code: "Trend (60s)",
          title: "Live 60-Second Rolling Sparkline",
          liveVal:
            destHop?.history?.length > 0
              ? formatEnglishCount(destHop.history.length, "Live Sample", "Live Samples")
              : "60s Waveform",
          liveIsLtr: true,
          desc: "Plots the rolling 60-second RTT waveform per hop (also embedded as vector SVG charts inside exported PDF/HTML reports). Flat waveforms confirm clean links; sawtooth bursts reveal Wi-Fi contention or queue saturation.",
          good: "Flat emerald baseline",
          warn: "Amber periodic waves",
          crit: "Sharp recurring red spikes",
        },
        {
          num: "11",
          code: "ICMP Silent",
          title: "Control-Plane ICMP Rate-Limiting",
          liveVal: hasData
            ? formatEnglishCount(silentCount, "Silent Transit Hop", "Silent Transit Hops")
            : "Harmless Filter",
          liveIsLtr: true,
          desc: "Crucial diagnostic rule: Core backbone routers prioritize forwarding gigabits of user traffic in hardware ASICs and intentionally deprioritize or drop ICMP TTL-expired packets on their CPU. If an intermediate hop is silent (—) while your final destination shows 0% loss, there is zero fault.",
          good: "Silent transit + 0% target loss = 100% Healthy",
          warn: "Hop 1 silent (local firewall ICMP block)",
          crit: "Final destination itself timing out",
        },
        {
          num: "12",
          code: "Health Score",
          title: "Automated Correlation & Bottleneck Score",
          liveVal: `${health.score}%`,
          liveIsLtr: true,
          desc: "Masar's diagnostic engine simultaneously correlates Hop 1 (Home Wi-Fi/LAN), Hops 2–3 (ISP Gateway), and End-to-End Target metrics to isolate the true culprit and compute an executive 0–100% reliability score.",
          good: "85% – 100% Optimal Path",
          warn: "60% – 84% Degraded Latency/Jitter",
          crit: "< 60% Actionable Network Fault",
        },
      ];

  const exportFormatCards = isAr
    ? [
        {
          id: "copy",
          badge: "نسخ فوري للحافظة",
          title: "نسخ التقرير النصي الشامل",
          sub: "مخصص لتذاكر الدعم الفني والمحادثات الفورية",
          desc: "ينسخ بضغطة واحدة تقريراً نصياً منسقاً يتضمن: الملخص التنفيذي، تحليل المقاطع (الراوتر، المزود، الوجهة)، تقييم الألعاب والمكالمات، سجل القفزات، ودليل شرح المؤشرات.",
          actionLabel: copyFeedback ? "✓ تم النسخ إلى الحافظة" : "نسخ التقرير الآن",
          onClick: onCopySummary,
          activeFeedback: Boolean(copyFeedback),
        },
        {
          id: "html",
          badge: "تقرير رسمي للطباعة",
          title: "التقرير الرسمي المعتمد (PDF / HTML)",
          sub: "وثيقة رسمية بشعار مسار جاهزة للحفظ بصيغة PDF",
          desc: "ينشئ وثيقة احترافية عالية الدقة تتضمن 6 بطاقات مؤشرات رئيسية، تقييم جاهزية التطبيقات، جدول القفزات مع رسوم المنحنيات البيانية، و10 بطاقات مرجعية تشرح كافة القراءات.",
          actionLabel:
            exportFeedback === "HTML" ? "✓ تم حفظ التقرير" : "تصدير التقرير الرسمي (PDF)",
          onClick: () => onExportReport("html"),
          activeFeedback: exportFeedback === "HTML",
          primary: true,
        },
        {
          id: "json",
          badge: "بيانات مهيكلة",
          title: "ملف البيانات الكامل (JSON)",
          sub: "للمهندسين وأنظمة المراقبة والتحليل البرمجي",
          desc: "يحتوي على بيانات التقرير التعريفية، التشخيص التنفيذي، مصفوفة القفزات شاملة سجل آخر 60 ثانية والتفسير الآلي لكل قفزة، مع قاموس مرجعي مدمج لكافة الحقول.",
          actionLabel: exportFeedback === "JSON" ? "✓ تم حفظ ملف JSON" : "تصدير ملف JSON",
          onClick: () => onExportReport("json"),
          activeFeedback: exportFeedback === "JSON",
        },
        {
          id: "csv",
          badge: "متوافق مع Excel",
          title: "جدول البيانات التفصيلي (CSV)",
          sub: "يدعم اللغة العربية بالكامل في برنامج Microsoft Excel",
          desc: "مُرمّز بصيغة UTF-8 BOM ليفتح في برنامج Excel مباشرة بجدول مرتب يشمل ملخص الفحص، قراءات كل قفزة وتقييمها الفني، وجدول شرح المصطلحات في الأسفل.",
          actionLabel: exportFeedback === "CSV" ? "✓ تم حفظ جدول CSV" : "تصدير جدول CSV",
          onClick: () => onExportReport("csv"),
          activeFeedback: exportFeedback === "CSV",
        },
      ]
    : [
        {
          id: "copy",
          badge: "Clipboard Ready",
          title: "Copy Executive Text Summary",
          sub: "Designed for ISP support tickets, email & chat",
          desc: "Copies a structured plain-text diagnostic report including Executive Summary, Segment Isolation (Hop 1 / ISP / Target), Application Readiness, Hop Table, and Metric Guide.",
          actionLabel: copyFeedback ? "✓ Copied to Clipboard" : "Copy Summary Now",
          onClick: onCopySummary,
          activeFeedback: Boolean(copyFeedback),
        },
        {
          id: "html",
          badge: "Official Printable",
          title: "Official PDF / HTML Report",
          sub: "Branded A4/Letter report with Print-to-PDF button",
          desc: "Generates a self-contained executive document with Masar branding, 6 KPI cards, Gaming/VoIP/4K readiness ratings, inline 60s SVG sparklines, hop verdicts, and a 10-card metric glossary.",
          actionLabel:
            exportFeedback === "HTML" ? "✓ Report Saved" : "Export PDF / HTML Report",
          onClick: () => onExportReport("html"),
          activeFeedback: exportFeedback === "HTML",
          primary: true,
        },
        {
          id: "json",
          badge: "Machine Readable",
          title: "Structured JSON Telemetry",
          sub: "For network engineers, scripts & NOC pipelines",
          desc: "Exports report metadata, executive diagnostic object, annotated hop array with full 60-second RTT history arrays, and an embedded field reference dictionary.",
          actionLabel: exportFeedback === "JSON" ? "✓ JSON Saved" : "Export JSON File",
          onClick: () => onExportReport("json"),
          activeFeedback: exportFeedback === "JSON",
        },
        {
          id: "csv",
          badge: "Excel Ready",
          title: "Annotated CSV Spreadsheet",
          sub: "UTF-8 BOM encoded for Microsoft Excel & Sheets",
          desc: "Exports executive header rows, complete hop-by-hop columns with automated technical interpretations, plus a built-in metric reference guide at the bottom.",
          actionLabel: exportFeedback === "CSV" ? "✓ CSV Saved" : "Export CSV Table",
          onClick: () => onExportReport("csv"),
          activeFeedback: exportFeedback === "CSV",
        },
      ];

  const filterTabs = isAr
    ? [
        { id: "all", label: "الدليل الشامل الكامل" },
        { id: "live", label: "تحليل بياناتك الحالية" },
        { id: "exports", label: "صيغ التصدير الاحترافية" },
        { id: "dictionary", label: "شرح جميع المؤشرات (12)" },
        { id: "preview", label: "معاينة التقرير النصي" },
      ]
    : [
        { id: "all", label: "Complete Studio" },
        { id: "live", label: "Live Data Breakdown" },
        { id: "exports", label: "Export Formats" },
        { id: "dictionary", label: "All Extracted Metrics (12)" },
        { id: "preview", label: "Live Report Preview" },
      ];

  const showLive = activeFilter === "all" || activeFilter === "live";
  const showExports = activeFilter === "all" || activeFilter === "exports";
  const showDict = activeFilter === "all" || activeFilter === "dictionary";
  const showPreview = activeFilter === "all" || activeFilter === "preview";

  return (
    <div
      className={`masar-backdrop-animate fixed inset-x-0 bottom-0 top-10 z-40 flex items-center justify-center p-3 sm:p-6 ${
        uiTheme === "light"
          ? "bg-slate-300/45 backdrop-blur-md"
          : "bg-black/75 backdrop-blur-sm"
      }`}
      onClick={onClose}
    >
      <div
        dir={isAr ? "rtl" : "ltr"}
        lang={isAr ? "ar" : "en"}
        className="masar-modal-animate relative bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {SectionAmbientBackground && <SectionAmbientBackground variant="mtr" />}

        {/* Modal Top Header */}
        <div className="relative z-10 px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/85">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-500/35 flex items-center justify-center text-sky-400 shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M8 13h8M8 17h5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                {isAr
                  ? "مركز التقارير الاحترافية وشرح جميع البيانات المستخرجة"
                  : "Diagnostic Report Studio & Complete Extracted Data Guide"}
              </h2>
              <p className="text-xs text-slate-400">
                {isAr
                  ? "قراءة تفصيلية لنتائج فحصك الحالية، تصدير التقارير الرسمية، وشرح دقيق لكل رقم وعمود ومؤشر"
                  : "Live interpretation of your trace telemetry, executive report exports, and in-depth guide to every metric"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-slate-700 text-xs font-bold transition"
          >
            ✕ {isAr ? "إغلاق" : "Close"}
          </button>
        </div>

        {/* Sub-Navigation Filter Bar */}
        <div className="relative z-10 px-6 py-2.5 border-b border-slate-800/80 bg-slate-950/60 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {filterTabs.map((tab) => {
              const active = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition border ${
                    active
                      ? "bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border-transparent"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5">
            {hasData ? (
              isAr ? (
                <>
                  <span>الهدف النشط:</span>
                  <bdi dir="ltr" className="font-mono text-sky-400">
                    {snapshot.target}
                  </bdi>
                  <span>•</span>
                  <span>{hopsCountAr}</span>
                </>
              ) : (
                <>
                  <span>Active Target:</span>
                  <span className="font-mono text-sky-400">{snapshot.target}</span>
                  <span>•</span>
                  <span>{hopsCountEn}</span>
                </>
              )
            ) : isAr ? (
              "الوضع الحالي: جاهز للفحص"
            ) : (
              "Status: Standby"
            )}
          </span>
        </div>

        {/* Scrollable Studio Body */}
        <div className="relative z-10 p-6 overflow-y-auto space-y-8">
          {/* Confirmation Notice Inside Modal if User Just Exported/Copied */}
          {reportNotice && (
            <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/40 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-emerald-300 font-semibold">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0">
                  ✓
                </span>
                <span>{reportNotice}</span>
              </div>
            </div>
          )}

          {showLive && (
            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-sky-400">
                  {isAr
                    ? "أولاً: القراءة التفصيلية لبيانات اتصالك المستخرجة حالياً"
                    : "1. Live Breakdown of Your Currently Extracted Telemetry"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isAr
                    ? "تحليل تلقائي يترجم أرقام الفحص الحالية إلى خلاصة عملية واضحة لكل مرحلة من مراحل اتصالك:"
                    : "Automated segment-by-segment translation of your current ICMPv4 numbers into actionable diagnostics:"}
                </p>
              </div>

              {!hasData ? (
                <div className="masar-well rounded-2xl border border-slate-800 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1 text-center sm:text-start">
                    <div className="text-sm font-bold text-white">
                      {isAr
                        ? "لم يبدأ استخراج القراءات الحية بعد"
                        : "No Live Trace Telemetry Extracted Yet"}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                      {isAr
                        ? "اضغط على زر «بدء الفحص الآن» ليقوم مسار بإرسال نبضات الفحص واستخراج قراءات الراوتر المنزلي وبوابة شركة الاتصالات والوجهة النهائية وتفسيرها هنا مباشرة."
                        : "Click Start Live Trace Now so Masar can probe your local router, ISP gateway, and destination server and analyze your live numbers right here."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onStartTraceNow}
                    className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-extrabold transition shrink-0 shadow-sm"
                  >
                    ▶ {isAr ? "بدء الفحص الآن" : "Start Live Trace Now"}
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="masar-lift-card masar-well rounded-2xl border border-slate-800/90 p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-400">
                          <span dir="ltr" className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-sky-500/15 border border-sky-500/30">
                            01
                          </span>
                          <span>{isAr ? "الراوتر المحلي" : "Local Router"}</span>
                        </span>
                        <span
                          dir="ltr"
                          className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${toneBadgeClass(
                            evaluateSingleHopFront(hop1, isAr).tone
                          )}`}
                        >
                          {hop1 && hop1.received > 0
                            ? `${hop1.lossPercent.toFixed(1)}%`
                            : isAr
                            ? "صامت"
                            : "Silent"}
                        </span>
                      </div>
                      <div dir="ltr" className="text-sm font-extrabold font-mono text-white truncate text-start">
                        {hop1?.ip || "—"}
                      </div>
                      <div className="text-xs text-slate-300 font-medium">
                        {hop1 && hop1.received > 0 ? (
                          isAr ? (
                            <>
                              المتوسط{" "}
                              <bdi dir="ltr" className="font-mono">
                                {hop1.avgMs.toFixed(1)} ms
                              </bdi>{" "}
                              • التذبذب{" "}
                              <bdi dir="ltr" className="font-mono">
                                {hop1.jitterMs.toFixed(1)} ms
                              </bdi>
                            </>
                          ) : (
                            <span className="font-mono">
                              Avg {hop1.avgMs.toFixed(1)} ms • Jitter {hop1.jitterMs.toFixed(1)} ms
                            </span>
                          )
                        ) : isAr ? (
                          "تجاهل رسائل الفحص محلياً"
                        ) : (
                          "ICMP Filtered"
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {hop1 && hop1.received > 0
                          ? hop1.lossPercent > 2 || hop1.avgMs > 15
                            ? isAr
                              ? "يوجد تأخر أو فقد بين جهازك والراوتر؛ افحص إشارة الواي فاي أو كابل الشبكة."
                              : "Elevated local Wi-Fi/LAN latency or packet loss detected at your router."
                            : isAr
                            ? "اتصالك الداخلي بالراوتر المنزلي سريع ومستقر تماماً."
                            : "Your local Wi-Fi / Ethernet link to the router is clean and fast."
                          : isAr
                          ? "الراوتر لا يرد على الفحص المباشر لكنه يمرر البيانات طبيعياً."
                          : "Router blocks direct ping replies while forwarding traffic normally."}
                      </p>
                    </div>

                    {/* Card 2: ISP Gateway */}
                    <div className="masar-lift-card masar-well rounded-2xl border border-slate-800/90 p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-400">
                          <span dir="ltr" className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-sky-500/15 border border-sky-500/30">
                            02
                          </span>
                          <span>{isAr ? "بوابة المزود" : "ISP Gateway"}</span>
                        </span>
                        <span
                          dir="ltr"
                          className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${toneBadgeClass(
                            evaluateSingleHopFront(ispHop, isAr).tone
                          )}`}
                        >
                          {ispHop && ispHop.received > 0
                            ? `#${ispHop.hop} • ${ispHop.lossPercent.toFixed(1)}%`
                            : isAr
                            ? "عبور"
                            : "Transit"}
                        </span>
                      </div>
                      <div dir="ltr" className="text-sm font-extrabold font-mono text-white truncate text-start">
                        {ispHop?.ip || "—"}
                      </div>
                      <div className="text-xs text-slate-300 font-medium">
                        {ispHop && ispHop.received > 0 ? (
                          isAr ? (
                            <>
                              المتوسط{" "}
                              <bdi dir="ltr" className="font-mono">
                                {ispHop.avgMs.toFixed(1)} ms
                              </bdi>{" "}
                              • التذبذب{" "}
                              <bdi dir="ltr" className="font-mono">
                                {ispHop.jitterMs.toFixed(1)} ms
                              </bdi>
                            </>
                          ) : (
                            <span className="font-mono">
                              Avg {ispHop.avgMs.toFixed(1)} ms • Jitter {ispHop.jitterMs.toFixed(1)} ms
                            </span>
                          )
                        ) : (
                          "—"
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {ispHop && ispHop.received > 0
                          ? ispHop.lossPercent > 2
                            ? isAr
                              ? "تم رصد فقد حزم عند مقسم شركة الاتصالات؛ التقرير جاهز لإرساله للدعم الفني."
                              : "Packet loss observed at ISP aggregation gateway; export report for support."
                            : isAr
                            ? "بوابة مزود الخدمة تعمل بكفاءة واستقرار دون اختناق."
                            : "ISP access and aggregation gateway shows clean packet delivery."
                          : isAr
                          ? "عقد المزود تمرر الاتصال مباشرة نحو المسار الدولي."
                          : "ISP hops forward packets cleanly toward backbone peering."}
                      </p>
                    </div>

                    {/* Card 3: Target End-to-End */}
                    <div className="masar-lift-card masar-well rounded-2xl border border-slate-800/90 p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                          <span dir="ltr" className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 border border-emerald-500/30">
                            03
                          </span>
                          <span>{isAr ? "الوجهة النهائية" : "Final Target"}</span>
                        </span>
                        <span
                          dir="ltr"
                          className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${toneBadgeClass(
                            evaluateSingleHopFront(destHop, isAr).tone
                          )}`}
                        >
                          {destHop && destHop.received > 0
                            ? `${destHop.lossPercent.toFixed(1)}%`
                            : "—"}
                        </span>
                      </div>
                      <div dir="ltr" className="text-sm font-extrabold font-mono text-white truncate text-start">
                        {destHop?.ip || snapshot.target}
                      </div>
                      <div className="text-xs text-slate-300 font-medium">
                        {destHop && destHop.received > 0 ? (
                          isAr ? (
                            <>
                              المتوسط{" "}
                              <bdi dir="ltr" className="font-mono">
                                {destHop.avgMs.toFixed(1)} ms
                              </bdi>{" "}
                              (
                              <bdi dir="ltr" className="font-mono">
                                {destHop.bestMs.toFixed(1)}–{destHop.worstMs.toFixed(1)} ms
                              </bdi>
                              )
                            </>
                          ) : (
                            <span className="font-mono">
                              Avg {destHop.avgMs.toFixed(1)} ms ({destHop.bestMs.toFixed(1)}–{destHop.worstMs.toFixed(1)} ms)
                            </span>
                          )
                        ) : (
                          "—"
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {destHop && destHop.received > 0
                          ? isAr
                            ? `تم استلام ${destHop.received} من أصل ${destHop.sent} حزمة بتذبذب زمني قدره ${destHop.jitterMs.toFixed(1)} مللي ثانية.`
                            : `Received ${destHop.received} of ${destHop.sent} probes with ${destHop.jitterMs.toFixed(1)} ms jitter.`
                          : isAr
                          ? "بانتظار وصول ردود الوجهة النهائية."
                          : "Awaiting echo replies from final destination."}
                      </p>
                    </div>

                    {/* Card 4: Overall Route Structure */}
                    <div className="masar-lift-card masar-well rounded-2xl border border-slate-800/90 p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-400">
                          <span dir="ltr" className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-sky-500/15 border border-sky-500/30">
                            04
                          </span>
                          <span>{isAr ? "بنية المسار والجودة" : "Path & Health"}</span>
                        </span>
                        <span
                          dir="ltr"
                          className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/35"
                        >
                          {health.score}%
                        </span>
                      </div>
                      <div className="text-sm font-extrabold text-white">
                        {isAr ? hopsCountAr : `${hopsCountEn} Total`}
                      </div>
                      <div className="text-xs text-slate-300">
                        {isAr
                          ? `المستجيبة: ${respondingCount} • الصامتة: ${silentCount}`
                          : `${respondingCount} Responding • ${silentCount} ICMP Silent`}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {localizedHealth?.status || ""}
                      </p>
                    </div>
                  </div>

                  {/* 3 Real-World Application Suitability Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      {
                        title: isAr
                          ? "الألعاب الإلكترونية التنافسية"
                          : "Competitive Gaming",
                        data: readiness.gaming,
                      },
                      {
                        title: isAr
                          ? "المكالمات الصوتية والاجتماعات المرئية"
                          : "VoIP & Video Conferencing",
                        data: readiness.calls,
                      },
                      {
                        title: isAr
                          ? "البث فائق الدقة (4K) والسحابة"
                          : "4K Streaming & Cloud",
                        data: readiness.streaming,
                      },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className="masar-lift-card masar-well rounded-2xl border border-slate-800/90 p-4 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white">
                            {item.title}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${toneBadgeClass(
                              item.data.tone
                            )}`}
                          >
                            {item.data.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {item.data.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {showExports && (
            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-sky-400">
                  {isAr
                    ? "ثانياً: صيغ التصدير الاحترافية ومحتوى كل ملف"
                    : "2. Professional Export Formats & What Each Report Contains"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isAr
                    ? "جميع التقارير المُصدّرة تُكتب تلقائياً بلغة البرنامج الحالية وتتضمن شرحاً مدمجاً للبيانات المستخرجة:"
                    : "Every exported report automatically matches your selected UI language and embeds a complete metric reference guide:"}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {exportFormatCards.map((card) => (
                  <div
                    key={card.id}
                    className={`masar-lift-card masar-well rounded-2xl border p-4 flex flex-col justify-between gap-3 ${
                      card.primary
                        ? "border-sky-500/40 bg-sky-950/20"
                        : "border-slate-800/90"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-extrabold text-white">
                          {card.title}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30 shrink-0">
                          {card.badge}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-emerald-400">
                        {card.sub}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {card.desc}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={!hasData}
                      onClick={card.onClick}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition border flex items-center justify-center gap-2 ${
                        !hasData
                          ? "bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed opacity-65"
                          : card.activeFeedback
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : card.primary
                          ? "bg-sky-500 hover:bg-sky-400 text-slate-950 border-sky-400 shadow-sm"
                          : "bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-sky-300 border-slate-700"
                      }`}
                    >
                      <span>
                        {!hasData
                          ? isAr
                            ? "ابدأ الفحص أولاً لتفعيل التصدير"
                            : "Start a Trace First to Enable Export"
                          : card.actionLabel}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {showDict && (
            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-sky-400">
                  {isAr
                    ? "ثالثاً: الدليل التفصيلي الشامل لجميع البيانات والمؤشرات المستخرجة (12 مؤشراً)"
                    : "3. Complete Detailed Dictionary of All Extracted Metrics (12 Metrics)"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isAr
                    ? "مرجع متكامل يشرح معنى كل عمود ورقم يستخرجه مسار، وكيفية قراءته، والنطاقات الطبيعية والتحذيرية لكل مؤشر:"
                    : "In-depth explanation of every column and indicator extracted by Masar, alongside exact healthy, warning, and critical thresholds:"}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {metricCards.map((m) => (
                  <div
                    key={m.num}
                    className="masar-lift-card masar-well rounded-2xl border border-slate-800/90 p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            dir="ltr"
                            className="text-[11px] font-mono font-extrabold px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30"
                          >
                            {m.num}
                          </span>
                          <h4 className="text-sm font-bold text-white">
                            {m.title}
                          </h4>
                        </div>
                        <span
                          dir="ltr"
                          className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300"
                        >
                          {m.code}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-slate-400 font-semibold">
                          {isAr ? "القيمة المستخرجة:" : "Extracted Value:"}
                        </span>
                        <span
                          dir={m.liveIsLtr ? "ltr" : "rtl"}
                          className={`font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded ${
                            m.liveIsLtr ? "font-mono" : ""
                          }`}
                        >
                          {m.liveVal}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {m.desc}
                      </p>
                    </div>

                    {/* Threshold Reference Strip */}
                    <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10.5px]">
                      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-2 py-1 text-emerald-300 font-medium">
                        <span className="font-bold block">
                          {isAr ? "● الطبيعي السليم" : "● Healthy"}
                        </span>
                        <span>{m.good}</span>
                      </div>
                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 px-2 py-1 text-amber-300 font-medium">
                        <span className="font-bold block">
                          {isAr ? "● نطاق التحذير" : "● Warning"}
                        </span>
                        <span>{m.warn}</span>
                      </div>
                      <div className="rounded-lg bg-red-500/10 border border-red-500/25 px-2 py-1 text-red-300 font-medium">
                        <span className="font-bold block">
                          {isAr ? "● نطاق الخلل" : "● Critical"}
                        </span>
                        <span>{m.crit}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {showPreview && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-sky-400">
                    {isAr
                      ? "رابعاً: معاينة حية للتقرير النصي المستخرج"
                      : "4. Live Preview of Extracted Support Report"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isAr
                      ? "هذا نموذج حي لما يتم نسخه عند الضغط على «نسخ التقرير» لإرساله مباشرة إلى الدعم الفني:"
                      : "Exact live preview of the formatted diagnostic summary copied to your clipboard:"}
                  </p>
                </div>

                {hasData && (
                  <button
                    type="button"
                    onClick={onCopySummary}
                    className="px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/35 text-xs font-bold transition"
                  >
                    {copyFeedback
                      ? isAr
                        ? "✓ تم النسخ إلى الحافظة"
                        : "✓ Copied"
                      : isAr
                      ? "نسخ هذا التقرير الآن"
                      : "Copy This Report"}
                  </button>
                )}
              </div>

              {hasData ? (
                <pre
                  dir={isAr ? "rtl" : "ltr"}
                  className={`masar-well rounded-2xl border border-slate-800 p-4 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-72 select-text whitespace-pre-wrap ${
                    uiTheme === "light" ? "text-slate-800" : "text-slate-300"
                  }`}
                >
                  {previewText}
                </pre>
              ) : (
                <div className="masar-well rounded-2xl border border-slate-800 p-4 text-xs text-slate-400 text-center">
                  {isAr
                    ? "ستظهر المعاينة الكاملة للتقرير المستخرج هنا فور بدء فحص المسار."
                    : "The live formatted diagnostic report preview will appear here once a trace starts."}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
