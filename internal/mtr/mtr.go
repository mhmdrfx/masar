package mtr

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"syscall"
	"time"

	"golang.org/x/net/icmp"
	"golang.org/x/net/ipv4"
)

const (
	MaxHops        = 30
	PollInterval   = 1 * time.Second
	ProbeSpacing   = 5 * time.Millisecond
	PacketTimeout  = 800 * time.Millisecond
	DNSTimeout     = 1500 * time.Millisecond
	GeoTimeout     = 1800 * time.Millisecond
	MaxHistorySize = 60
	ProtocolICMP   = 1
)

// HopStat represents real-time telemetry for a single network hop (TTL).
type HopStat struct {
	Hop         int       `json:"hop"`
	IP          string    `json:"ip"`
	Hostname    string    `json:"hostname"`
	Location    string    `json:"location"`
	ASN         string    `json:"asn"`
	Sent        int       `json:"sent"`
	Received    int       `json:"received"`
	LossPercent float64   `json:"lossPercent"`
	LastMs      float64   `json:"lastMs"`
	AvgMs       float64   `json:"avgMs"`
	BestMs      float64   `json:"bestMs"`
	WorstMs     float64   `json:"worstMs"`
	JitterMs    float64   `json:"jitterMs"`
	History     []float64 `json:"history"`
	ReachedDest bool      `json:"reachedDest"`
}

// HealthReport summarizes overall route quality and identifies any bottleneck hop.
type HealthReport struct {
	Score      int    `json:"score"`
	Severity   string `json:"severity"` // "healthy" | "warning" | "critical" | "idle"
	Status     string `json:"status"`
	Detail     string `json:"detail"`
	CulpritHop int    `json:"culpritHop"`
}

// TraceSnapshot contains a point-in-time snapshot of all hops and the health evaluation.
type TraceSnapshot struct {
	Running    bool         `json:"running"`
	Target     string       `json:"target"`
	ResolvedIP string       `json:"resolvedIp"`
	UpdatedAt  string       `json:"updatedAt"`
	Hops       []HopStat    `json:"hops"`
	Health     HealthReport `json:"health"`
}

type probeRecord struct {
	ttl    int
	sentAt time.Time
}

type geoInfo struct {
	location string
	asn      string
}

const (
	positiveCacheTTL      = 30 * time.Minute
	negativeCacheCooldown = 45 * time.Second
	maxSharedCacheEntries = 1024
)

type cachedDNSRecord struct {
	hostname  string
	expiresAt time.Time
}

type cachedGeoRecord struct {
	info      geoInfo
	expiresAt time.Time
}

var (
	sharedMetaMu     sync.RWMutex
	sharedDNS        = make(map[string]cachedDNSRecord)
	sharedDNSWaiters = make(map[string][]*Engine)
	sharedGeo        = make(map[string]cachedGeoRecord)
	sharedGeoWaiters = make(map[string][]*Engine)
	geoHTTPClient    = &http.Client{
		Timeout: GeoTimeout,
		Transport: &http.Transport{
			Proxy:               http.ProxyFromEnvironment,
			MaxIdleConns:        8,
			MaxIdleConnsPerHost: 4,
		},
	}
)

type hopInternal struct {
	hop         int
	ip          string
	sent        int
	received    int
	lastMs      float64
	sumMs       float64
	bestMs      float64
	worstMs     float64
	prevRttMs   float64
	jitterSumMs float64
	jitterCount int
	history     []float64
	reachedDest bool
}

// Engine manages raw ICMPv4 probing, response correlation, and non-blocking DNS + GeoIP resolution.
type Engine struct {
	target     string
	destIP     net.IP
	icmpID     int
	mu         sync.RWMutex
	hops       map[int]*hopInternal
	inFlight   map[uint16]probeRecord
	seqCounter uint16
	maxDestTTL int

	onUpdate func(TraceSnapshot)
}

