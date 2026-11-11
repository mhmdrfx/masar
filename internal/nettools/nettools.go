package nettools

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// DNSRecordItem represents a single resolved DNS resource record.
type DNSRecordItem struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

// DNSReport holds comprehensive DNS lookup results and timing telemetry.
type DNSReport struct {
	Target      string          `json:"target"`
	QueryTimeMs float64         `json:"queryTimeMs"`
	Records     []DNSRecordItem `json:"records"`
	CheckedAt   string          `json:"checkedAt"`
}

// PortResult represents the status and TCP handshake latency of a single port.
type PortResult struct {
	Port      int     `json:"port"`
	Service   string  `json:"service"`
	State     string  `json:"state"` // "open" | "closed"
	LatencyMs float64 `json:"latencyMs"`
}

// PortScanReport holds the results of a concurrent TCP port scan.
type PortScanReport struct {
	Host       string       `json:"host"`
	ResolvedIP string       `json:"resolvedIp"`
	OpenCount  int          `json:"openCount"`
	TotalPorts int          `json:"totalPorts"`
	DurationMs float64      `json:"durationMs"`
	Results    []PortResult `json:"results"`
}

// EdgePingItem represents HTTP/TLS response latency to a global edge provider.
type EdgePingItem struct {
	Provider  string    `json:"provider"`
	Endpoint  string    `json:"endpoint"`
	LatencyMs float64   `json:"latencyMs"`
	AvgMs     float64   `json:"avgMs"`
	BestMs    float64   `json:"bestMs"`
	History   []float64 `json:"history"`
	Status    string    `json:"status"`
}

// SpeedSnapshot holds telemetry for the staged Speed & Edge Benchmark.
type SpeedSnapshot struct {
	Running           bool           `json:"running"`
	Completed         bool           `json:"completed"`
	Progress          int            `json:"progress"` // 0 to 100%
	Phase             string         `json:"phase"`    // "idle" | "ping" | "download" | "upload" | "complete"
	DownloadMbps      float64        `json:"downloadMbps"`
	PeakDownloadMbps  float64        `json:"peakDownloadMbps"`
	FinalDownloadMbps float64        `json:"finalDownloadMbps"`
	UploadMbps        float64        `json:"uploadMbps"`
	PeakUploadMbps    float64        `json:"peakUploadMbps"`
	FinalUploadMbps   float64        `json:"finalUploadMbps"`
	PingMs            float64        `json:"pingMs"`
	BestPingMs        float64        `json:"bestPingMs"`
	LoadedPingMs      float64        `json:"loadedPingMs"`
	JitterMs          float64        `json:"jitterMs"`
	TotalMB           float64        `json:"totalMB"`
	DownloadHistory   []float64      `json:"downloadHistory"`
	UploadHistory     []float64      `json:"uploadHistory"`
	PingHistory       []float64      `json:"pingHistory"`
	EdgePings         []EdgePingItem `json:"edgePings"`
	UpdatedAt         string         `json:"updatedAt"`
}

// SpeedReport is kept for backward compatibility with single-shot calls.
type SpeedReport = SpeedSnapshot

var commonPortServices = map[int]string{
	21:    "FTP",
	22:    "SSH",
	25:    "SMTP",
	53:    "DNS",
	80:    "HTTP",
	110:   "POP3",
	143:   "IMAP",
	443:   "HTTPS",
	445:   "SMB",
	993:   "IMAPS",
	995:   "POP3S",
	1433:  "MSSQL",
	3306:  "MySQL",
	3389:  "RDP",
	5432:  "PostgreSQL",
	6379:  "Redis",
	8080:  "HTTP-Alt",
	8443:  "HTTPS-Alt",
	27017: "MongoDB",
}

// DefaultScanPorts returns the standard IT diagnostic TCP port list.
func DefaultScanPorts() []int {
	return []int{21, 22, 25, 53, 80, 110, 143, 443, 445, 993, 995, 1433, 3306, 3389, 5432, 6379, 8080, 8443}
}

