package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"html"
	"strings"
	"time"

	"masar/internal/mtr"
)

type hopEvaluationInfo struct {
	roleLabel   string
	statusLabel string
	statusColor string
}

func formatArabicHopsCount(n int) string {
	switch {
	case n == 0:
		return "0 قفزة"
	case n == 1:
		return "قفزة واحدة (1)"
	case n == 2:
		return "قفزتان (2)"
	case n >= 3 && n <= 10:
		return fmt.Sprintf("%d قفزات", n)
	default:
		return fmt.Sprintf("%d قفزة", n)
	}
}

func formatEnglishHopsCount(n int) string {
	if n == 1 {
		return "1 Hop"
	}
	return fmt.Sprintf("%d Hops", n)
}

func evaluateHopForReport(h mtr.HopStat, isAr bool) hopEvaluationInfo {
	role := "Transit Node"
	if isAr {
		role = "عقدة عبور دولية"
	}
	if h.Hop == 1 {
		if isAr {
			role = "الراوتر المحلي"
		} else {
			role = "Local Router (Hop 1)"
		}
	} else if h.ReachedDest {
		if isAr {
			role = "الوجهة النهائية"
		} else {
			role = "Target Destination"
		}
	} else if h.Hop == 2 || h.Hop == 3 {
		if isAr {
			role = "بوابة مزود الخدمة"
		} else {
			role = "ISP Gateway"
		}
	}

	if h.IP == "" || (h.Received == 0 && h.LossPercent == 0) {
		if isAr {
			return hopEvaluationInfo{
				roleLabel:   role,
				statusLabel: "صامت ICMP — فلترة طبيعية لا تؤثر",
				statusColor: "#64748b",
			}
		}
		return hopEvaluationInfo{
			roleLabel:   role,
			statusLabel: "ICMP Silent — Filtered / Non-Impactful",
			statusColor: "#64748b",
		}
	}

	if h.LossPercent > 5.0 {
		if isAr {
			return hopEvaluationInfo{
				roleLabel:   role,
				statusLabel: "فقد حزم مرتفع (أكثر من 5%)",
				statusColor: "#dc2626",
			}
		}
		return hopEvaluationInfo{
			roleLabel:   role,
			statusLabel: "Critical Packet Loss (>5%)",
			statusColor: "#dc2626",
		}
	}

	if h.LossPercent > 2.0 || h.JitterMs > 20.0 {
		if isAr {
			return hopEvaluationInfo{
				roleLabel:   role,
				statusLabel: "تذبذب متوسط يحتاج إلى مراقبة",
				statusColor: "#d97706",
			}
		}
		return hopEvaluationInfo{
			roleLabel:   role,
			statusLabel: "Moderate Degradation / Jitter",
			statusColor: "#d97706",
		}
	}

	if isAr {
		return hopEvaluationInfo{
			roleLabel:   role,
			statusLabel: "مستقر وسليم تماماً",
			statusColor: "#059669",
		}
	}
	return hopEvaluationInfo{
		roleLabel:   role,
		statusLabel: "Healthy & Stable",
		statusColor: "#059669",
	}
}

func localizeVerdictForReport(snap mtr.TraceSnapshot, isAr bool) (string, string, string) {
	if !isAr {
		sev := strings.ToUpper(snap.Health.Severity)
		if sev == "" {
			sev = "STANDBY"
		}
		return sev, snap.Health.Status, snap.Health.Detail
	}

	st := snap.Health.Status
	var culprit *mtr.HopStat
	for i := range snap.Hops {
		if snap.Hops[i].Hop == snap.Health.CulpritHop {
			culprit = &snap.Hops[i]
			break
		}
	}
	var finalHop *mtr.HopStat
	if len(snap.Hops) > 0 {
		finalHop = &snap.Hops[len(snap.Hops)-1]
	}

	sevAr := "سليم ومستقر"
	switch snap.Health.Severity {
	case "warning":
		sevAr = "تذبذب متوسط"
	case "critical":
		sevAr = "خلل حرج يتطلب المعالجة"
	case "idle":
		sevAr = "جاهز للفحص"
	}

	if strings.Contains(st, "Local Network") {
		detail := "تم رصد فقد في الحزم أو ارتفاع في زمن الاستجابة عند الراوتر المحلي."
		if culprit != nil {
			ip := culprit.IP
			if ip == "" {
				ip = "الراوتر المحلي"
			}
			detail = fmt.Sprintf("القفزة الأولى (%s) الخاصة بالراوتر المحلي تسجل فقد حزم بنسبة %.1f%% ومتوسط زمن استجابة %.1f مللي ثانية. ننصح بفحص كابل الشبكة أو الاقتراب من جهاز الواي فاي أو إعادة تشغيل الراوتر.", ip, culprit.LossPercent, culprit.AvgMs)
		}
		return sevAr, "تم رصد خلل في الشبكة المحلية أو الراوتر المنزلي (القفزة 1)", detail
	}
	if strings.Contains(st, "ISP / Backbone") {
		detail := "شبكتك المحلية سليمة، لكن تم رصد فقد في الحزم أو تأخر عند بوابة مزود الخدمة."
		if culprit != nil {
			detail = fmt.Sprintf("شبكتك المحلية (القفزة 1) سليمة تماماً، لكن الخلل يبدأ عند بوابة مزود الخدمة في القفزة رقم %d (%s) بنسبة فقد %.1f%% ومتوسط زمن استجابة %.1f مللي ثانية. يمكنك مشاركة هذا التقرير الرسمي مع الدعم الفني لشركة الاتصالات.", culprit.Hop, culprit.IP, culprit.LossPercent, culprit.AvgMs)
		}
		return sevAr, "تم رصد مشكلة من جهة مزود خدمة الإنترنت", detail
	}
	if strings.Contains(st, "Downstream Transit") {
		detail := "الشبكة المحلية وبوابة مزود الخدمة مستقرتان، لكن يوجد تذبذب في مسار العبور الدولي."
		if culprit != nil {
			detail = fmt.Sprintf("الراوتر المحلي وبوابة مزود الخدمة يعملان بكفاءة، لكن القفزة الدولية رقم %d (%s) تسجل فقد حزم بنسبة %.1f%% ومتوسط استجابة %.1f مللي ثانية.", culprit.Hop, culprit.IP, culprit.LossPercent, culprit.AvgMs)
		}
		return sevAr, "تذبذب في مسار الربط الدولي أو الخادم الوجهة", detail
	}
	if strings.Contains(st, "Connection is Healthy") {
		detail := "لا يوجد فقد مؤثر في الحزم عبر الراوتر المحلي أو بوابة مزود الخدمة."
		if finalHop != nil && finalHop.Received > 0 {
			detail = fmt.Sprintf("متوسط زمن الاستجابة النهائي إلى الوجهة (%s) هو %.1f مللي ثانية مع تذبذب منخفض قدره %.1f مللي ثانية ونسبة فقد %.1f%% فقط.", finalHop.IP, finalHop.AvgMs, finalHop.JitterMs, finalHop.LossPercent)
		}
		return sevAr, "الاتصال سليم — أداء المسار مثالي ومستقر", detail
	}

	return sevAr, "جاهز لتشخيص مسار الشبكة", "اختر هدفاً سريعاً أو أدخل عنوان الهدف واضغط على بدء الفحص."
}

