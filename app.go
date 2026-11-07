package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"masar/internal/mtr"
	"masar/internal/nettools"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct manages the Wails application lifecycle, active MTR Engine session, and Multi-Tools.
type App struct {
	ctx          context.Context
	mu           sync.Mutex
	cancelTrace  context.CancelFunc
	traceDone    chan struct{}
	traceSeq     uint64
	running      bool
	lastSnapshot mtr.TraceSnapshot

	speedMu       sync.Mutex
	cancelSpeed   context.CancelFunc
	speedDone     chan struct{}
	speedSeq      uint64
	speedActive   bool
	lastSpeedSnap nettools.SpeedSnapshot
}

// NewApp creates a new App application struct.
func NewApp() *App {
	return &App{}
}

// startup is called when the Wails app starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// shutdown is called when the Wails app is closing.
func (a *App) shutdown(ctx context.Context) {
	a.stopTraceInternal(false)
	a.stopSpeedInternal(false)
}

// StartTrace stops any running trace and launches a new real-time MTR session for target.
func (a *App) StartTrace(target string) error {
	cleanTarget := strings.TrimSpace(target)
	if cleanTarget == "" {
		return errors.New("please enter a valid IPv4 address or hostname")
	}

	a.stopTraceInternal(false)

	a.mu.Lock()
	a.traceSeq++
	mySeq := a.traceSeq
	a.mu.Unlock()

	engine, err := mtr.NewEngine(cleanTarget, func(snap mtr.TraceSnapshot) {
		a.mu.Lock()
		if a.traceSeq != mySeq || !a.running {
			a.mu.Unlock()
			return
		}
		snap.Running = true
		a.lastSnapshot = snap
		a.mu.Unlock()

		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "mtr:update", snap)
		}
	})
	if err != nil {
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "mtr:error", err.Error())
		}
		return err
	}

	traceCtx, cancel := context.WithCancel(context.Background())
	doneCh := make(chan struct{})

	initialSnap := engine.Snapshot()
	initialSnap.Running = true

	a.mu.Lock()
	a.cancelTrace = cancel
	a.traceDone = doneCh
	a.running = true
	a.lastSnapshot = initialSnap
	a.mu.Unlock()

	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "mtr:status", map[string]interface{}{
			"running": true,
			"target":  cleanTarget,
		})
		runtime.EventsEmit(a.ctx, "mtr:update", initialSnap)
	}

	go func() {
		defer close(doneCh)
		runErr := engine.Run(traceCtx)

		a.mu.Lock()
		isCurrent := a.traceSeq == mySeq
		if isCurrent {
			a.running = false
			a.lastSnapshot.Running = false
			a.cancelTrace = nil
			a.traceDone = nil
		}
		a.mu.Unlock()

		if isCurrent && a.ctx != nil {
			if runErr != nil && !errors.Is(runErr, context.Canceled) {
				runtime.EventsEmit(a.ctx, "mtr:error", runErr.Error())
			}
			runtime.EventsEmit(a.ctx, "mtr:status", map[string]interface{}{
				"running": false,
				"target":  cleanTarget,
			})
		}
	}()

	return nil
}

// StopTrace halts the active MTR trace session if one is running.
func (a *App) StopTrace() {
	a.stopTraceInternal(true)
}

func (a *App) stopTraceInternal(emitStatus bool) {
	a.mu.Lock()
	a.traceSeq++
	cancel := a.cancelTrace
	done := a.traceDone
	a.cancelTrace = nil
	a.traceDone = nil
	a.running = false
	a.lastSnapshot.Running = false
	snap := a.lastSnapshot
	a.mu.Unlock()

	if cancel != nil {
		cancel()
	}

	if done != nil {
		select {
		case <-done:
		case <-time.After(400 * time.Millisecond):
		}
	}

	if emitStatus && a.ctx != nil {
		runtime.EventsEmit(a.ctx, "mtr:status", map[string]interface{}{
			"running": false,
		})
		if snap.Target != "" {
			runtime.EventsEmit(a.ctx, "mtr:update", snap)
		}
	}
}

// IsRunning returns true if a trace is currently active.
func (a *App) IsRunning() bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.running
}

// GetLastSnapshot returns the most recent MTR trace snapshot.
func (a *App) GetLastSnapshot() mtr.TraceSnapshot {
	a.mu.Lock()
	defer a.mu.Unlock()
	snap := a.lastSnapshot
	snap.Running = a.running
	return snap
}