// LookupDNS performs concurrent DNS lookups (A, AAAA, CNAME, MX, NS, TXT, PTR).
func LookupDNS(rawTarget string) (DNSReport, error) {
	target := strings.TrimSpace(rawTarget)
	target = strings.TrimPrefix(target, "https://")
	target = strings.TrimPrefix(target, "http://")
	if idx := strings.IndexByte(target, '/'); idx != -1 {
		target = target[:idx]
	}
	// Strip port if user accidentally entered host:port
	if h, _, err := net.SplitHostPort(target); err == nil {
		target = h
	}
	target = strings.TrimSpace(target)
	if target == "" {
		return DNSReport{}, errors.New("please enter a valid domain name or IP address")
	}

	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()

	var mu sync.Mutex
	records := make([]DNSRecordItem, 0, 16)
	addRec := func(t, v string) {
		mu.Lock()
		records = append(records, DNSRecordItem{Type: t, Value: v})
		mu.Unlock()
	}

	if parsedIP := net.ParseIP(target); parsedIP != nil {
		names, err := net.DefaultResolver.LookupAddr(ctx, target)
		if err == nil {
			for _, n := range names {
				addRec("PTR", strings.TrimSuffix(n, "."))
			}
		}
	} else {
		var wg sync.WaitGroup

		wg.Add(1)
		go func() {
			defer wg.Done()
			ips, err := net.DefaultResolver.LookupIPAddr(ctx, target)
			if err == nil {
				for _, ip := range ips {
					if ip.IP.To4() != nil {
						addRec("A", ip.IP.String())
					} else {
						addRec("AAAA", ip.IP.String())
					}
				}
			}
		}()

		wg.Add(1)
		go func() {
			defer wg.Done()
			cname, err := net.DefaultResolver.LookupCNAME(ctx, target)
			if err == nil && cname != "" && strings.TrimSuffix(cname, ".") != target {
				addRec("CNAME", strings.TrimSuffix(cname, "."))
			}
		}()

		wg.Add(1)
		go func() {
			defer wg.Done()
			mxs, err := net.DefaultResolver.LookupMX(ctx, target)
			if err == nil {
				for _, mx := range mxs {
					addRec("MX", fmt.Sprintf("%d %s", mx.Pref, strings.TrimSuffix(mx.Host, ".")))
				}
			}
		}()

		wg.Add(1)
		go func() {
			defer wg.Done()
			nss, err := net.DefaultResolver.LookupNS(ctx, target)
			if err == nil {
				for _, ns := range nss {
					addRec("NS", strings.TrimSuffix(ns.Host, "."))
				}
			}
		}()

		wg.Add(1)
		go func() {
			defer wg.Done()
			txts, err := net.DefaultResolver.LookupTXT(ctx, target)
			if err == nil {
				for _, txt := range txts {
					addRec("TXT", txt)
				}
			}
		}()

		wg.Wait()
	}

	elapsedMs := float64(time.Since(start).Microseconds()) / 1000.0
	sort.Slice(records, func(i, j int) bool {
		if records[i].Type == records[j].Type {
			return records[i].Value < records[j].Value
		}
		return records[i].Type < records[j].Type
	})

	return DNSReport{
		Target:      target,
		QueryTimeMs: round1(elapsedMs),
		Records:     records,
		CheckedAt:   time.Now().Format("15:04:05"),
	}, nil
}