// NewEngine creates a new MTR Engine targeting a hostname or IPv4 address.
func NewEngine(target string, onUpdate func(TraceSnapshot)) (*Engine, error) {
	cleanTarget := strings.TrimSpace(target)
	if cleanTarget == "" {
		return nil, errors.New("target host or IP cannot be empty")
	}

	destIP, err := resolveIPv4(cleanTarget)
	if err != nil {
		return nil, err
	}

	id := (os.Getpid() ^ int(time.Now().UnixNano()&0xffff)) & 0xffff
	if id == 0 {
		id = 0x4d53 // "MS" for Masar
	}

	hops := make(map[int]*hopInternal, MaxHops)
	for ttl := 1; ttl <= MaxHops; ttl++ {
		hops[ttl] = &hopInternal{
			hop:     ttl,
			history: make([]float64, 0, MaxHistorySize),
		}
	}

	return &Engine{
		target:     cleanTarget,
		destIP:     destIP,
		icmpID:     id,
		hops:       hops,
		inFlight:   make(map[uint16]probeRecord),
		maxDestTTL: MaxHops,
		onUpdate:   onUpdate,
	}, nil
}

func resolveIPv4(host string) (net.IP, error) {
	if ip := net.ParseIP(host); ip != nil {
		ip4 := ip.To4()
		if ip4 == nil {
			return nil, fmt.Errorf("target %q is IPv6; Masar requires an IPv4 target", host)
		}
		return ip4, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	addrs, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve host %q: %w", host, err)
	}
	for _, addr := range addrs {
		if ip4 := addr.IP.To4(); ip4 != nil {
			return ip4, nil
		}
	}
	return nil, fmt.Errorf("no IPv4 address found for %q", host)
}

func isPermissionError(err error) bool {
	if err == nil {
		return false
	}
	if os.IsPermission(err) || errors.Is(err, syscall.EACCES) || errors.Is(err, syscall.EPERM) {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "permission") ||
		strings.Contains(msg, "access is denied") ||
		strings.Contains(msg, "operation not permitted") ||
		strings.Contains(msg, "wsaeacces") ||
		strings.Contains(msg, "10013")
}

// Run opens a raw ICMPv4 socket and continuously probes all hops until ctx is cancelled.
func (e *Engine) Run(ctx context.Context) error {
	conn, err := icmp.ListenPacket("ip4:icmp", "0.0.0.0")
	if err != nil {
		if isPermissionError(err) {
			return fmt.Errorf("raw ICMP socket requires elevated privileges (Run as Administrator on Windows or root / CAP_NET_RAW on Linux/macOS): %w", err)
		}
		return fmt.Errorf("failed to open raw ICMPv4 socket: %w", err)
	}
	defer conn.Close()

	p4 := conn.IPv4PacketConn()
	if p4 == nil {
		return errors.New("failed to initialize IPv4 packet connection wrapper")
	}

	recvDone := make(chan struct{})
	go func() {
		defer close(recvDone)
		e.receiveLoop(ctx, conn)
	}()

	e.sendSweep(ctx, conn, p4)
	e.emitSnapshot()

	pollTicker := time.NewTicker(PollInterval)
	defer pollTicker.Stop()

	reapTicker := time.NewTicker(200 * time.Millisecond)
	defer reapTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			_ = conn.SetReadDeadline(time.Now())
			_ = conn.Close()
			<-recvDone
			return nil
		case <-reapTicker.C:
			if e.reapTimeouts() {
				e.emitSnapshot()
			}
		case <-pollTicker.C:
			e.reapTimeouts()
			e.sendSweep(ctx, conn, p4)
			e.emitSnapshot()
		}
	}
}

func (e *Engine) sendSweep(ctx context.Context, conn *icmp.PacketConn, p4 *ipv4.PacketConn) {
	e.mu.RLock()
	limitTTL := e.maxDestTTL
	e.mu.RUnlock()

	dst := &net.IPAddr{IP: e.destIP}

	for ttl := 1; ttl <= limitTTL; ttl++ {
		select {
		case <-ctx.Done():
			return
		default:
		}

		e.mu.Lock()
		e.seqCounter++
		seq := e.seqCounter
		now := time.Now()
		e.inFlight[seq] = probeRecord{
			ttl:    ttl,
			sentAt: now,
		}
		if h, ok := e.hops[ttl]; ok {
			h.sent++
		}
		e.mu.Unlock()

		if err := p4.SetTTL(ttl); err != nil {
			continue
		}

		payload := make([]byte, 32)
		binary.BigEndian.PutUint64(payload[0:8], uint64(now.UnixNano()))

		msg := icmp.Message{
			Type: ipv4.ICMPTypeEcho,
			Code: 0,
			Body: &icmp.Echo{
				ID:   e.icmpID,
				Seq:  int(seq),
				Data: payload,
			},
		}

		wire, err := msg.Marshal(nil)
		if err != nil {
			continue
		}

		_ = conn.SetWriteDeadline(time.Now().Add(100 * time.Millisecond))
		_, _ = conn.WriteTo(wire, dst)

		if ttl < limitTTL {
			select {
			case <-ctx.Done():
				return
			case <-time.After(ProbeSpacing):
			}
		}
	}
}

