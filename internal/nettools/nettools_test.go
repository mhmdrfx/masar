package nettools

import (
	"context"
	"errors"
	"io"
	"net"
	"sync/atomic"
	"testing"
)

func TestDefaultScanPortsValid(t *testing.T) {
	ports := DefaultScanPorts()
	if len(ports) == 0 {
		t.Fatalf("DefaultScanPorts returned empty slice")
	}
	for _, p := range ports {
		if p < 1 || p > 65535 {
			t.Errorf("invalid TCP port %d in DefaultScanPorts", p)
		}
	}
}

func TestMeteredUploadReaderCountingAndCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var winCounter, totalCounter atomic.Int64
	reader := &meteredUploadReader{
		ctx:     ctx,
		counter: &winCounter,
		total:   &totalCounter,
		remain:  1024,
	}

	buf := make([]byte, 400)
	n1, err1 := reader.Read(buf)
	if err1 != nil || n1 != 400 {
		t.Fatalf("first read: n=%d err=%v, want n=400 err=nil", n1, err1)
	}

	// Read remaining bytes until EOF
	rest, errAll := io.ReadAll(reader)
	if errAll != nil {
		t.Fatalf("ReadAll failed: %v", errAll)
	}
	if len(rest) != 624 || winCounter.Load() != 1024 || totalCounter.Load() != 1024 {
		t.Fatalf("byte accounting mismatch: rest=%d win=%d total=%d", len(rest), winCounter.Load(), totalCounter.Load())
	}

	// Verify immediate context cancellation
	cancelCtx, cancelNow := context.WithCancel(context.Background())
	cancelNow()
	canceledReader := &meteredUploadReader{
		ctx:     cancelCtx,
		counter: &winCounter,
		total:   &totalCounter,
		remain:  4096,
	}
	_, errCanceled := canceledReader.Read(buf)
	if !errors.Is(errCanceled, context.Canceled) {
		t.Fatalf("expected context.Canceled, got %v", errCanceled)
	}
}

func TestScanPortsLocalLoopback(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Skipf("local TCP listener unavailable in test environment: %v", err)
	}
	defer ln.Close()

	go func() {
		for {
			conn, acceptErr := ln.Accept()
			if acceptErr != nil {
				return
			}
			_ = conn.Close()
		}
	}()

	openPort := ln.Addr().(*net.TCPAddr).Port

	// Probe once to check whether the current OS/sandbox environment permits outbound loopback TCP dials
	probeConn, probeErr := net.Dial("tcp", ln.Addr().String())
	if probeErr != nil {
		t.Skipf("outbound loopback TCP dial restricted in sandbox environment: %v", probeErr)
	}
	_ = probeConn.Close()

	// Reserve and immediately close a second port to guarantee a closed port
	closedLn, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Skipf("secondary TCP listener unavailable: %v", err)
	}
	closedPort := closedLn.Addr().(*net.TCPAddr).Port
	_ = closedLn.Close()

	report, err := ScanPorts("127.0.0.1", []int{openPort, closedPort})
	if err != nil {
		t.Fatalf("ScanPorts failed: %v", err)
	}
	if report.TotalPorts != 2 || report.OpenCount != 1 {
		t.Fatalf("unexpected scan counts: total=%d open=%d, results=%+v", report.TotalPorts, report.OpenCount, report.Results)
	}
	if report.Results[0].State != "open" || report.Results[1].State != "closed" {
		t.Fatalf("unexpected port states: %+v", report.Results)
	}
}