func evaluateServiceReadiness(finalHop *mtr.HopStat, isAr bool) (gaming, calls, streaming string) {
	if finalHop == nil || finalHop.Received == 0 {
		if isAr {
			return "بانتظار استجابة الوجهة", "بانتظار استجابة الوجهة", "بانتظار استجابة الوجهة"
		}
		return "Awaiting target response", "Awaiting target response", "Awaiting target response"
	}

	loss := finalHop.LossPercent
	rtt := finalHop.AvgMs
	jit := finalHop.JitterMs

	if isAr {
		if loss <= 0.5 && rtt <= 65 && jit <= 8 {
			gaming = "ممتاز — استجابة فورية وثبات عالٍ دون تقطيع"
		} else if loss <= 2.0 && rtt <= 110 && jit <= 18 {
			gaming = "جيد ومستقر — مناسب للعب عبر الخوادم الإقليمية والدولية"
		} else {
			gaming = "غير مستقر للألعاب التنافسية بسبب الفقد أو ارتفاع زمن الاستجابة"
		}

		if loss <= 1.0 && rtt <= 130 && jit <= 15 {
			calls = "ممتاز — صوت وفيديو فائقا الوضوح دون تقطع"
		} else if loss <= 3.0 && rtt <= 200 {
			calls = "متوسط — قد يحدث تقطع لحظي طفيف عند ضغط الشبكة"
		} else {
			calls = "ضعيف — تأخر وتقطع ملحوظ في المكالمات المباشرة"
		}

		if loss <= 2.0 {
			streaming = "ممتاز — مثالي للبث فائق الدقة 4K والتصفح السريع"
		} else if loss <= 5.0 {
			streaming = "متوسط — يعمل مع احتمالية تخزين مؤقت عند التحميل العالي"
		} else {
			streaming = "ضعيف — فقد الحزم المتكرر يبطئ سرعة التحميل وجودة البث"
		}
		return gaming, calls, streaming
	}

	if loss <= 0.5 && rtt <= 65 && jit <= 8 {
		gaming = "Excellent — Low RTT & Zero Rubber-Banding"
	} else if loss <= 2.0 && rtt <= 110 && jit <= 18 {
		gaming = "Good & Playable — Solid Regional/International Stability"
	} else {
		gaming = "Degraded for Competitive Gaming — Loss or High RTT"
	}

	if loss <= 1.0 && rtt <= 130 && jit <= 15 {
		calls = "Excellent — Crystal-Clear VoIP & Video Conferencing"
	} else if loss <= 3.0 && rtt <= 200 {
		calls = "Fair — Occasional Minor Audio Jitter Under Load"
	} else {
		calls = "Poor — Noticeable Voice Delay or Packet Drop"
	}

	if loss <= 2.0 {
		streaming = "Excellent — Optimal for 4K Streaming & Cloud Transfers"
	} else if loss <= 5.0 {
		streaming = "Fair — Usable with Occasional TCP Retransmissions"
	} else {
		streaming = "Poor — High Packet Loss Throttles Peak Throughput"
	}
	return gaming, calls, streaming
}

func renderInlineSparklineSVG(history []float64, lossPct float64) string {
	if len(history) == 0 {
		return "—"
	}
	samples := history
	if len(samples) > 25 {
		samples = samples[len(samples)-25:]
	}
	minV, maxV := samples[0], samples[0]
	for _, v := range samples {
		if v < minV {
			minV = v
		}
		if v > maxV {
			maxV = v
		}
	}
	if maxV < minV+2 {
		maxV = minV + 2
	}
	rng := maxV - minV
	if rng < 1 {
		rng = 1
	}

	w, h := 88.0, 22.0
	pts := make([]string, len(samples))
	for i, v := range samples {
		x := w / 2
		if len(samples) > 1 {
			x = (float64(i)/(float64(len(samples)-1)))*(w-6) + 3
		}
		y := h - 3 - ((v-minV)/rng)*(h-6)
		pts[i] = fmt.Sprintf("%.1f,%.1f", x, y)
	}

	stroke := "#059669"
	if lossPct > 5.0 {
		stroke = "#dc2626"
	} else if lossPct > 2.0 {
		stroke = "#d97706"
	}

	return fmt.Sprintf(
		`<svg width="88" height="22" viewBox="0 0 88 22" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="%s" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" points="%s"/></svg>`,
		stroke,
		strings.Join(pts, " "),
	)
}