// ScanPorts concurrently probes TCP ports on host and measures connection handshake latency.
func ScanPorts(rawHost string, ports []int) (PortScanReport, error) {
	host := strings.TrimSpace(rawHost)
	host = strings.TrimPrefix(host, "https://")
	host = strings.TrimPrefix(host, "http://")
	if idx := strings.IndexByte(host, '/'); idx != -1 {
		host = host[:idx]
	}
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	host = strings.TrimSpace(host)
	if host == "" {
		return PortScanReport{}, errors.New("please enter a valid host or IPv4 address")
	}
	if len(ports) == 0 {
		ports = DefaultScanPorts()
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	resolvedIP := host
	if net.ParseIP(host) == nil {
		addrs, err := net.DefaultResolver.LookupIPAddr(ctx, host)
		if err != nil || len(addrs) == 0 {
			return PortScanReport{}, fmt.Errorf("failed to resolve host %q", host)
		}
		resolvedIP = addrs[0].IP.String()
	}

	start := time.Now()
	results := make([]PortResult, len(ports))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 20)

	for i, p := range ports {
		wg.Add(1)
		go func(idx, port int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			svc := commonPortServices[port]
			if svc == "" {
				svc = "TCP"
			}

			t0 := time.Now()
			addr := net.JoinHostPort(resolvedIP, fmt.Sprintf("%d", port))
			conn, err := net.DialTimeout("tcp", addr, 850*time.Millisecond)
			if err == nil {
				_ = conn.Close()
				rtt := float64(time.Since(t0).Microseconds()) / 1000.0
				results[idx] = PortResult{
					Port:      port,
					Service:   svc,
					State:     "open",
					LatencyMs: round1(rtt),
				}
			} else {
				results[idx] = PortResult{
					Port:      port,
					Service:   svc,
					State:     "closed",
					LatencyMs: 0,
				}
			}
		}(i, p)
	}

	wg.Wait()

	openCount := 0
	for _, r := range results {
		if r.State == "open" {
			openCount++
		}
	}

	return PortScanReport{
		Host:       host,
		ResolvedIP: resolvedIP,
		OpenCount:  openCount,
		TotalPorts: len(results),
		DurationMs: round1(float64(time.Since(start).Microseconds()) / 1000.0),
		Results:    results,
	}, nil
}

type edgeStatInternal struct {
	provider string
	endpoint string
	lastMs   float64
	sumMs    float64
	bestMs   float64
	count    int
	history  []float64
	status   string
}

// meteredUploadReader streams bytes while atomically counting every byte sent to the socket.
type meteredUploadReader struct {
	ctx     context.Context
	counter *atomic.Int64
	total   *atomic.Int64
	remain  int64
}

func (r *meteredUploadReader) Read(p []byte) (int, error) {
	select {
	case <-r.ctx.Done():
		return 0, r.ctx.Err()
	default:
	}
	if r.remain <= 0 {
		return 0, io.EOF
	}
	n := len(p)
	if int64(n) > r.remain {
		n = int(r.remain)
	}
	for i := 0; i < n; i++ {
		p[i] = 'M'
	}
	r.remain -= int64(n)
	r.counter.Add(int64(n))
	r.total.Add(int64(n))
	return n, nil
}