func (e *Engine) receiveLoop(ctx context.Context, conn *icmp.PacketConn) {
	buf := make([]byte, 1500)
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		_ = conn.SetReadDeadline(time.Now().Add(250 * time.Millisecond))
		n, peer, err := conn.ReadFrom(buf)
		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				continue
			}
			select {
			case <-ctx.Done():
				return
			default:
				continue
			}
		}

		recvTime := time.Now()
		peerIP := extractPeerIP(peer)

		msg, err := icmp.ParseMessage(ProtocolICMP, buf[:n])
		if err != nil {
			continue
		}

		switch msg.Type {
		case ipv4.ICMPTypeEchoReply:
			echo, ok := msg.Body.(*icmp.Echo)
			if !ok || echo.ID != e.icmpID {
				continue
			}
			seq := uint16(echo.Seq)
			if e.recordReply(seq, peerIP, recvTime, true) {
				e.emitSnapshot()
			}

		case ipv4.ICMPTypeTimeExceeded:
			body, ok := msg.Body.(*icmp.TimeExceeded)
			if !ok {
				continue
			}
			id, seq, ok := extractQuotedICMP(body.Data)
			if !ok || id != e.icmpID {
				continue
			}
			if e.recordReply(seq, peerIP, recvTime, false) {
				e.emitSnapshot()
			}

		case ipv4.ICMPTypeDestinationUnreachable:
			body, ok := msg.Body.(*icmp.DstUnreach)
			if !ok {
				continue
			}
			id, seq, ok := extractQuotedICMP(body.Data)
			if !ok || id != e.icmpID {
				continue
			}
			if e.recordReply(seq, peerIP, recvTime, peerIP == e.destIP.String()) {
				e.emitSnapshot()
			}
		}
	}
}

func extractQuotedICMP(data []byte) (int, uint16, bool) {
	if len(data) < 20 {
		return 0, 0, false
	}
	ihl := int(data[0]&0x0f) * 4
	if ihl < 20 || len(data) < ihl+8 {
		return 0, 0, false
	}
	innerICMP := data[ihl : ihl+8]
	id := int(binary.BigEndian.Uint16(innerICMP[4:6]))
	seq := binary.BigEndian.Uint16(innerICMP[6:8])
	return id, seq, true
}

func extractPeerIP(addr net.Addr) string {
	if addr == nil {
		return ""
	}
	switch v := addr.(type) {
	case *net.IPAddr:
		return v.IP.String()
	case *net.UDPAddr:
		return v.IP.String()
	default:
		host, _, err := net.SplitHostPort(addr.String())
		if err == nil {
			return host
		}
		return addr.String()
	}
}

func (e *Engine) recordReply(seq uint16, peerIP string, recvTime time.Time, isDest bool) bool {
	e.mu.Lock()
	probe, exists := e.inFlight[seq]
	if !exists {
		e.mu.Unlock()
		return false
	}
	delete(e.inFlight, seq)

	rttMs := float64(recvTime.Sub(probe.sentAt).Microseconds()) / 1000.0
	if rttMs < 0.05 {
		rttMs = 0.05
	}

	h, ok := e.hops[probe.ttl]
	if !ok {
		e.mu.Unlock()
		return false
	}

	h.ip = peerIP
	h.received++
	h.lastMs = rttMs
	h.sumMs += rttMs

	if h.received == 1 || rttMs < h.bestMs {
		h.bestMs = rttMs
	}
	if h.received == 1 || rttMs > h.worstMs {
		h.worstMs = rttMs
	}
	if h.received > 1 {
		delta := math.Abs(rttMs - h.prevRttMs)
		h.jitterSumMs += delta
		h.jitterCount++
	}
	h.prevRttMs = rttMs

	h.history = append(h.history, round1(rttMs))
	if len(h.history) > MaxHistorySize {
		h.history = h.history[len(h.history)-MaxHistorySize:]
	}

	if isDest || peerIP == e.destIP.String() {
		h.reachedDest = true
		if probe.ttl < e.maxDestTTL {
			e.maxDestTTL = probe.ttl
		}
	}
	e.mu.Unlock()

	if peerIP != "" {
		e.triggerAsyncDNS(peerIP)
		e.triggerAsyncGeo(peerIP)
	}
	return true
}