// BuildDetailedSupportReport formats a plain-text diagnostic report for the given trace snapshot and language.
func BuildDetailedSupportReport(snap mtr.TraceSnapshot, lang string) string {
	isAr := strings.HasPrefix(strings.ToLower(strings.TrimSpace(lang)), "ar")
	sevLabel, statusTitle, detailText := localizeVerdictForReport(snap, isAr)

	var hop1, ispHop, destHop *mtr.HopStat
	silentCount := 0
	for i := range snap.Hops {
		h := &snap.Hops[i]
		if h.Hop == 1 {
			hop1 = h
		} else if (h.Hop == 2 || h.Hop == 3) && ispHop == nil && h.Received > 0 {
			ispHop = h
		}
		if h.IP == "" || (h.Received == 0 && h.LossPercent == 0) {
			silentCount++
		}
		if h.ReachedDest {
			destHop = h
		}
	}
	if destHop == nil && len(snap.Hops) > 0 {
		destHop = &snap.Hops[len(snap.Hops)-1]
	}

	gaming, calls, streaming := evaluateServiceReadiness(destHop, isAr)
	nowStr := time.Now().Format("2006-01-02 15:04:05 MST")

	appVer := currentAppVersion
	if appVer == "" {
		appVer = "1.0"
	}
	verTag := "v" + appVer

	var b strings.Builder
	if isAr {
		b.WriteString("==============================================================================================================\n")
		b.WriteString(fmt.Sprintf("                     مسار (Masar %s) — التقرير التشخيصي الرسمي لتحليل مسار الشبكة                           \n", verTag))
		b.WriteString("==============================================================================================================\n")
		b.WriteString(fmt.Sprintf("• الهدف المفحوص               : %s (عنوان IP المحلل: %s)\n", snap.Target, snap.ResolvedIP))
		b.WriteString(fmt.Sprintf("• تاريخ ووقت التقرير          : %s (آخر تحديث: %s)\n", nowStr, snap.UpdatedAt))
		b.WriteString(fmt.Sprintf("• مؤشر جودة الاتصال الكلي     : %d%% [%s]\n", snap.Health.Score, sevLabel))
		b.WriteString(fmt.Sprintf("• الخلاصة التشخيصية التلقائية : %s\n", statusTitle))
		b.WriteString(fmt.Sprintf("• التفصيل الفني والتوصية      : %s\n", detailText))
		b.WriteString("--------------------------------------------------------------------------------------------------------------\n")
		b.WriteString("[أولاً] تحليل مقاطع المسار وجودة الاستخدام الفعلي:\n")
		if hop1 != nil && hop1.Received > 0 {
			b.WriteString(fmt.Sprintf("  • الراوتر المحلي (القفزة 1) : %s | متوسط الاستجابة: %.1f ms | الفقد: %.1f%% | التذبذب: %.1f ms\n", hop1.IP, hop1.AvgMs, hop1.LossPercent, hop1.JitterMs))
		} else {
			b.WriteString("  • الراوتر المحلي (القفزة 1) : صامت ICMP أو بانتظار الاستجابة\n")
		}
		if ispHop != nil {
			b.WriteString(fmt.Sprintf("  • بوابة مزود الخدمة         : القفزة رقم %d (%s) | متوسط الاستجابة: %.1f ms | الفقد: %.1f%%\n", ispHop.Hop, ispHop.IP, ispHop.AvgMs, ispHop.LossPercent))
		}
		if destHop != nil && destHop.Received > 0 {
			b.WriteString(fmt.Sprintf("  • الوجهة النهائية           : القفزة رقم %d (%s) | المتوسط: %.1f ms (الأفضل: %.1f / الأسوأ: %.1f ms) | الفقد: %.1f%%\n", destHop.Hop, destHop.IP, destHop.AvgMs, destHop.BestMs, destHop.WorstMs, destHop.LossPercent))
		}
		b.WriteString(fmt.Sprintf("  • إجمالي القفزات المكتشفة   : %s (منها %d عقد عبور صامتة تتجاهل ICMP بشكل طبيعي)\n", formatArabicHopsCount(len(snap.Hops)), silentCount))
		b.WriteString(fmt.Sprintf("  • كفاءة الألعاب التنافسية   : %s\n", gaming))
		b.WriteString(fmt.Sprintf("  • كفاءة المكالمات المرئية   : %s\n", calls))
		b.WriteString(fmt.Sprintf("  • كفاءة البث فائق الدقة 4K  : %s\n", streaming))
		b.WriteString("--------------------------------------------------------------------------------------------------------------\n")
		b.WriteString("[ثانياً] جدول القراءات التفصيلية لكل قفزة على المسار:\n")
		for _, h := range snap.Hops {
			ev := evaluateHopForReport(h, true)
			host := h.IP
			if host == "" {
				host = "* * * (عقدة صامتة ICMP)"
			} else if h.Hostname != "" {
				host = fmt.Sprintf("%s (%s)", h.IP, h.Hostname)
			}
			b.WriteString(fmt.Sprintf(
				"  - القفزة #%02d [%s]: %s | الفقد: %.1f%% (%d/%d) | الحالي: %.1f ms | المتوسط: %.1f ms | الأفضل/الأسوأ: %.1f/%.1f ms | التذبذب: %.1f ms | الحالة: %s\n",
				h.Hop, ev.roleLabel, host, h.LossPercent, h.Sent, h.Received, h.LastMs, h.AvgMs, h.BestMs, h.WorstMs, h.JitterMs, ev.statusLabel,
			))
		}
		b.WriteString("--------------------------------------------------------------------------------------------------------------\n")
		b.WriteString("[ثالثاً] الدليل المرجعي لشرح جميع البيانات المستخرجة في هذا التقرير:\n")
		b.WriteString("  • رقم القفزة          : ترتيب كل راوتر في رحلة البيانات بدءاً من الراوتر المنزلي (القفزة 1) وحتى الخادم النهائي.\n")
		b.WriteString("  • عنوان IP والمضيف    : العنوان الرقمي للراوتر واسمه العكسي المسجل في سجلات PTR لتحديد المدينة أو المزود.\n")
		b.WriteString("  • الموقع والمزود ASN  : الدولة والمدينة ورقم النظام المستقل لشركة الاتصالات أو الشبكة السحابية المالكة للعقدة.\n")
		b.WriteString("  • نسبة الفقد %        : نسبة الحزم المفقودة (من 0% إلى 2% مسار سليم، ومن 2% إلى 5% تحذير، وأكثر من 5% خلل يسبب تقطيعاً).\n")
		b.WriteString("  • المرسل والمستلم     : إجمالي نبضات الفحص المرسلة مقابل الردود المستلمة لتوثيق الدقة الإحصائية للتقرير.\n")
		b.WriteString("  • الاستجابة الحالية/المتوسطة : زمن الذهاب والعودة بالمللي ثانية؛ كلما انخفض الرقم كانت الاستجابة أسرع.\n")
		b.WriteString("  • الأفضل والأسوأ      : أدنى وأعلى زمن استجابة مسجل؛ اتساع الفارق بينهما يكشف وجود ازدحام لحظي على المسار.\n")
		b.WriteString("  • التذبذب الزمني      : مقدار التفاوت بين قراءات الاستجابة المتتالية؛ بقاؤه أقل من 10 مللي ثانية ضروري لاستقرار الألعاب والصوت.\n")
		b.WriteString("  • العقد الصامتة ICMP  : راوترات عبور تتجاهل رسائل الفحص أمنياً؛ لا تمثل أي عطل طالما استجابت الوجهة النهائية دون فقد.\n")
		b.WriteString("==============================================================================================================\n")
		b.WriteString(fmt.Sprintf("تم التوليد بواسطة برنامج مسار (Masar %s) — تطوير @mhmdrfx | صُنع بكل إتقان\n", verTag))
		return b.String()
	}

	b.WriteString("==============================================================================================================\n")
	b.WriteString(fmt.Sprintf("                 MASAR %s — OFFICIAL NETWORK DIAGNOSTIC & EXTRACTED TELEMETRY REPORT                        \n", verTag))
	b.WriteString("==============================================================================================================\n")
	b.WriteString(fmt.Sprintf("• Target Host         : %s (Resolved IP: %s)\n", snap.Target, snap.ResolvedIP))
	b.WriteString(fmt.Sprintf("• Report Timestamp    : %s (Last Sample: %s)\n", nowStr, snap.UpdatedAt))
	b.WriteString(fmt.Sprintf("• Overall Health Score: %d%% [%s]\n", snap.Health.Score, sevLabel))
	b.WriteString(fmt.Sprintf("• Automated Verdict   : %s\n", statusTitle))
	b.WriteString(fmt.Sprintf("• Diagnostic Analysis : %s\n", detailText))
	b.WriteString("--------------------------------------------------------------------------------------------------------------\n")
	b.WriteString("[1] SEGMENT BREAKDOWN & APPLICATION SUITABILITY:\n")
	if hop1 != nil && hop1.Received > 0 {
		b.WriteString(fmt.Sprintf("  • Local Gateway (Hop 1) : %s | Avg RTT: %.1f ms | Loss: %.1f%% | Jitter: %.1f ms\n", hop1.IP, hop1.AvgMs, hop1.LossPercent, hop1.JitterMs))
	} else {
		b.WriteString("  • Local Gateway (Hop 1) : ICMP Silent / No Echo Reply\n")
	}
	if ispHop != nil {
		b.WriteString(fmt.Sprintf("  • ISP Backbone Gateway  : Hop #%d (%s) | Avg RTT: %.1f ms | Loss: %.1f%%\n", ispHop.Hop, ispHop.IP, ispHop.AvgMs, ispHop.LossPercent))
	}
	if destHop != nil && destHop.Received > 0 {
		b.WriteString(fmt.Sprintf("  • Final Destination     : Hop #%d (%s) | Avg: %.1f ms (Best: %.1f / Worst: %.1f ms) | Loss: %.1f%%\n", destHop.Hop, destHop.IP, destHop.AvgMs, destHop.BestMs, destHop.WorstMs, destHop.LossPercent))
	}
	b.WriteString(fmt.Sprintf("  • Route Summary         : %s Total (%d ICMP-filtered intermediate routers)\n", formatEnglishHopsCount(len(snap.Hops)), silentCount))
	b.WriteString(fmt.Sprintf("  • Competitive Gaming    : %s\n", gaming))
	b.WriteString(fmt.Sprintf("  • VoIP & Video Calls    : %s\n", calls))
	b.WriteString(fmt.Sprintf("  • 4K Streaming & Cloud  : %s\n", streaming))
	b.WriteString("--------------------------------------------------------------------------------------------------------------\n")
	b.WriteString("[2] COMPLETE PER-HOP TELEMETRY TABLE:\n")
	b.WriteString(fmt.Sprintf("%-4s | %-28s | %-18s | %-7s | %-9s | %-7s | %-7s | %-7s | %-7s | %-7s\n",
		"Hop", "IP / Hostname", "Geo / ASN", "Loss %", "Sent/Recv", "Last", "Avg", "Best", "Worst", "Jitter"))
	b.WriteString("-----+------------------------------+--------------------+---------+-----------+---------+---------+---------+---------+---------\n")

	for _, h := range snap.Hops {
		hostCol := h.IP
		if hostCol == "" {
			hostCol = "* * * (ICMP Silent)"
		} else if h.Hostname != "" {
			hostCol = fmt.Sprintf("%s (%s)", h.IP, h.Hostname)
		}
		if len(hostCol) > 28 {
			hostCol = hostCol[:25] + "..."
		}

		geoCol := strings.TrimSpace(h.Location)
		if geoCol == "" {
			geoCol = strings.TrimSpace(h.ASN)
		}
		if len(geoCol) > 18 {
			geoCol = geoCol[:15] + "..."
		}

		sentRecv := fmt.Sprintf("%d/%d", h.Sent, h.Received)
		flag := ""
		if h.LossPercent > 5.0 {
			flag = " [<!> CRIT LOSS]"
		} else if h.LossPercent > 2.0 {
			flag = " [! WARN]"
		}

		b.WriteString(fmt.Sprintf("%-4d | %-28s | %-18s | %6.1f%% | %-9s | %5.1fms | %5.1fms | %5.1fms | %5.1fms | %5.1fms%s\n",
			h.Hop, hostCol, geoCol, h.LossPercent, sentRecv, h.LastMs, h.AvgMs, h.BestMs, h.WorstMs, h.JitterMs, flag))
	}

	b.WriteString("--------------------------------------------------------------------------------------------------------------\n")
	b.WriteString("[3] DETAILED GUIDE TO ALL EXTRACTED METRICS:\n")
	b.WriteString("  • Hop #               : Sequential router step (TTL) from your device (Hop 1) to the target server.\n")
	b.WriteString("  • IP / Hostname       : Router IPv4 address and Reverse DNS (PTR) hostname identifying city/backbone role.\n")
	b.WriteString("  • Geo-IP / ASN        : Geographic location and Autonomous System Number of the carrier or cloud network.\n")
	b.WriteString("  • Loss %              : Packet loss ratio (0%–2% Healthy, 2%–5% Warning, >5% Critical bottleneck).\n")
	b.WriteString("  • Sent / Recv         : Total ICMP probes transmitted vs. replies received (statistical sample size).\n")
	b.WriteString("  • Last / Avg (ms)     : Latest and mean Round-Trip Time in milliseconds; lower means faster response.\n")
	b.WriteString("  • Best / Worst (ms)   : Minimum and peak RTT observed; wide spread indicates transient queue congestion.\n")
	b.WriteString("  • Jitter (ms)         : Mean packet-to-packet RTT variance; <10 ms is ideal for gaming and real-time VoIP.\n")
	b.WriteString("  • ICMP Silent (* * *) : Transit router filtering ICMP Time-Exceeded; normal if final destination has 0% loss.\n")
	b.WriteString("==============================================================================================================\n")
	b.WriteString(fmt.Sprintf("Generated by Masar %s — Visual MTR & Smart Network Diagnostics | Developed by @mhmdrfx\n", verTag))

	return b.String()
}