// RunLiveSpeedBenchmark continuously measures multi-stream Download Mbps, Upload Mbps, Ping, Jitter,
// and 4 global Anycast edge latencies in real time until ctx is cancelled.
func RunLiveSpeedBenchmark(ctx context.Context, onUpdate func(SpeedSnapshot)) {
	edgeDefs := []struct {
		provider string
		endpoint string
	}{
		{"Cloudflare Anycast Edge", "1.1.1.1:443"},
		{"Google Public Edge", "8.8.8.8:443"},
		{"Quad9 Security Edge", "9.9.9.9:443"},
		{"OpenDNS / Cisco Edge", "208.67.222.222:443"},
	}

	var mu sync.Mutex
	edges := make([]*edgeStatInternal, len(edgeDefs))
	for i, d := range edgeDefs {
		edges[i] = &edgeStatInternal{
			provider: d.provider,
			endpoint: d.endpoint,
			status:   "probing",
			history:  make([]float64, 0, 40),
		}
	}

	var (
		phase             = "ping"
		completed         = false
		progress          = 3
		downloadMbps      float64
		peakDownloadMbps  float64
		finalDownloadMbps float64
		uploadMbps        float64
		peakUploadMbps    float64
		finalUploadMbps   float64
		pingMs            float64
		bestPingMs        float64
		loadedPingMs      float64
		prevPingMs        float64
		jitterSumMs       float64
		jitterCount       int
		downHistory       = make([]float64, 0, 80)
		upHistory         = make([]float64, 0, 80)
		pingHistory       = make([]float64, 0, 80)
		totalBytes        atomic.Int64
	)

	buildSnapshot := func() SpeedSnapshot {
		mu.Lock()
		defer mu.Unlock()

		edgeItems := make([]EdgePingItem, len(edges))
		for i, e := range edges {
			avg := 0.0
			if e.count > 0 {
				avg = e.sumMs / float64(e.count)
			}
			hCopy := make([]float64, len(e.history))
			copy(hCopy, e.history)
			edgeItems[i] = EdgePingItem{
				Provider:  e.provider,
				Endpoint:  e.endpoint,
				LatencyMs: round1(e.lastMs),
				AvgMs:     round1(avg),
				BestMs:    round1(e.bestMs),
				History:   hCopy,
				Status:    e.status,
			}
		}

		dCopy := make([]float64, len(downHistory))
		copy(dCopy, downHistory)
		uCopy := make([]float64, len(upHistory))
		copy(uCopy, upHistory)
		pCopy := make([]float64, len(pingHistory))
		copy(pCopy, pingHistory)

		jitter := 0.0
		if jitterCount > 0 {
			jitter = jitterSumMs / float64(jitterCount)
		}

		return SpeedSnapshot{
			Running:           ctx.Err() == nil && !completed,
			Completed:         completed,
			Progress:          progress,
			Phase:             phase,
			DownloadMbps:      round1(downloadMbps),
			PeakDownloadMbps:  round1(peakDownloadMbps),
			FinalDownloadMbps: round1(finalDownloadMbps),
			UploadMbps:        round1(uploadMbps),
			PeakUploadMbps:    round1(peakUploadMbps),
			FinalUploadMbps:   round1(finalUploadMbps),
			PingMs:            round1(pingMs),
			BestPingMs:        round1(bestPingMs),
			LoadedPingMs:      round1(loadedPingMs),
			JitterMs:          round1(jitter),
			TotalMB:           round1(float64(totalBytes.Load()) / (1024.0 * 1024.0)),
			DownloadHistory:   dCopy,
			UploadHistory:     uCopy,
			PingHistory:       pCopy,
			EdgePings:         edgeItems,
			UpdatedAt:         time.Now().Format("15:04:05"),
		}
	}

	emit := func() {
		if onUpdate != nil && ctx.Err() == nil {
			onUpdate(buildSnapshot())
		}
	}

	probeEdges := func() {
		var wg sync.WaitGroup
		for i := range edges {
			wg.Add(1)
			go func(idx int) {
				defer wg.Done()
				mu.Lock()
				ep := edges[idx].endpoint
				mu.Unlock()

				dialer := &net.Dialer{Timeout: 1400 * time.Millisecond}
				t0 := time.Now()
				conn, err := dialer.DialContext(ctx, "tcp", ep)
				if err == nil {
					_ = conn.Close()
					rtt := float64(time.Since(t0).Microseconds()) / 1000.0

					mu.Lock()
					e := edges[idx]
					e.lastMs = rtt
					e.sumMs += rtt
					e.count++
					if e.count == 1 || rtt < e.bestMs {
						e.bestMs = rtt
					}
					e.status = "online"
					e.history = append(e.history, round1(rtt))
					if len(e.history) > 40 {
						e.history = e.history[len(e.history)-40:]
					}

					// Use fastest responding primary edge to update headline Ping & Jitter
					if idx == 0 || (pingMs == 0 && rtt > 0) {
						pingMs = rtt
						if bestPingMs == 0 || rtt < bestPingMs {
							bestPingMs = rtt
						}
						if prevPingMs > 0 {
							jitterSumMs += math.Abs(rtt - prevPingMs)
							jitterCount++
						}
						prevPingMs = rtt
						pingHistory = append(pingHistory, round1(rtt))
						if len(pingHistory) > 60 {
							pingHistory = pingHistory[len(pingHistory)-60:]
						}
					}
					mu.Unlock()
				} else if ctx.Err() == nil {
					mu.Lock()
					edges[idx].status = "timeout"
					mu.Unlock()
				}
			}(i)
		}
		wg.Wait()
	}

	probeFastestEdge := func() float64 {
		dialer := &net.Dialer{Timeout: 1000 * time.Millisecond}
		t0 := time.Now()
		conn, err := dialer.DialContext(ctx, "tcp", "1.1.1.1:443")
		if err == nil {
			_ = conn.Close()
			return float64(time.Since(t0).Microseconds()) / 1000.0
		}
		return 0
	}

	// ------------------------------------------------------------------
	// STAGE 1: Deep Ping & Jitter Evaluation (~2.0s)
	// ------------------------------------------------------------------
	phase = "ping"
	progress = 3
	probeEdges()
	emit()

	for r := 0; r < 3; r++ {
		select {
		case <-ctx.Done():
			return
		case <-time.After(600 * time.Millisecond):
			probeEdges()
			progress = 3 + (r+1)*2
			emit()
		}
	}
	progress = 10
	emit()

	// ------------------------------------------------------------------
	// STAGE 2: Multi-Stream Download Phase (10.0s Full Saturation)
	// ------------------------------------------------------------------
	phase = "download"
	emit()

	downCtx, cancelDown := context.WithCancel(ctx)
	defer cancelDown()

	downTransport := &http.Transport{
		Proxy:               http.ProxyFromEnvironment,
		MaxIdleConns:        64,
		MaxIdleConnsPerHost: 32,
		DisableCompression:  true,
		ForceAttemptHTTP2:   true,
		ReadBufferSize:      256 * 1024,
	}
	defer downTransport.CloseIdleConnections()
	downClient := &http.Client{Transport: downTransport}

	// Large 25MB - 50MB payload chunks to fully saturate multi-gigabit connections
	downloadURLs := []string{
		"https://speed.cloudflare.com/__down?bytes=50000000",
		"https://speed.cloudflare.com/__down?bytes=25000000",
	}

	var downWindowBytes atomic.Int64
	var downWg sync.WaitGroup
	const numDownStreams = 8 // 8 concurrent streams matching Ookla / Fast.com standard

	for s := 0; s < numDownStreams; s++ {
		downWg.Add(1)
		go func(streamIdx int) {
			defer downWg.Done()
			// High-performance 256KB read buffer to minimize syscall overhead at gigabit speeds
			buf := make([]byte, 256*1024)
			for downCtx.Err() == nil {
				targetURL := fmt.Sprintf("%s&r=%d_%d", downloadURLs[streamIdx%len(downloadURLs)], streamIdx, time.Now().UnixNano())
				req, err := http.NewRequestWithContext(downCtx, http.MethodGet, targetURL, nil)
				if err != nil {
					return
				}
				req.Header.Set("Cache-Control", "no-store")
				resp, err := downClient.Do(req)
				if err != nil {
					select {
					case <-downCtx.Done():
						return
					case <-time.After(120 * time.Millisecond):
						continue
					}
				}
				for downCtx.Err() == nil {
					n, rErr := resp.Body.Read(buf)
					if n > 0 {
						downWindowBytes.Add(int64(n))
						totalBytes.Add(int64(n))
					}
					if rErr != nil {
						break
					}
				}
				_ = resp.Body.Close()
			}
		}(s)
	}

	downSamples := make([]float64, 0, 45)
	downTicker := time.NewTicker(250 * time.Millisecond)
	defer downTicker.Stop()

	lastSampleTime := time.Now()
	var lastDownBytes int64
	var emaDownMbps float64
	const downTotalSteps = 40 // 40 * 250ms = 10.0 seconds full saturation

	for step := 1; step <= downTotalSteps; step++ {
		select {
		case <-ctx.Done():
			cancelDown()
			downWg.Wait()
			return
		case now := <-downTicker.C:
			dt := now.Sub(lastSampleTime).Seconds()
			if dt < 0.05 {
				continue
			}
			curDown := downWindowBytes.Load()
			deltaDown := curDown - lastDownBytes
			lastDownBytes = curDown
			lastSampleTime = now

			if deltaDown > 0 {
				instDown := (float64(deltaDown) * 8.0) / (dt * 1_000_000.0)
				if emaDownMbps == 0 {
					emaDownMbps = instDown
				} else {
					emaDownMbps = emaDownMbps*0.25 + instDown*0.75
				}
				downSamples = append(downSamples, emaDownMbps)

				mu.Lock()
				downloadMbps = emaDownMbps
				if emaDownMbps > peakDownloadMbps {
					peakDownloadMbps = emaDownMbps
				}
				downHistory = append(downHistory, round1(emaDownMbps))
				if len(downHistory) > 60 {
					downHistory = downHistory[len(downHistory)-60:]
				}
				mu.Unlock()
			}

			// Measure Loaded Ping periodically under active download saturation
			if step%8 == 0 {
				go func() {
					lp := probeFastestEdge()
					if lp > 0 {
						mu.Lock()
						loadedPingMs = lp
						mu.Unlock()
					}
				}()
			}

			progress = 10 + int(float64(step)/float64(downTotalSteps)*48.0)
			emit()
		}
	}

	// Conclude download streams
	cancelDown()
	downWg.Wait()

	// Discard the initial 10 samples (first 2.5s TCP slow-start ramp-up) for true sustained line score
	finalDownloadMbps = computeBenchmarkScore(downSamples, 10)
	if finalDownloadMbps == 0 && peakDownloadMbps > 0 {
		finalDownloadMbps = peakDownloadMbps
	}
	downloadMbps = finalDownloadMbps
	progress = 58
	emit()

	// ------------------------------------------------------------------
	// STAGE 3: Multi-Stream Upload Phase (8.5s Full Saturation)
	// ------------------------------------------------------------------
	phase = "upload"
	emit()

	upCtx, cancelUp := context.WithCancel(ctx)
	defer cancelUp()

	upTransport := &http.Transport{
		Proxy:               http.ProxyFromEnvironment,
		MaxIdleConns:        48,
		MaxIdleConnsPerHost: 24,
		DisableCompression:  true,
		ForceAttemptHTTP2:   true,
		WriteBufferSize:     256 * 1024,
	}
	defer upTransport.CloseIdleConnections()
	upClient := &http.Client{Transport: upTransport}

	var upWindowBytes atomic.Int64
	var upWg sync.WaitGroup
	const numUpStreams = 5 // 5 concurrent upload streams

	for s := 0; s < numUpStreams; s++ {
		upWg.Add(1)
		go func() {
			defer upWg.Done()
			for upCtx.Err() == nil {
				reader := &meteredUploadReader{
					ctx:     upCtx,
					counter: &upWindowBytes,
					total:   &totalBytes,
					remain:  8 * 1024 * 1024, // 8 MB chunk per POST
				}
				req, err := http.NewRequestWithContext(upCtx, http.MethodPost, "https://speed.cloudflare.com/__up", reader)
				if err != nil {
					return
				}
				req.Header.Set("Content-Type", "application/octet-stream")
				resp, err := upClient.Do(req)
				if err == nil && resp != nil {
					_, _ = io.Copy(io.Discard, resp.Body)
					_ = resp.Body.Close()
				} else {
					select {
					case <-upCtx.Done():
						return
					case <-time.After(120 * time.Millisecond):
					}
				}
			}
		}()
	}

	upSamples := make([]float64, 0, 40)
	upTicker := time.NewTicker(250 * time.Millisecond)
	defer upTicker.Stop()

	lastSampleTime = time.Now()
	var lastUpBytes int64
	var emaUpMbps float64
	const upTotalSteps = 34 // 34 * 250ms = 8.5 seconds full saturation

	for step := 1; step <= upTotalSteps; step++ {
		select {
		case <-ctx.Done():
			cancelUp()
			upWg.Wait()
			return
		case now := <-upTicker.C:
			dt := now.Sub(lastSampleTime).Seconds()
			if dt < 0.05 {
				continue
			}
			curUp := upWindowBytes.Load()
			deltaUp := curUp - lastUpBytes
			lastUpBytes = curUp
			lastSampleTime = now

			if deltaUp > 0 {
				instUp := (float64(deltaUp) * 8.0) / (dt * 1_000_000.0)
				if emaUpMbps == 0 {
					emaUpMbps = instUp
				} else {
					emaUpMbps = emaUpMbps*0.25 + instUp*0.75
				}
				upSamples = append(upSamples, emaUpMbps)

				mu.Lock()
				uploadMbps = emaUpMbps
				if emaUpMbps > peakUploadMbps {
					peakUploadMbps = emaUpMbps
				}
				upHistory = append(upHistory, round1(emaUpMbps))
				if len(upHistory) > 60 {
					upHistory = upHistory[len(upHistory)-60:]
				}
				mu.Unlock()
			}

			// Measure Loaded Ping periodically under active upload saturation
			if step%8 == 0 {
				go func() {
					lp := probeFastestEdge()
					if lp > 0 {
						mu.Lock()
						loadedPingMs = lp
						mu.Unlock()
					}
				}()
			}

			progress = 58 + int(float64(step)/float64(upTotalSteps)*40.0)
			emit()
		}
	}

	// Conclude upload streams
	cancelUp()
	upWg.Wait()

	// Discard the initial 8 samples (first 2.0s upload TCP ramp-up)
	finalUploadMbps = computeBenchmarkScore(upSamples, 8)
	if finalUploadMbps == 0 && peakUploadMbps > 0 {
		finalUploadMbps = peakUploadMbps
	}
	uploadMbps = finalUploadMbps

	// Quick final edge probe to refresh matrix
	probeEdges()

	// ------------------------------------------------------------------
	// STAGE 4: Completion & Definitive Scorecard
	// ------------------------------------------------------------------
	phase = "complete"
	completed = true
	progress = 100
	emit()
}