func (e *Engine) reapTimeouts() bool {
	now := time.Now()
	expiredAny := false

	e.mu.Lock()
	for seq, probe := range e.inFlight {
		if now.Sub(probe.sentAt) > PacketTimeout {
			delete(e.inFlight, seq)
			expiredAny = true
		}
	}
	e.mu.Unlock()

	return expiredAny
}

func addEngineWaiter(waiters []*Engine, eng *Engine) []*Engine {
	for _, w := range waiters {
		if w == eng {
			return waiters
		}
	}
	return append(waiters, eng)
}

func (e *Engine) triggerAsyncDNS(ip string) {
	now := time.Now()
	sharedMetaMu.Lock()
	if rec, cached := sharedDNS[ip]; cached && now.Before(rec.expiresAt) {
		sharedMetaMu.Unlock()
		return
	}
	if waiters, pending := sharedDNSWaiters[ip]; pending {
		sharedDNSWaiters[ip] = addEngineWaiter(waiters, e)
		sharedMetaMu.Unlock()
		return
	}
	sharedDNSWaiters[ip] = []*Engine{e}
	sharedMetaMu.Unlock()

	go func(addr string) {
		ctx, cancel := context.WithTimeout(context.Background(), DNSTimeout)
		defer cancel()

		names, err := net.DefaultResolver.LookupAddr(ctx, addr)
		hostname := ""
		if err == nil && len(names) > 0 {
			hostname = strings.TrimSuffix(names[0], ".")
		}

		ttl := positiveCacheTTL
		if hostname == "" {
			ttl = negativeCacheCooldown
		}
		finishTime := time.Now()

		sharedMetaMu.Lock()
		waiters := sharedDNSWaiters[addr]
		delete(sharedDNSWaiters, addr)
		if len(sharedDNS) >= maxSharedCacheEntries {
			for k, v := range sharedDNS {
				if finishTime.After(v.expiresAt) {
					delete(sharedDNS, k)
				}
			}
			if len(sharedDNS) >= maxSharedCacheEntries {
				for k := range sharedDNS {
					delete(sharedDNS, k)
					break
				}
			}
		}
		sharedDNS[addr] = cachedDNSRecord{
			hostname:  hostname,
			expiresAt: finishTime.Add(ttl),
		}
		sharedMetaMu.Unlock()

		if hostname != "" {
			for _, w := range waiters {
				w.emitSnapshot()
			}
		}
	}(ip)
}

func (e *Engine) lookupCachedHostname(ip string) string {
	if ip == "" {
		return ""
	}
	sharedMetaMu.RLock()
	rec, ok := sharedDNS[ip]
	sharedMetaMu.RUnlock()
	if !ok {
		return ""
	}
	return rec.hostname
}

func classifyLocalOrWellKnownIP(ipStr string) (geoInfo, bool) {
	parsed := net.ParseIP(ipStr)
	if parsed == nil {
		return geoInfo{}, false
	}
	if parsed.IsLoopback() {
		return geoInfo{location: "Localhost", asn: "Loopback"}, true
	}
	if parsed.IsPrivate() {
		return geoInfo{location: "Local LAN / Gateway", asn: "Private RFC1918"}, true
	}
	if ip4 := parsed.To4(); ip4 != nil && ip4[0] == 100 && ip4[1] >= 64 && ip4[1] <= 127 {
		return geoInfo{location: "ISP Carrier-Grade NAT", asn: "CGNAT 100.64/10"}, true
	}

	switch ipStr {
	case "8.8.8.8", "8.8.4.4":
		return geoInfo{location: "Global Anycast • Google", asn: "AS15169 Google LLC"}, true
	case "1.1.1.1", "1.0.0.1":
		return geoInfo{location: "Global Anycast • Cloudflare", asn: "AS13335 Cloudflare"}, true
	case "9.9.9.9", "149.112.112.112":
		return geoInfo{location: "Global Anycast • Quad9", asn: "AS19281 Quad9"}, true
	}
	return geoInfo{}, false
}