// BuildDetailedJSONReport serializes the trace snapshot, hop annotations, and field reference to JSON.
func BuildDetailedJSONReport(snap mtr.TraceSnapshot, lang string) ([]byte, error) {
	isAr := strings.HasPrefix(strings.ToLower(strings.TrimSpace(lang)), "ar")
	sevLabel, statusTitle, detailText := localizeVerdictForReport(snap, isAr)

	var destHop *mtr.HopStat
	for i := range snap.Hops {
		if snap.Hops[i].ReachedDest {
			destHop = &snap.Hops[i]
			break
		}
	}
	if destHop == nil && len(snap.Hops) > 0 {
		destHop = &snap.Hops[len(snap.Hops)-1]
	}
	gaming, calls, streaming := evaluateServiceReadiness(destHop, isAr)

	type annotatedHop struct {
		mtr.HopStat
		Role           string `json:"role"`
		Interpretation string `json:"interpretation"`
	}

	hopsOut := make([]annotatedHop, 0, len(snap.Hops))
	for _, h := range snap.Hops {
		ev := evaluateHopForReport(h, isAr)
		hopsOut = append(hopsOut, annotatedHop{
			HopStat:        h,
			Role:           ev.roleLabel,
			Interpretation: ev.statusLabel,
		})
	}

	var glossary map[string]string
	if isAr {
		glossary = map[string]string{
			"hop":            "ترتيب القفزة (TTL) بدءاً من الراوتر المنزلي (1) وحتى الخادم النهائي.",
			"ip":             "العنوان الرقمي (IPv4) للراوتر المستجيب عند تلك القفزة.",
			"hostname":       "الاسم العكسي للنطاق (PTR) المسجل لعنوان الراوتر.",
			"location":       "الدولة والمدينة الجغرافية المقدرة لموقع الراوتر.",
			"asn":            "رقم واسم النظام المستقل للشركة المزودة أو الشبكة السحابية.",
			"lossPercent":    "النسبة المئوية لفقد الحزم الحقيقي (من 0% إلى 2% سليم، وأكثر من 5% خلل مؤثر).",
			"sent_received":  "إجمالي نبضات الفحص المرسلة والمستلمة لحساب دقة نسبة الفقد.",
			"lastMs":         "آخر زمن استجابة تم قياسه بالمللي ثانية.",
			"avgMs":          "المتوسط الحسابي لزمن الاستجابة منذ بداية الجلسة بالمللي ثانية.",
			"bestMs_worstMs": "أفضل (أدنى) وأسوأ (أعلى) زمن استجابة مسجل لرصد قفزات الازدحام.",
			"jitterMs":       "معدل التذبذب الزمني للاستجابة بين الحزم المتتالية بالمللي ثانية.",
			"history":        "مصفوفة القراءات الزمنية لآخر 60 ثانية لرسم منحنى الاستقرار.",
			"reachedDest":    "يوضح ما إذا كانت هذه القفزة قد وصلت إلى الوجهة النهائية.",
		}
	} else {
		glossary = map[string]string{
			"hop":            "Sequential Time-To-Live (TTL) router step from Hop 1 (Local Gateway) to Target.",
			"ip":             "IPv4 address of the responding router node.",
			"hostname":       "Reverse DNS (PTR) hostname of the router.",
			"location":       "Geographic country and city of the router (Geo-IP).",
			"asn":            "Autonomous System Number and carrier or cloud organization name.",
			"lossPercent":    "True packet loss percentage (0%–2% Healthy, 2%–5% Warning, >5% Critical).",
			"sent_received":  "Total ICMP Echo probes transmitted and received on this hop.",
			"lastMs":         "Most recent Round-Trip Time sample in milliseconds.",
			"avgMs":          "Cumulative mean Round-Trip Time in milliseconds.",
			"bestMs_worstMs": "Minimum and maximum Round-Trip Time recorded during the session.",
			"jitterMs":       "Mean inter-packet latency variation in milliseconds (key metric for gaming and VoIP).",
			"history":        "Rolling 60-second RTT history array in milliseconds.",
			"reachedDest":    "True when the probe reached the final target destination IP.",
		}
	}

	appVer := currentAppVersion
	if appVer == "" {
		appVer = "1.0"
	}
	verTag := "v" + appVer

	genName := fmt.Sprintf("Masar %s — Visual MTR & Smart Network Diagnostics", verTag)
	if isAr {
		genName = fmt.Sprintf("مسار (Masar %s) — الفحص البصري للمسار وتشخيص الشبكة الذكي", verTag)
	}

	payload := map[string]interface{}{
		"reportMetadata": map[string]interface{}{
			"generator":   genName,
			"developer":   "@mhmdrfx",
			"generatedAt": time.Now().Format(time.RFC3339),
			"language":    lang,
			"target":      snap.Target,
			"resolvedIp":  snap.ResolvedIP,
			"lastSample":  snap.UpdatedAt,
		},
		"executiveDiagnostic": map[string]interface{}{
			"healthScore":   snap.Health.Score,
			"severity":      snap.Health.Severity,
			"severityLabel": sevLabel,
			"verdict":       statusTitle,
			"detail":        detailText,
			"culpritHop":    snap.Health.CulpritHop,
			"serviceSuitability": map[string]string{
				"competitiveGaming": gaming,
				"voipAndVideoCalls": calls,
				"streamingAndCloud": streaming,
			},
		},
		"hops":                   hopsOut,
		"extractedDataReference": glossary,
	}

	return json.MarshalIndent(payload, "", "  ")
}