// computeBenchmarkScore calculates the true sustained line capacity using industry-standard
// trimmed mean aggregation (Ookla/Fast.com whitepaper methodology):
// Discards initial TCP connection slow-start ramp-up samples, then trims bottom 15% (packet loss stalls)
// and top 5% (synthetic bursts) from steady-state samples.
func computeBenchmarkScore(samples []float64, discardRampCount int) float64 {
	if len(samples) == 0 {
		return 0
	}
	steady := samples
	if discardRampCount > 0 && len(samples) > discardRampCount+4 {
		steady = samples[discardRampCount:]
	}

	valid := make([]float64, 0, len(steady))
	for _, s := range steady {
		if s > 0 {
			valid = append(valid, s)
		}
	}
	if len(valid) == 0 {
		return 0
	}
	sort.Float64s(valid)

	// Trim lowest 15% and highest 5%
	startIdx := int(float64(len(valid)) * 0.15)
	endIdx := len(valid) - int(float64(len(valid))*0.05)
	if endIdx <= startIdx {
		startIdx = 0
		endIdx = len(valid)
	}

	sum := 0.0
	count := 0
	for i := startIdx; i < endIdx; i++ {
		sum += valid[i]
		count++
	}
	if count == 0 {
		return round1(valid[len(valid)-1])
	}
	return round1(sum / float64(count))
}

// RunSpeedBenchmark runs a single complete Speedtest benchmark for one-shot callers.
func RunSpeedBenchmark() (SpeedReport, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 28*time.Second)
	defer cancel()
	var last SpeedSnapshot
	RunLiveSpeedBenchmark(ctx, func(snap SpeedSnapshot) {
		last = snap
	})
	last.Running = false
	return last, nil
}

func round1(val float64) float64 {
	return math.Round(val*10) / 10
}