func (e *Engine) triggerAsyncGeo(ip string) {
	if _, ok := classifyLocalOrWellKnownIP(ip); ok {
		return
	}

	now := time.Now()
	sharedMetaMu.Lock()
	if rec, cached := sharedGeo[ip]; cached && now.Before(rec.expiresAt) {
		sharedMetaMu.Unlock()
		return
	}
	if waiters, pending := sharedGeoWaiters[ip]; pending {
		sharedGeoWaiters[ip] = addEngineWaiter(waiters, e)
		sharedMetaMu.Unlock()
		return
	}
	sharedGeoWaiters[ip] = []*Engine{e}
	sharedMetaMu.Unlock()

	go func(addr string) {
		url := fmt.Sprintf("http://ip-api.com/json/%s?fields=status,countryCode,city,isp,as", addr)
		resp, err := geoHTTPClient.Get(url)
		info := geoInfo{}
		if err == nil && resp != nil {
			defer resp.Body.Close()
			var payload struct {
				Status      string `json:"status"`
				CountryCode string `json:"countryCode"`
				City        string `json:"city"`
				ISP         string `json:"isp"`
				AS          string `json:"as"`
			}
			if json.NewDecoder(resp.Body).Decode(&payload) == nil && payload.Status == "success" {
				locParts := make([]string, 0, 2)
				if payload.CountryCode != "" {
					locParts = append(locParts, payload.CountryCode)
				}
				if payload.City != "" {
					locParts = append(locParts, payload.City)
				}
				info.location = strings.Join(locParts, " • ")
				if payload.AS != "" {
					fields := strings.Fields(payload.AS)
					if len(fields) > 0 {
						info.asn = fields[0]
					}
					if payload.ISP != "" {
						info.asn = strings.TrimSpace(info.asn + " " + payload.ISP)
					}
				} else {
					info.asn = payload.ISP
				}
			}
		}

		hasData := info.location != "" || info.asn != ""
		ttl := positiveCacheTTL
		if !hasData {
			ttl = negativeCacheCooldown
		}
		finishTime := time.Now()

		sharedMetaMu.Lock()
		waiters := sharedGeoWaiters[addr]
		delete(sharedGeoWaiters, addr)
		if len(sharedGeo) >= maxSharedCacheEntries {
			for k, v := range sharedGeo {
				if finishTime.After(v.expiresAt) {
					delete(sharedGeo, k)
				}
			}
			if len(sharedGeo) >= maxSharedCacheEntries {
				for k := range sharedGeo {
					delete(sharedGeo, k)
					break
				}
			}
		}
		sharedGeo[addr] = cachedGeoRecord{
			info:      info,
			expiresAt: finishTime.Add(ttl),
		}
		sharedMetaMu.Unlock()

		if hasData {
			for _, w := range waiters {
				w.emitSnapshot()
			}
		}
	}(ip)
}

func (e *Engine) lookupCachedGeo(ip string) geoInfo {
	if ip == "" {
		return geoInfo{}
	}
	if info, ok := classifyLocalOrWellKnownIP(ip); ok {
		return info
	}
	sharedMetaMu.RLock()
	rec, ok := sharedGeo[ip]
	sharedMetaMu.RUnlock()
	if !ok {
		return geoInfo{}
	}
	return rec.info
}