// BuildDetailedCSVReport formats the trace snapshot and metric reference as UTF-8 CSV.
func BuildDetailedCSVReport(snap mtr.TraceSnapshot, lang string) string {
	isAr := strings.HasPrefix(strings.ToLower(strings.TrimSpace(lang)), "ar")
	sevLabel, statusTitle, detailText := localizeVerdictForReport(snap, isAr)

	var buf strings.Builder
	// UTF-8 BOM ensures Microsoft Excel on Windows renders Arabic characters cleanly
	buf.WriteString("\xEF\xBB\xBF")

	w := csv.NewWriter(&buf)
	nowStr := time.Now().Format("2006-01-02 15:04:05")

	appVer := currentAppVersion
	if appVer == "" {
		appVer = "1.0"
	}
	verTag := "v" + appVer

	if isAr {
		_ = w.Write([]string{fmt.Sprintf("تقرير مسار (Masar %s) الرسمي لتشخيص الشبكة", verTag), nowStr})
		_ = w.Write([]string{"الهدف المفحوص", snap.Target, "عنوان IP المحلل", snap.ResolvedIP})
		_ = w.Write([]string{"مؤشر الجودة الكلي", fmt.Sprintf("%d%% (%s)", snap.Health.Score, sevLabel), "الخلاصة", statusTitle})
		_ = w.Write([]string{"التفصيل التشخيصي", detailText})
		_ = w.Write([]string{})
		_ = w.Write([]string{
			"رقم القفزة", "الدور في المسار", "عنوان IP", "اسم المضيف (PTR)",
			"الموقع الجغرافي", "النظام المستقل (ASN)", "نسبة الفقد %", "الحزم المرسلة",
			"الحزم المستلمة", "الاستجابة الحالية (ms)", "متوسط الاستجابة (ms)", "أفضل استجابة (ms)",
			"أسوأ استجابة (ms)", "التذبذب الزمني (ms)", "وصل للوجهة", "التقييم الفني للقفزة",
		})
	} else {
		_ = w.Write([]string{fmt.Sprintf("Masar %s — Official Network Diagnostic CSV Report", verTag), nowStr})
		_ = w.Write([]string{"Target Host", snap.Target, "Resolved IP", snap.ResolvedIP})
		_ = w.Write([]string{"Health Score", fmt.Sprintf("%d%% (%s)", snap.Health.Score, sevLabel), "Verdict", statusTitle})
		_ = w.Write([]string{"Diagnostic Detail", detailText})
		_ = w.Write([]string{})
		_ = w.Write([]string{
			"Hop", "Segment Role", "IP", "Hostname", "Location", "ASN",
			"LossPercent", "Sent", "Received", "LastMs", "AvgMs", "BestMs", "WorstMs", "JitterMs", "ReachedDest", "Technical Verdict",
		})
	}

	for _, h := range snap.Hops {
		ev := evaluateHopForReport(h, isAr)
		reachedLabel := fmt.Sprintf("%t", h.ReachedDest)
		if isAr {
			if h.ReachedDest {
				reachedLabel = "نعم"
			} else {
				reachedLabel = "لا"
			}
		}
		_ = w.Write([]string{
			fmt.Sprintf("%d", h.Hop),
			ev.roleLabel,
			h.IP,
			h.Hostname,
			h.Location,
			h.ASN,
			fmt.Sprintf("%.1f", h.LossPercent),
			fmt.Sprintf("%d", h.Sent),
			fmt.Sprintf("%d", h.Received),
			fmt.Sprintf("%.1f", h.LastMs),
			fmt.Sprintf("%.1f", h.AvgMs),
			fmt.Sprintf("%.1f", h.BestMs),
			fmt.Sprintf("%.1f", h.WorstMs),
			fmt.Sprintf("%.1f", h.JitterMs),
			reachedLabel,
			ev.statusLabel,
		})
	}

	_ = w.Write([]string{})
	if isAr {
		_ = w.Write([]string{"المؤشر المستخرج", "التعريف وطريقة القراءة الصحيحة"})
		_ = w.Write([]string{"رقم القفزة", "ترتيب الراوتر على المسار بدءاً من الراوتر المنزلي (القفزة 1) وصولاً إلى الخادم النهائي."})
		_ = w.Write([]string{"نسبة الفقد %", "نسبة الحزم المفقودة: من 0% إلى 2% مسار سليم، ومن 2% إلى 5% تحذير، وأكثر من 5% خلل يسبب تقطيعاً."})
		_ = w.Write([]string{"متوسط الاستجابة (ms)", "متوسط زمن رحلة الحزمة ذهاباً وإياباً بالمللي ثانية؛ كلما انخفض الرقم كان الاتصال أسرع."})
		_ = w.Write([]string{"أفضل وأسوأ استجابة", "أدنى وأعلى زمن استجابة مسجل؛ اتساع الفارق بينهما يكشف وجود ضغط أو ازدحام لحظي."})
		_ = w.Write([]string{"التذبذب الزمني", "مقدار التفاوت بين قراءات الاستجابة المتتالية؛ يجب أن يبقى أقل من 10 مللي ثانية لاستقرار الألعاب والمكالمات."})
		_ = w.Write([]string{"صامت ICMP", "راوتر عبور يتجاهل رسائل الفحص أمنياً؛ لا يمثل أي عطل طالما استجابت الوجهة النهائية دون فقد."})
	} else {
		_ = w.Write([]string{"Extracted Metric Reference", "Definition & Interpretation Guide"})
		_ = w.Write([]string{"Hop", "Router sequence number from local gateway (Hop 1) to final target server."})
		_ = w.Write([]string{"LossPercent", "Packet loss ratio: 0%–2% Healthy, 2%–5% Warning, >5% Critical bottleneck."})
		_ = w.Write([]string{"AvgMs", "Average Round-Trip Time in milliseconds across all received probes."})
		_ = w.Write([]string{"BestMs / WorstMs", "Minimum and peak RTT recorded; large gap indicates transient congestion."})
		_ = w.Write([]string{"JitterMs", "Mean inter-packet RTT variance; <10 ms is optimal for gaming and VoIP."})
		_ = w.Write([]string{"ICMP Silent", "Intermediate router dropping ICMP TTL-expired packets; harmless when final hop loss is 0%."})
	}

	w.Flush()
	return buf.String()
}

