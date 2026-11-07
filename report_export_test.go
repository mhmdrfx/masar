package main

import (
	"encoding/csv"
	"encoding/json"
	"strings"
	"testing"

	"masar/internal/mtr"
)

func sampleTraceSnapshot() mtr.TraceSnapshot {
	hops := []mtr.HopStat{
		{
			Hop:         1,
			IP:          "192.168.1.1",
			Hostname:    "home.gateway",
			Location:    "Local LAN / Gateway",
			ASN:         "Private RFC1918",
			Sent:        20,
			Received:    20,
			LossPercent: 0.0,
			LastMs:      1.4,
			AvgMs:       1.5,
			BestMs:      1.1,
			WorstMs:     2.3,
			JitterMs:    0.3,
			History:     []float64{1.3, 1.5, 1.4, 1.6},
		},
		{
			Hop:         2,
			IP:          "",
			Sent:        20,
			Received:    0,
			LossPercent: 0.0,
		},
		{
			Hop:         3,
			IP:          "8.8.8.8",
			Hostname:    "dns.google",
			Location:    "Global Anycast • Google",
			ASN:         "AS15169 Google LLC",
			Sent:        20,
			Received:    20,
			LossPercent: 0.0,
			LastMs:      24.2,
			AvgMs:       24.8,
			BestMs:      23.5,
			WorstMs:     27.1,
			JitterMs:    0.9,
			History:     []float64{24.5, 25.1, 24.8, 24.2},
			ReachedDest: true,
		},
	}

	return mtr.TraceSnapshot{
		Running:    false,
		Target:     "8.8.8.8",
		ResolvedIP: "8.8.8.8",
		UpdatedAt:  "16:20:00",
		Hops:       hops,
		Health:     mtr.EvaluateHealth(hops),
	}
}

func TestFormatArabicHopsCount(t *testing.T) {
	if got := formatArabicHopsCount(0); got != "0 قفزة" {
		t.Errorf("0 hops: got %q", got)
	}
	if got := formatArabicHopsCount(1); got != "قفزة واحدة (1)" {
		t.Errorf("1 hop: got %q", got)
	}
	if got := formatArabicHopsCount(2); got != "قفزتان (2)" {
		t.Errorf("2 hops: got %q", got)
	}
	if got := formatArabicHopsCount(5); got != "5 قفزات" {
		t.Errorf("5 hops: got %q", got)
	}
	if got := formatArabicHopsCount(14); got != "14 قفزة" {
		t.Errorf("14 hops: got %q", got)
	}
}

func TestBuildDetailedSupportReportBiLingual(t *testing.T) {
	snap := sampleTraceSnapshot()

	arReport := BuildDetailedSupportReport(snap, "ar")
	if !strings.Contains(arReport, "مسار (Masar v1.0)") || !strings.Contains(arReport, "@mhmdrfx") {
		t.Errorf("Arabic report missing header or @mhmdrfx attribution")
	}
	if strings.Contains(arReport, "بنق") {
		t.Errorf("Arabic report should use formal Arabic terminology without colloquial 'بنق'")
	}
	if !strings.Contains(arReport, "3 قفزات") {
		t.Errorf("Arabic report missing proper plural count '3 قفزات'")
	}

	enReport := BuildDetailedSupportReport(snap, "en")
	if !strings.Contains(enReport, "MASAR v1.0") || !strings.Contains(enReport, "@mhmdrfx") {
		t.Errorf("English report missing header or @mhmdrfx attribution")
	}
	if !strings.Contains(enReport, "3 Hops Total") {
		t.Errorf("English report missing '3 Hops Total'")
	}
}

func TestBuildDetailedHTMLReportBiDiAndTypography(t *testing.T) {
	snap := sampleTraceSnapshot()

	arHTML := BuildDetailedHTMLReport(snap, "ar")
	if !strings.Contains(arHTML, `<html lang="ar" dir="rtl">`) {
		t.Errorf("Arabic HTML missing dir=\"rtl\" root attribute")
	}
	if !strings.Contains(arHTML, `<bdi dir="ltr">`) {
		t.Errorf("Arabic HTML missing <bdi dir=\"ltr\"> technical token isolation")
	}
	if !strings.Contains(arHTML, `<span class="g-num" dir="ltr">08</span>`) {
		t.Errorf("Arabic HTML missing isolated numeric badge 08")
	}
	if strings.Contains(arHTML, "8. التذبذب") || strings.Contains(arHTML, ".8 التذبذب") {
		t.Errorf("Arabic HTML contains BiDi period-reversal artifact on item 8")
	}
	if !strings.Contains(arHTML, "<svg") || !strings.Contains(arHTML, "<polyline") {
		t.Errorf("Arabic HTML missing inline SVG sparkline")
	}

	enHTML := BuildDetailedHTMLReport(snap, "en")
	if !strings.Contains(enHTML, `<html lang="en" dir="ltr">`) {
		t.Errorf("English HTML missing dir=\"ltr\" root attribute")
	}
}

func TestBuildDetailedCSVReportUTF8BOM(t *testing.T) {
	snap := sampleTraceSnapshot()

	arCSV := BuildDetailedCSVReport(snap, "ar")
	if !strings.HasPrefix(arCSV, "\xEF\xBB\xBF") {
		t.Fatalf("Arabic CSV missing UTF-8 BOM prefix for Microsoft Excel compatibility")
	}

	trimmed := strings.TrimPrefix(arCSV, "\xEF\xBB\xBF")
	reader := csv.NewReader(strings.NewReader(trimmed))
	reader.FieldsPerRecord = -1
	rows, err := reader.ReadAll()
	if err != nil {
		t.Fatalf("CSV output failed to parse cleanly: %v", err)
	}
	if len(rows) < 10 {
		t.Fatalf("expected metadata + header + 3 hops + glossary rows, got %d rows", len(rows))
	}
}

func TestBuildDetailedJSONReportSchema(t *testing.T) {
	snap := sampleTraceSnapshot()

	raw, err := BuildDetailedJSONReport(snap, "ar")
	if err != nil {
		t.Fatalf("BuildDetailedJSONReport returned error: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		t.Fatalf("JSON report failed to unmarshal: %v", err)
	}

	meta, ok := parsed["reportMetadata"].(map[string]interface{})
	if !ok || meta["developer"] != "@mhmdrfx" {
		t.Errorf("expected reportMetadata.developer == '@mhmdrfx', got %+v", meta)
	}
	if _, ok := parsed["extractedDataReference"].(map[string]interface{}); !ok {
		t.Errorf("missing extractedDataReference glossary in JSON report")
	}
}