// Snapshot builds a thread-safe TraceSnapshot and computes the Smart Health Report.
func (e *Engine) Snapshot() TraceSnapshot {
	now := time.Now()

	e.mu.RLock()
	inFlightPerTTL := make(map[int]int)
	for _, probe := range e.inFlight {
		if now.Sub(probe.sentAt) <= PacketTimeout {
			inFlightPerTTL[probe.ttl]++
		}
	}

	limitTTL := e.maxDestTTL
	highestActiveTTL := 1
	anyDownstreamResponding := false
	for ttl := 1; ttl <= limitTTL; ttl++ {
		if h, ok := e.hops[ttl]; ok && (h.sent > 0 || h.received > 0) {
			highestActiveTTL = ttl
			if h.received > 0 {
				anyDownstreamResponding = true
			}
			if h.reachedDest {
				break
			}
		}
	}

	hopsOut := make([]HopStat, 0, highestActiveTTL)
	for ttl := 1; ttl <= highestActiveTTL; ttl++ {
		h := e.hops[ttl]
		if h == nil {
			continue
		}

		effectiveSent := h.sent - inFlightPerTTL[ttl]
		if effectiveSent < h.received {
			effectiveSent = h.received
		}

		lossPct := 0.0
		// Only calculate packet loss if this hop has responded at least once,
		// OR if no downstream hop is responding at all (meaning traffic is genuinely blackholed).
		if effectiveSent > 0 && (h.received > 0 || !anyDownstreamResponding) {
			lost := effectiveSent - h.received
			if lost < 0 {
				lost = 0
			}
			lossPct = (float64(lost) / float64(effectiveSent)) * 100.0
		}

		avgMs := 0.0
		if h.received > 0 {
			avgMs = h.sumMs / float64(h.received)
		}

		jitterMs := 0.0
		if h.jitterCount > 0 {
			jitterMs = h.jitterSumMs / float64(h.jitterCount)
		}

		histCopy := make([]float64, len(h.history))
		copy(histCopy, h.history)

		geo := e.lookupCachedGeo(h.ip)

		hopsOut = append(hopsOut, HopStat{
			Hop:         h.hop,
			IP:          h.ip,
			Hostname:    e.lookupCachedHostname(h.ip),
			Location:    geo.location,
			ASN:         geo.asn,
			Sent:        effectiveSent,
			Received:    h.received,
			LossPercent: round1(lossPct),
			LastMs:      round1(h.lastMs),
			AvgMs:       round1(avgMs),
			BestMs:      round1(h.bestMs),
			WorstMs:     round1(h.worstMs),
			JitterMs:    round1(jitterMs),
			History:     histCopy,
			ReachedDest: h.reachedDest,
		})

		if h.reachedDest {
			break
		}
	}
	e.mu.RUnlock()

	health := EvaluateHealth(hopsOut)

	return TraceSnapshot{
		Running:    true,
		Target:     e.target,
		ResolvedIP: e.destIP.String(),
		UpdatedAt:  now.Format("15:04:05"),
		Hops:       hopsOut,
		Health:     health,
	}
}

func (e *Engine) emitSnapshot() {
	if e.onUpdate != nil {
		e.onUpdate(e.Snapshot())
	}
}