// BuildDetailedHTMLReport renders a self-contained printable HTML diagnostic report.
func BuildDetailedHTMLReport(snap mtr.TraceSnapshot, lang string) string {
	isAr := strings.HasPrefix(strings.ToLower(strings.TrimSpace(lang)), "ar")
	dir := "ltr"
	htmlLang := "en"
	textAlign := "left"
	borderAccentSide := "border-left"
	bodyFont := `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`
	if isAr {
		dir = "rtl"
		htmlLang = "ar"
		textAlign = "right"
		borderAccentSide = "border-right"
		bodyFont = `"Segoe UI", Tahoma, Arial, sans-serif`
	}

	sevLabel, statusTitle, detailText := localizeVerdictForReport(snap, isAr)

	scoreColor := "#0284c7"
	verdictBg := "#f0f9ff"
	switch snap.Health.Severity {
	case "healthy":
		scoreColor = "#059669"
		verdictBg = "#ecfdf5"
	case "warning":
		scoreColor = "#d97706"
		verdictBg = "#fffbeb"
	case "critical":
		scoreColor = "#dc2626"
		verdictBg = "#fef2f2"
	}

	var hop1, ispHop, destHop *mtr.HopStat
	silentCount := 0
	respondingCount := 0
	for i := range snap.Hops {
		h := &snap.Hops[i]
		if h.Hop == 1 {
			hop1 = h
		} else if (h.Hop == 2 || h.Hop == 3) && ispHop == nil && h.Received > 0 {
			ispHop = h
		}
		if h.IP == "" || (h.Received == 0 && h.LossPercent == 0) {
			silentCount++
		} else if h.Received > 0 {
			respondingCount++
		}
		if h.ReachedDest {
			destHop = h
		}
	}
	if destHop == nil && len(snap.Hops) > 0 {
		destHop = &snap.Hops[len(snap.Hops)-1]
	}

	gaming, calls, streaming := evaluateServiceReadiness(destHop, isAr)

	hop1Summary := "—"
	if hop1 != nil && hop1.Received > 0 {
		hop1Summary = fmt.Sprintf("%.1f ms • %.1f%%", hop1.AvgMs, hop1.LossPercent)
	}
	ispSummary := "—"
	if ispHop != nil && ispHop.Received > 0 {
		ispSummary = fmt.Sprintf("%.1f ms • %.1f%%", ispHop.AvgMs, ispHop.LossPercent)
	}
	destRttSummary := "—"
	destJitterSummary := "—"
	destLossSummary := "—"
	if destHop != nil && destHop.Received > 0 {
		destRttSummary = fmt.Sprintf("%.1f ms", destHop.AvgMs)
		destJitterSummary = fmt.Sprintf("%.1f ms", destHop.JitterMs)
		destLossSummary = fmt.Sprintf("%.1f%%", destHop.LossPercent)
	}

	var rows strings.Builder
	for _, h := range snap.Hops {
		ev := evaluateHopForReport(h, isAr)
		ipCell := html.EscapeString(h.IP)
		if ipCell == "" {
			if isAr {
				ipCell = "<span dir='rtl' style='color:#94a3b8;font-style:italic'>* * * (عقدة صامتة ICMP)</span>"
			} else {
				ipCell = "<span style='color:#94a3b8;font-style:italic'>* * * (ICMP Silent)</span>"
			}
		} else if h.Hostname != "" {
			ipCell = fmt.Sprintf("<strong>%s</strong><div style='color:#64748b;font-size:10.5px'>%s</div>",
				html.EscapeString(h.IP), html.EscapeString(h.Hostname))
		} else {
			ipCell = fmt.Sprintf("<strong>%s</strong>", ipCell)
		}

		geo := html.EscapeString(strings.TrimSpace(h.Location))
		asn := html.EscapeString(strings.TrimSpace(h.ASN))
		geoCell := "—"
		if geo != "" || asn != "" {
			geoCell = fmt.Sprintf("<div dir='ltr' style='text-align:%s'>%s</div><div dir='ltr' style='color:#64748b;font-size:10px;font-family:monospace;text-align:%s'>%s</div>", textAlign, geo, textAlign, asn)
		}

		lossStr := "—"
		lastStr := "—"
		avgStr := "—"
		bestWorstStr := "—"
		jitStr := "—"
		if h.Received > 0 || h.LossPercent > 0 {
			lossStr = fmt.Sprintf("%.1f%%", h.LossPercent)
		}
		if h.Received > 0 {
			lastStr = fmt.Sprintf("%.1f", h.LastMs)
			avgStr = fmt.Sprintf("%.1f", h.AvgMs)
			bestWorstStr = fmt.Sprintf("%.1f / %.1f", h.BestMs, h.WorstMs)
			jitStr = fmt.Sprintf("%.1f", h.JitterMs)
		}

		lossStyle := "color:#059669;font-weight:700"
		if h.LossPercent > 5.0 {
			lossStyle = "color:#dc2626;font-weight:800"
		} else if h.LossPercent > 2.0 {
			lossStyle = "color:#d97706;font-weight:700"
		} else if h.Received == 0 && h.LossPercent == 0 {
			lossStyle = "color:#94a3b8"
		}

		spark := renderInlineSparklineSVG(h.History, h.LossPercent)

		rows.WriteString(fmt.Sprintf(
			`<tr>
				<td dir="ltr" style="font-weight:700;text-align:%s">#%d</td>
				<td><span class="role-pill">%s</span></td>
				<td dir="ltr" style="text-align:left">%s</td>
				<td>%s</td>
				<td dir="ltr" style="%s;text-align:%s">%s</td>
				<td dir="ltr" style="text-align:%s">%d / %d</td>
				<td dir="ltr" style="text-align:%s">%s</td>
				<td dir="ltr" style="font-weight:700;text-align:%s">%s</td>
				<td dir="ltr" style="text-align:%s">%s</td>
				<td dir="ltr" style="text-align:%s">%s</td>
				<td style="text-align:center">%s</td>
				<td><span style="color:%s;font-weight:700;font-size:11px">%s</span></td>
			</tr>`,
			textAlign, h.Hop,
			html.EscapeString(ev.roleLabel),
			ipCell,
			geoCell,
			lossStyle, textAlign, lossStr,
			textAlign, h.Sent, h.Received,
			textAlign, lastStr,
			textAlign, avgStr,
			textAlign, bestWorstStr,
			textAlign, jitStr,
			spark,
			ev.statusColor, html.EscapeString(ev.statusLabel),
		))
	}

	nowFormatted := time.Now().Format("2006-01-02 15:04:05 MST")

	var (
		docTitle, subMeta, printBtnText, scoreHeading      string
		sec1Heading, sec2Heading, sec3Heading, sec4Heading string
		kpi1Title, kpi2Title, kpi3Title                    string
		kpi4Title, kpi5Title, kpi6Title                    string
		suitGamingLbl, suitCallsLbl, suitStreamLbl         string
		thHop, thRole, thHost, thGeo, thLoss, thSR         string
		thLast, thAvg, thBW, thJit, thTrend, thEval        string
		glossaryCardsHTML                                  string
		footerCredits                                      string
	)

	appVer := currentAppVersion
	if appVer == "" {
		appVer = "1.0"
	}
	verTag := "v" + appVer

	if isAr {
		docTitle = "مسار — التقرير الرسمي لتشخيص الشبكة وتحليل المسار"
		subMeta = fmt.Sprintf("الهدف المفحوص: <strong dir='ltr'>%s</strong> (<span dir='ltr'>%s</span>) • تاريخ الإصدار: <span dir='ltr'>%s</span>",
			html.EscapeString(snap.Target), html.EscapeString(snap.ResolvedIP), nowFormatted)
		printBtnText = "حفظ كملف PDF / طباعة التقرير"
		scoreHeading = "مؤشر جودة الاتصال"
		sec1Heading = "أولاً: الملخص التنفيذي للمؤشرات المستخرجة"
		sec2Heading = "ثانياً: تقييم كفاءة الاتصال للاستخدامات العملية"
		sec3Heading = "ثالثاً: جدول القراءات التفصيلية لكل قفزة على المسار"
		sec4Heading = "رابعاً: الدليل المرجعي الشامل لشرح جميع البيانات المستخرجة"
		kpi1Title = "الراوتر المحلي (القفزة 1)"
		kpi2Title = "بوابة مزود الخدمة"
		kpi3Title = "متوسط استجابة الوجهة"
		kpi4Title = "التذبذب الزمني للاستجابة"
		kpi5Title = "نسبة فقد الوجهة النهائية"
		kpi6Title = "إجمالي القفزات (المستجيبة / الصامتة)"
		suitGamingLbl = "الألعاب الإلكترونية التنافسية"
		suitCallsLbl = "المكالمات الصوتية والاجتماعات المرئية"
		suitStreamLbl = "البث فائق الدقة (4K) والسحابة"
		thHop, thRole, thHost, thGeo = "القفزة", "الدور", "عنوان IP / المضيف", "الموقع / المزود"
		thLoss, thSR, thLast, thAvg = "الفقد %", "مرسل / مستلم", "الحالي (ms)", "المتوسط (ms)"
		thBW, thJit, thTrend, thEval = "الأفضل / الأسوأ", "التذبذب (ms)", "منحنى 60ث", "التقييم الفني"
		footerCredits = fmt.Sprintf("تم استخراج وتوليد هذا التقرير الرسمي عبر برنامج مسار (الإصدار %s) — تطوير @mhmdrfx • صُنع بكل إتقان", appVer)
		glossaryCardsHTML = `
		<div class="g-card"><div class="g-head"><span class="g-title"><span class="g-num" dir="ltr">01</span><span>رقم القفزة وترتيب المحطة</span></span><code class="g-code" dir="ltr">Hop / TTL</code></div><p>يمثل كل راوتر تعبره بياناتك بالترتيب الزمني؛ القفزة <bdi dir="ltr"><strong>#1</strong></bdi> هي راوترك المنزلي، والقفزتان <bdi dir="ltr"><strong>#2 – #3</strong></bdi> تمثلان مقسم وبوابة شركة الاتصالات، تليها عقد الربط الدولي وصولاً إلى الخادم الهدف.</p></div>
		<div class="g-card"><div class="g-head"><span class="g-title"><span class="g-num" dir="ltr">02</span><span>عنوان الراوتر والاسم العكسي للمضيف</span></span><code class="g-code" dir="ltr">IP &amp; PTR</code></div><p>العنوان الرقمي للراوتر مع اسمه العكسي المسجل في سجلات النطاقات، والذي يكشف غالباً اسم المدينة أو المزود أو نوع عقدة الشبكة مثل <code dir="ltr">bng</code> أو <code dir="ltr">ixp</code> أو <code dir="ltr">dns.google</code>.</p></div>
		<div class="g-card"><div class="g-head"><span class="g-title"><span class="g-num" dir="ltr">03</span><span>الموقع الجغرافي ورقم النظام المستقل</span></span><code class="g-code" dir="ltr">Geo-IP &amp; ASN</code></div><p>يحدد الدولة والمدينة التي يتواجد فيها الراوتر ورقم الشبكة العالمية المالكة له (مثل <code dir="ltr">AS15169 Google</code> أو <code dir="ltr">AS13335 Cloudflare</code>) لتتبع مسار خروج البيانات دولياً.</p></div>
		<div class="g-card"><div class="g-head"><span class="g-title"><span class="g-num" dir="ltr">04</span><span>نسبة فقد الحزم المئوية</span></span><code class="g-code" dir="ltr">Loss %</code></div><p>أهم مؤشر لتشخيص التقطيع: من <bdi dir="ltr"><strong>0%</strong></bdi> إلى <bdi dir="ltr"><strong>2%</strong></bdi> مسار سليم تماماً، ومن <bdi dir="ltr"><strong>2%</strong></bdi> إلى <bdi dir="ltr"><strong>5%</strong></bdi> تحذير متوسط، وأكثر من <bdi dir="ltr"><strong>5%</strong></bdi> خلل حقيقي يسبب تقطيعاً في الألعاب والصوت وبطئاً في التصفح.</p></div>
		<div class="g-card"><div class="g-head"><span class="g-title"><span class="g-num" dir="ltr">05</span><span>الحزم المرسلة والمستلمة</span></span><code class="g-code" dir="ltr">Sent / Recv</code></div><p>عدد نبضات الفحص المرسلة مقارنةً بالردود المستلمة؛ كلما زاد عدد العينات (مثل <bdi dir="ltr">30</bdi> أو <bdi dir="ltr">60</bdi> حزمة) زادت الدقة الإحصائية للتقرير عند تقديمه للدعم الفني.</p></div>
		<div class="g-card"><div class="g-head"><span class="g-title"><span class="g-num" dir="ltr">06</span><span>الاستجابة الحالية والمتوسطة</span></span><code class="g-code" dir="ltr">Last &amp; Avg ms</code></div><p>زمن الذهاب والعودة بالمللي ثانية. القيمة الأقل من <bdi dir="ltr"><strong>35 ms</strong></bdi> ممتازة محلياً وإقليمياً، ومن <bdi dir="ltr"><strong>35 ms</strong></bdi> إلى <bdi dir="ltr"><strong>85 ms</strong></bdi> جيدة جداً للربط الدولي، وأعلى من <bdi dir="ltr"><strong>150 ms</strong></bdi> تعد مرتفعة.</p></div>
		<div class="g-card"><div class="g-head"><span class="g-title"><span class="g-num" dir="ltr">07</span><span>أفضل وأسوأ زمن استجابة مسجل</span></span><code class="g-code" dir="ltr">Best &amp; Worst</code></div><p>أسرع وأبطأ زمن استجابة سُجّل للقفزة. تقارب الرقمين يدل على خط مستقر تماماً، بينما الفجوة الواسعة تدل على ازدحام لحظي في طوابير الشبكة عند سحب سرعات عالية.</p></div>
		<div class="g-card"><div class="g-head"><span class="g-title"><span class="g-num" dir="ltr">08</span><span>تباين الاستجابة الزمني (التذبذب)</span></span><code class="g-code" dir="ltr">Jitter ms</code></div><p>يقيس مدى ثبات زمن الاستجابة بين كل ثانية والتي تليها. بقاء هذا المؤشر أقل من <bdi dir="ltr"><strong>10 ms</strong></bdi> ضروري جداً لمنع التقطيع المفاجئ في الألعاب التنافسية ومكالمات الفيديو.</p></div>
		<div class="g-card"><div class="g-head"><span class="g-title"><span class="g-num" dir="ltr">09</span><span>الراوترات الصامتة وتجاهل الفحص</span></span><code class="g-code" dir="ltr">ICMP Silent</code></div><p>بعض راوترات العبور المخصصة لنقل البيانات الضخمة مبرمجة أمنياً لتجاهل رسائل الفحص مع تمرير بياناتك بسرعة طبيعية؛ لذلك طالما أن القفزة النهائية تسجل فقداً قدره <bdi dir="ltr"><strong>0%</strong></bdi> فلا يعتبر ذلك عطلاً أبداً.</p></div>
		<div class="g-card"><div class="g-head"><span class="g-title"><span class="g-num" dir="ltr">10</span><span>مؤشر جودة الاتصال الذكي</span></span><code class="g-code" dir="ltr">Health 0–100%</code></div><p>خوارزمية مسار الذكية تفحص جميع القفزات معاً وتعزل مصدر المشكلة تلقائياً (سواء من الشبكة المنزلية، أو من شركة الاتصالات، أو من الخادم البعيد) وتمنحك درجة تقييم موحدة.</p></div>`
	} else {
		docTitle = "Masar — Official Network Diagnostic & Telemetry Report"
		subMeta = fmt.Sprintf("Target: <strong>%s</strong> (%s) • Generated: %s",
			html.EscapeString(snap.Target), html.EscapeString(snap.ResolvedIP), nowFormatted)
		printBtnText = "Save as PDF / Print Official Report"
		scoreHeading = "Connection Health Score"
		sec1Heading = "1. Executive Extracted Telemetry KPIs"
		sec2Heading = "2. Real-World Application & Protocol Readiness"
		sec3Heading = "3. Complete Hop-by-Hop Telemetry Breakdown"
		sec4Heading = "4. Comprehensive Reference Guide to All Extracted Metrics"
		kpi1Title = "Local Router (Hop 1)"
		kpi2Title = "ISP Gateway (Hops 2–3)"
		kpi3Title = "End-to-End Avg RTT"
		kpi4Title = "Path Jitter"
		kpi5Title = "Destination Loss"
		kpi6Title = "Route Nodes (Active / Silent)"
		suitGamingLbl = "Competitive Gaming"
		suitCallsLbl = "VoIP & Video Conferencing"
		suitStreamLbl = "4K Streaming & Cloud"
		thHop, thRole, thHost, thGeo = "Hop", "Segment Role", "IP / Hostname", "Geo-IP / ASN"
		thLoss, thSR, thLast, thAvg = "Loss %", "Sent / Recv", "Last (ms)", "Avg (ms)"
		thBW, thJit, thTrend, thEval = "Best / Worst", "Jitter (ms)", "60s Trend", "Technical Verdict"
		footerCredits = fmt.Sprintf("Generated by Masar %s Visual MTR & Smart Network Diagnostics — Developed by @mhmdrfx • Crafted with Perfection", verTag)
		glossaryCardsHTML = `
		<div class="g-card"><div class="g-head"><span class="g-title"><span class="g-num" dir="ltr">01</span><span>Hop Number &amp; TTL Step</span></span><code class="g-code" dir="ltr">Hop / TTL</code></div><p>Sequential router position along the route. <strong>Hop 1</strong> is your local home/office router, <strong>Hops 2–3</strong> represent your ISP access/core gateway, followed by IXP peering nodes up to the target server.</p></div>
		<div class="g-card"><div class="g-head"><span class="g-title"><span class="g-num" dir="ltr">02</span><span>IP &amp; Reverse Hostname</span></span><code class="g-code" dir="ltr">IP &amp; PTR</code></div><p>The router's IPv4 address and reverse DNS record, which frequently reveals city codes, carrier POP names, and backbone link types.</p></div>
		<div class="g-card"><div class="g-head"><span class="g-title"><span class="g-num" dir="ltr">03</span><span>Geographic Location &amp; ASN</span></span><code class="g-code" dir="ltr">Geo-IP &amp; ASN</code></div><p>Geographic country/city and Autonomous System Number identifying the exact telecom operator or cloud backbone handling your packets.</p></div>
		<div class="g-card"><div class="g-head"><span class="g-title"><span class="g-num" dir="ltr">04</span><span>Packet Loss Percentage</span></span><code class="g-code" dir="ltr">Loss %</code></div><p>Primary indicator of link drops: <strong>0%–2%</strong> Healthy, <strong>2%–5%</strong> Warning, and <strong>&gt;5%</strong> Critical packet loss causing stalls and retransmissions.</p></div>
		<div class="g-card"><div class="g-head"><span class="g-title"><span class="g-num" dir="ltr">05</span><span>Transmitted &amp; Received Probes</span></span><code class="g-code" dir="ltr">Sent / Recv</code></div><p>Total ICMP probes transmitted vs. replies received. Higher sample counts provide stronger statistical proof for ISP support escalations.</p></div>
		<div class="g-card"><div class="g-head"><span class="g-title"><span class="g-num" dir="ltr">06</span><span>Latest &amp; Average Latency</span></span><code class="g-code" dir="ltr">Last &amp; Avg ms</code></div><p>Round-Trip Time in milliseconds. Under <strong>35 ms</strong> is optimal regional latency, <strong>35–85 ms</strong> is solid international routing, and <strong>&gt;150 ms</strong> indicates long-haul or congested paths.</p></div>
		<div class="g-card"><div class="g-head"><span class="g-title"><span class="g-num" dir="ltr">07</span><span>Best &amp; Worst Latency</span></span><code class="g-code" dir="ltr">Best &amp; Worst</code></div><p>Minimum and peak latency observed. Tight grouping proves queue stability; wide spikes indicate transient bufferbloat or link saturation.</p></div>
		<div class="g-card"><div class="g-head"><span class="g-title"><span class="g-num" dir="ltr">08</span><span>Inter-Packet Latency Variance</span></span><code class="g-code" dir="ltr">Jitter ms</code></div><p>Mean packet-to-packet RTT fluctuation. Keeping Jitter below <strong>10 ms</strong> is essential for smooth competitive gaming and glitch-free voice/video calls.</p></div>
		<div class="g-card"><div class="g-head"><span class="g-title"><span class="g-num" dir="ltr">09</span><span>ICMP Silent Transit Nodes</span></span><code class="g-code" dir="ltr">ICMP Silent</code></div><p>Core transit routers often rate-limit or drop ICMP Time-Exceeded replies on their control plane while forwarding traffic normally. If final destination loss is <strong>0%</strong>, silent hops are harmless.</p></div>
		<div class="g-card"><div class="g-head"><span class="g-title"><span class="g-num" dir="ltr">10</span><span>Smart Connection Health Score</span></span><code class="g-code" dir="ltr">Health 0–100%</code></div><p>Masar's automated correlation engine inspects Hop 1, ISP gateways, and end-to-end metrics to isolate the true bottleneck and compute a single reliability grade.</p></div>`
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="%s" dir="%s">
<head>
<meta charset="UTF-8">
<title>%s — %s</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: %s; color: #0f172a; background: #f1f5f9; margin: 0; padding: 28px; line-height: 1.65; letter-spacing: 0; }
  .sheet { max-width: 1120px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 20px; padding: 30px; box-shadow: 0 12px 32px rgba(15,23,42,0.07); }
  .header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 22px; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .score-panel { display: flex; align-items: center; gap: 14px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 18px; border-radius: 14px; }
  .score-val { font-size: 30px; font-weight: 800; color: %s; font-family: "Cascadia Mono", Consolas, monospace; line-height: 1; }
  .print-btn { background: #0284c7; color: #ffffff; border: none; padding: 9px 16px; border-radius: 10px; cursor: pointer; font-weight: 700; font-size: 12px; font-family: inherit; }
  .print-btn:hover { background: #0369a1; }
  .verdict-box { background: %s; %s: 5px solid %s; padding: 16px 20px; border-radius: 12px; margin-bottom: 24px; }
  .sec-title { font-size: 14.5px; font-weight: 800; color: #0369a1; margin: 24px 0 12px 0; letter-spacing: 0; }
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 18px; }
  .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; }
  .kpi-lbl { font-size: 11.5px; color: #64748b; font-weight: 700; margin-bottom: 4px; }
  .kpi-val { font-size: 15px; font-weight: 800; color: #0f172a; font-family: "Cascadia Mono", Consolas, monospace; text-align: %s; }
  .suit-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; margin-bottom: 22px; }
  .suit-card { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 13px 15px; }
  .suit-card strong { display: block; font-size: 12.5px; color: #0284c7; margin-bottom: 4px; }
  .suit-card span { font-size: 12.5px; color: #1e293b; font-weight: 600; }
  .table-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 12px; }
  table { width: 100%%; border-collapse: collapse; font-size: 11.5px; }
  th { background: #0f172a; color: #f8fafc; text-align: %s; padding: 10px 9px; font-weight: 700; white-space: nowrap; }
  td { padding: 8px 9px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
  tr:nth-child(even) td { background: #f8fafc; }
  .role-pill { display: inline-block; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; padding: 2px 8px; border-radius: 6px; font-size: 10.5px; font-weight: 700; white-space: nowrap; }
  .glossary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; margin-top: 10px; }
  .g-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; }
  .g-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 7px; }
  .g-title { display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 800; color: #0f172a; }
  .g-num { display: inline-block; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 6px; padding: 1px 7px; font-size: 11px; font-weight: 800; font-family: "Cascadia Mono", Consolas, monospace; }
  .g-code { background: #ffffff; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; padding: 1px 6px; font-size: 10.5px; font-weight: 700; font-family: "Cascadia Mono", Consolas, monospace; white-space: nowrap; }
  .g-card p { margin: 0; font-size: 12px; color: #334155; line-height: 1.72; }
  .footer { margin-top: 26px; padding-top: 14px; border-top: 1px solid #e2e8f0; display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; font-size: 11.5px; color: #64748b; font-weight: 600; }
  @media print {
    .no-print { display: none !important; }
    body { background: #ffffff; padding: 0; }
    .sheet { border: none; box-shadow: none; padding: 10px; max-width: 100%%; }
    .g-card, .kpi-card, .suit-card, tr { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="sheet">
  <div class="header">
    <div class="brand">
      <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="mg" x1="0%%" y1="0%%" x2="100%%" y2="100%%">
            <stop offset="0%%" stop-color="#06b6d4"/><stop offset="50%%" stop-color="#3b82f6"/><stop offset="100%%" stop-color="#10b981"/>
          </linearGradient>
        </defs>
        <rect x="1.5" y="1.5" width="97" height="97" rx="24.5" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
        <path d="M18 72C18 42 25 24 35 24C45 24 47 52 50 52C53 52 55 24 65 24C75 24 82 42 82 72C74 72 69 58 65 40C61 52 57 69 50 69C43 69 39 52 35 40C31 58 26 72 18 72Z" fill="url(#mg)"/>
      </svg>
      <div>
        <h1 style="margin:0;font-size:19px;color:#0f172a;">%s</h1>
        <div style="font-size:12px;color:#64748b;margin-top:3px;">%s</div>
      </div>
    </div>

    <div class="score-panel">
      <div>
        <div style="font-size:11px;color:#64748b;font-weight:700;">%s</div>
        <div class="score-val" dir="ltr">%d%%</div>
        <div style="font-size:11px;font-weight:700;color:%s;margin-top:2px;">%s</div>
      </div>
      <button class="print-btn no-print" onclick="window.print()">%s</button>
    </div>
  </div>

  <div class="verdict-box">
    <div style="font-weight:800;font-size:15px;color:#0f172a;margin-bottom:4px;">%s</div>
    <div style="font-size:13px;color:#334155;">%s</div>
  </div>

  <div class="sec-title">%s</div>
  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-lbl">%s</div><div class="kpi-val" dir="ltr">%s</div></div>
    <div class="kpi-card"><div class="kpi-lbl">%s</div><div class="kpi-val" dir="ltr">%s</div></div>
    <div class="kpi-card"><div class="kpi-lbl">%s</div><div class="kpi-val" dir="ltr">%s</div></div>
    <div class="kpi-card"><div class="kpi-lbl">%s</div><div class="kpi-val" dir="ltr">%s</div></div>
    <div class="kpi-card"><div class="kpi-lbl">%s</div><div class="kpi-val" dir="ltr">%s</div></div>
    <div class="kpi-card"><div class="kpi-lbl">%s</div><div class="kpi-val" dir="ltr">%d (%d / %d)</div></div>
  </div>

  <div class="sec-title">%s</div>
  <div class="suit-grid">
    <div class="suit-card"><strong>● %s</strong><span>%s</span></div>
    <div class="suit-card"><strong>● %s</strong><span>%s</span></div>
    <div class="suit-card"><strong>● %s</strong><span>%s</span></div>
  </div>

  <div class="sec-title">%s</div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>%s</th><th>%s</th><th>%s</th><th>%s</th><th>%s</th><th>%s</th><th>%s</th><th>%s</th><th>%s</th><th>%s</th><th style="text-align:center">%s</th><th>%s</th>
        </tr>
      </thead>
      <tbody>%s</tbody>
    </table>
  </div>

  <div class="sec-title">%s</div>
  <div class="glossary-grid">%s</div>

  <div class="footer">
    <span>%s</span>
    <span dir="ltr">Masar %s • ICMPv4 Diagnostic Engine</span>
  </div>
</div>
</body>
</html>`,
		htmlLang, dir,
		html.EscapeString(docTitle), html.EscapeString(snap.Target),
		bodyFont,
		scoreColor,
		verdictBg, borderAccentSide, scoreColor,
		textAlign,
		textAlign,
		html.EscapeString(docTitle),
		subMeta,
		html.EscapeString(scoreHeading),
		snap.Health.Score,
		scoreColor, html.EscapeString(sevLabel),
		html.EscapeString(printBtnText),
		html.EscapeString(statusTitle),
		html.EscapeString(detailText),
		html.EscapeString(sec1Heading),
		html.EscapeString(kpi1Title), html.EscapeString(hop1Summary),
		html.EscapeString(kpi2Title), html.EscapeString(ispSummary),
		html.EscapeString(kpi3Title), html.EscapeString(destRttSummary),
		html.EscapeString(kpi4Title), html.EscapeString(destJitterSummary),
		html.EscapeString(kpi5Title), html.EscapeString(destLossSummary),
		html.EscapeString(kpi6Title), len(snap.Hops), respondingCount, silentCount,
		html.EscapeString(sec2Heading),
		html.EscapeString(suitGamingLbl), html.EscapeString(gaming),
		html.EscapeString(suitCallsLbl), html.EscapeString(calls),
		html.EscapeString(suitStreamLbl), html.EscapeString(streaming),
		html.EscapeString(sec3Heading),
		html.EscapeString(thHop), html.EscapeString(thRole), html.EscapeString(thHost), html.EscapeString(thGeo),
		html.EscapeString(thLoss), html.EscapeString(thSR), html.EscapeString(thLast), html.EscapeString(thAvg),
		html.EscapeString(thBW), html.EscapeString(thJit), html.EscapeString(thTrend), html.EscapeString(thEval),
		rows.String(),
		html.EscapeString(sec4Heading),
		glossaryCardsHTML,
		html.EscapeString(footerCredits),
		verTag,
	)
}