// StartSpeedBenchmark starts the continuous live multi-stream speed & edge latency benchmark.
func (a *App) StartSpeedBenchmark() error {
	a.stopSpeedInternal(false)

	speedCtx, cancel := context.WithCancel(context.Background())
	doneCh := make(chan struct{})

	a.speedMu.Lock()
	a.speedSeq++
	mySeq := a.speedSeq
	a.cancelSpeed = cancel
	a.speedDone = doneCh
	a.speedActive = true
	a.lastSpeedSnap.Running = true
	a.speedMu.Unlock()

	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "speed:status", map[string]interface{}{
			"running": true,
		})
	}

	go func() {
		defer close(doneCh)
		nettools.RunLiveSpeedBenchmark(speedCtx, func(snap nettools.SpeedSnapshot) {
			a.speedMu.Lock()
			active := a.speedSeq == mySeq && a.speedActive
			if active {
				snap.Running = true
				a.lastSpeedSnap = snap
			}
			a.speedMu.Unlock()
			if active && a.ctx != nil {
				runtime.EventsEmit(a.ctx, "speed:update", snap)
			}
		})

		a.speedMu.Lock()
		isCurrent := a.speedSeq == mySeq
		if isCurrent {
			a.speedActive = false
			a.lastSpeedSnap.Running = false
			a.cancelSpeed = nil
			a.speedDone = nil
		}
		a.speedMu.Unlock()

		if isCurrent && a.ctx != nil {
			runtime.EventsEmit(a.ctx, "speed:status", map[string]interface{}{
				"running": false,
			})
		}
	}()

	return nil
}

// StopSpeedBenchmark stops the continuous live speed benchmark.
func (a *App) StopSpeedBenchmark() {
	a.stopSpeedInternal(true)
}

func (a *App) stopSpeedInternal(emitStatus bool) {
	a.speedMu.Lock()
	a.speedSeq++
	cancel := a.cancelSpeed
	done := a.speedDone
	a.cancelSpeed = nil
	a.speedDone = nil
	a.speedActive = false
	a.lastSpeedSnap.Running = false
	a.speedMu.Unlock()

	if cancel != nil {
		cancel()
	}

	if done != nil {
		select {
		case <-done:
		case <-time.After(400 * time.Millisecond):
		}
	}

	if emitStatus && a.ctx != nil {
		runtime.EventsEmit(a.ctx, "speed:status", map[string]interface{}{
			"running": false,
		})
	}
}

// GetLastSpeedSnapshot returns the latest speed benchmark snapshot and running status.
func (a *App) GetLastSpeedSnapshot() nettools.SpeedSnapshot {
	a.speedMu.Lock()
	defer a.speedMu.Unlock()
	snap := a.lastSpeedSnap
	snap.Running = a.speedActive
	return snap
}

// IsSpeedRunning returns true if the live speed benchmark is active.
func (a *App) IsSpeedRunning() bool {
	a.speedMu.Lock()
	defer a.speedMu.Unlock()
	return a.speedActive
}

// CopySupportSummary formats the latest MTR telemetry into a detailed diagnostic report
// and copies it directly to the system clipboard for ISP/IT support tickets.
func (a *App) CopySupportSummary() (string, error) {
	return a.CopySupportSummaryWithLang("en")
}

// CopySupportSummaryWithLang formats the latest MTR telemetry in the requested UI language ("ar" or "en")
// with full segment evaluation and metric explanations, copying it to the system clipboard.
func (a *App) CopySupportSummaryWithLang(lang string) (string, error) {
	a.mu.Lock()
	snap := a.lastSnapshot
	a.mu.Unlock()

	isAr := strings.HasPrefix(strings.ToLower(strings.TrimSpace(lang)), "ar")
	if len(snap.Hops) == 0 {
		if isAr {
			return "", errors.New("لا توجد بيانات فحص مسار حالياً — اضغط على «بدء الفحص» أولاً لاستخراج القراءات")
		}
		return "", errors.New("no trace telemetry available yet — start a trace first")
	}

	summary := BuildDetailedSupportReport(snap, lang)
	if a.ctx != nil {
		_ = runtime.ClipboardSetText(a.ctx, summary)
	}
	return summary, nil
}

// ExportReport opens a native Save File Dialog and exports the current trace in "html" (Official Printable PDF/HTML Report), "json", or "csv" format.
func (a *App) ExportReport(format string) (string, error) {
	raw := strings.TrimSpace(format)
	lang := "en"
	if strings.Contains(raw, ":") {
		parts := strings.SplitN(raw, ":", 2)
		raw = parts[0]
		lang = parts[1]
	}
	return a.ExportReportWithLang(raw, lang)
}