// EvaluateHealth analyzes local gateway, ISP aggregation hops, and the destination hop.
func EvaluateHealth(hops []HopStat) HealthReport {
	if len(hops) == 0 {
		return HealthReport{
			Score:      100,
			Severity:   "idle",
			Status:     "Initializing Network Path Discovery...",
			Detail:     "Sending ICMP probes across hops to analyze local router, ISP gateway, and target latency.",
			CulpritHop: 0,
		}
	}

	var hop1 *HopStat
	var hop2 *HopStat
	var hop3 *HopStat
	var finalHop *HopStat

	for i := range hops {
		h := &hops[i]
		switch h.Hop {
		case 1:
			hop1 = h
		case 2:
			hop2 = h
		case 3:
			hop3 = h
		}
		if h.Received > 0 || i == len(hops)-1 {
			finalHop = h
		}
	}

	totalCompleted := 0
	for _, h := range hops {
		totalCompleted += h.Sent
	}
	if totalCompleted == 0 {
		return HealthReport{
			Score:      100,
			Severity:   "idle",
			Status:     "Measuring Network Path...",
			Detail:     "Awaiting initial ICMP Echo & Time Exceeded responses.",
			CulpritHop: 0,
		}
	}

	// Check local gateway (Hop 1) when it replies to ICMP or when all downstream hops time out.
	if hop1 != nil && hop1.Sent > 0 && (hop1.Received > 0 || (finalHop != nil && finalHop.Received == 0)) {
		hop1Loss := hop1.LossPercent
		hop1Avg := hop1.AvgMs
		if hop1Loss > 2.0 || hop1Avg > 25.0 {
			score := computeScore(hop1Loss, hop1Avg, hop1.JitterMs)
			severity := "warning"
			if hop1Loss > 5.0 || hop1Avg > 60.0 || score < 65 {
				severity = "critical"
			}
			return HealthReport{
				Score:      score,
				Severity:   severity,
				Status:     "Issue detected in Local Network / Wi-Fi",
				Detail:     fmt.Sprintf("Hop 1 (%s) shows %.1f%% packet loss and %.1f ms avg latency. Check your Wi-Fi signal strength, Ethernet cable, or local router.", fallbackIP(hop1.IP), hop1Loss, hop1Avg),
				CulpritHop: 1,
			}
		}
	}

	// Check ISP gateway hops (Hops 2-3).
	ispCandidates := []*HopStat{hop2, hop3}
	for _, ispHop := range ispCandidates {
		if ispHop == nil || ispHop.Sent == 0 || ispHop.Received == 0 {
			continue
		}
		if ispHop.LossPercent > 2.0 || ispHop.AvgMs > 75.0 {
			score := computeScore(ispHop.LossPercent, ispHop.AvgMs, ispHop.JitterMs)
			severity := "warning"
			if ispHop.LossPercent > 5.0 || ispHop.AvgMs > 130.0 || score < 65 {
				severity = "critical"
			}
			return HealthReport{
				Score:      score,
				Severity:   severity,
				Status:     "Issue detected at ISP / Backbone",
				Detail:     fmt.Sprintf("Your local router (Hop 1) is clean, but Hop %d (%s) exhibits %.1f%% packet loss and %.1f ms average latency. Share the Support Summary with your ISP.", ispHop.Hop, fallbackIP(ispHop.IP), ispHop.LossPercent, ispHop.AvgMs),
				CulpritHop: ispHop.Hop,
			}
		}
	}

	// Check downstream transit or target destination.
	if finalHop != nil && finalHop.Sent > 0 {
		if finalHop.LossPercent > 2.0 || finalHop.AvgMs > 150.0 {
			score := computeScore(finalHop.LossPercent, finalHop.AvgMs, finalHop.JitterMs)
			severity := "warning"
			if finalHop.LossPercent > 5.0 || finalHop.AvgMs > 250.0 || score < 65 {
				severity = "critical"
			}
			return HealthReport{
				Score:      score,
				Severity:   severity,
				Status:     "Degradation detected on Downstream Transit / Target",
				Detail:     fmt.Sprintf("Local network and ISP gateway are stable, but Hop %d (%s) reports %.1f%% loss and %.1f ms latency.", finalHop.Hop, fallbackIP(finalHop.IP), finalHop.LossPercent, finalHop.AvgMs),
				CulpritHop: finalHop.Hop,
			}
		}
	}

	refLoss := 0.0
	refAvg := 10.0
	refJitter := 1.0
	if finalHop != nil && finalHop.Received > 0 {
		refLoss = finalHop.LossPercent
		refAvg = finalHop.AvgMs
		refJitter = finalHop.JitterMs
	}
	score := computeScore(refLoss, refAvg, refJitter)
	if score < 85 {
		score = 88
	}

	detail := "Zero significant packet loss across local router and ISP gateway hops."
	if finalHop != nil && finalHop.Received > 0 {
		detail = fmt.Sprintf("End-to-end latency to %s is %.1f ms (jitter %.1f ms, loss %.1f%%).", fallbackIP(finalHop.IP), finalHop.AvgMs, finalHop.JitterMs, finalHop.LossPercent)
	}

	return HealthReport{
		Score:      score,
		Severity:   "healthy",
		Status:     "Connection is Healthy — Optimal Path Performance",
		Detail:     detail,
		CulpritHop: 0,
	}
}

func computeScore(lossPct, avgMs, jitterMs float64) int {
	penalty := (lossPct * 4.5) + math.Max(0, (avgMs-20.0)*0.35) + math.Max(0, (jitterMs-5.0)*0.8)
	raw := int(math.Round(100.0 - penalty))
	if raw > 100 {
		return 100
	}
	if raw < 5 {
		return 5
	}
	return raw
}

func fallbackIP(ip string) string {
	if ip == "" {
		return "* * * (Request Timed Out)"
	}
	return ip
}

func round1(val float64) float64 {
	return math.Round(val*10) / 10
}
