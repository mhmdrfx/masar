package main

import "testing"

func TestCompareVersions(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"1.0.0", "1.0.0", 0},
		{"v1.1.0", "1.0.0", 1},
		{"1.0.0", "v1.0.1", -1},
		{"1.2.10", "1.2.9", 1},
		{"2.0", "1.9.9", 1},
		{"1.0", "1.0.0", 0},
		{"1.1.0-beta", "1.1.0", -1},
		{"1.1.0", "1.1.0-rc1", 1},
		{"1.1.0-rc2", "1.1.0-rc1", 1},
	}
	for _, c := range cases {
		if got := compareVersions(c.a, c.b); got != c.want {
			t.Errorf("compareVersions(%q, %q) = %d, want %d", c.a, c.b, got, c.want)
		}
	}
}

func TestParseChecksum(t *testing.T) {
	const hash = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"

	for _, input := range []string{
		hash + "  Masar-Setup.exe\r\n",
		"\ufeff" + hash + " *Masar-Setup.exe",
		"9F86D081884C7D659A2FEAA0C55AD015A3BF4F1B2B0B822CD15D6C15B0F00A08",
	} {
		got, err := parseChecksum(input)
		if err != nil || got != hash {
			t.Errorf("parseChecksum(%q) = %q, %v", input, got, err)
		}
	}

	for _, bad := range []string{"", "abc  Masar-Setup.exe", "zz86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"} {
		if _, err := parseChecksum(bad); err == nil {
			t.Errorf("parseChecksum(%q) expected error", bad)
		}
	}
}

func TestCurrentAppVersionFromWailsConfig(t *testing.T) {
	if currentAppVersion == "" || currentAppVersion == "0.0.0" {
		t.Fatalf("expected version from wails.json, got %q", currentAppVersion)
	}
}