// ExportReportWithLang opens a localized Save File Dialog and exports a comprehensive report
// ("html", "json", or "csv") containing live extracted telemetry and a full metric reference guide.
func (a *App) ExportReportWithLang(format string, lang string) (string, error) {
	a.mu.Lock()
	snap := a.lastSnapshot
	a.mu.Unlock()

	isAr := strings.HasPrefix(strings.ToLower(strings.TrimSpace(lang)), "ar")
	if len(snap.Hops) == 0 {
		if isAr {
			return "", errors.New("لا توجد بيانات فحص مسار حالياً — اضغط على «بدء الفحص» أولاً لاستخراج التقرير")
		}
		return "", errors.New("no trace telemetry available yet — start a trace first")
	}

	ext := strings.ToLower(strings.TrimSpace(format))
	if ext != "json" && ext != "csv" && ext != "html" {
		ext = "html"
	}

	timestamp := time.Now().Format("20060102-150405")
	safeTarget := strings.NewReplacer(":", "_", "/", "_", "\\", "_", " ", "_").Replace(snap.Target)
	defaultName := fmt.Sprintf("masar-report-%s-%s.%s", safeTarget, timestamp, ext)

	var content []byte
	var filterDisplay, filterPattern string

	switch ext {
	case "json":
		if isAr {
			filterDisplay = "ملف بيانات مفصل JSON (*.json)"
		} else {
			filterDisplay = "Detailed JSON Telemetry (*.json)"
		}
		filterPattern = "*.json"
		b, err := BuildDetailedJSONReport(snap, lang)
		if err != nil {
			return "", err
		}
		content = b

	case "csv":
		if isAr {
			filterDisplay = "جدول بيانات إكسل مفصل CSV (*.csv)"
		} else {
			filterDisplay = "Detailed CSV Spreadsheet (*.csv)"
		}
		filterPattern = "*.csv"
		content = []byte(BuildDetailedCSVReport(snap, lang))

	default:
		if isAr {
			filterDisplay = "تقرير رسمي قابل للطباعة والـ PDF (*.html)"
		} else {
			filterDisplay = "Official Printable PDF / HTML Report (*.html)"
		}
		filterPattern = "*.html"
		content = []byte(BuildDetailedHTMLReport(snap, lang))
	}

	if a.ctx == nil {
		return string(content), nil
	}

	dialogTitle := "Export Masar Diagnostic Report"
	if isAr {
		dialogTitle = "تصدير التقرير التشخيصي الرسمي — مسار Masar"
	}

	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           dialogTitle,
		DefaultFilename: defaultName,
		Filters: []runtime.FileFilter{
			{DisplayName: filterDisplay, Pattern: filterPattern},
		},
	})
	if err != nil {
		return "", err
	}
	if savePath == "" {
		return "", nil
	}

	if err := os.WriteFile(savePath, content, 0644); err != nil {
		return "", fmt.Errorf("failed to write report: %w", err)
	}

	return savePath, nil
}

// RunDNSLookup resolves DNS records for a domain or reverse PTR for an IP.
func (a *App) RunDNSLookup(target string) (nettools.DNSReport, error) {
	return nettools.LookupDNS(target)
}

// RunPortScan scans common or custom TCP ports on a target host.
func (a *App) RunPortScan(host string, ports []int) (nettools.PortScanReport, error) {
	return nettools.ScanPorts(host, ports)
}

// RunSpeedBenchmark runs a one-shot speed benchmark for backward compatibility.
func (a *App) RunSpeedBenchmark() (nettools.SpeedReport, error) {
	return nettools.RunSpeedBenchmark()
}

// FormatSupportReport builds an aligned plain-text diagnostic report from a TraceSnapshot.
func FormatSupportReport(snap mtr.TraceSnapshot) string {
	return BuildDetailedSupportReport(snap, "en")
}

// FormatCSVReport exports the hop telemetry and metric reference guide as a CSV table.
func FormatCSVReport(snap mtr.TraceSnapshot) string {
	return BuildDetailedCSVReport(snap, "en")
}

// FormatHTMLReport builds a self-contained, print-ready Official ISP Diagnostic Report (HTML/PDF).
func FormatHTMLReport(snap mtr.TraceSnapshot) string {
	return BuildDetailedHTMLReport(snap, "en")
}
