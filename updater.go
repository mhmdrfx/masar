package main

import (
	"context"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// wails.json is the single source of truth for the application version.
//
//go:embed wails.json
var wailsConfig []byte

const (
	updateRepoOwner     = "mhmdrfx"
	updateRepoName      = "masar"
	updateInstallerName = "Masar-Setup.exe"
	updateChecksumName  = "Masar-Setup.exe.sha256"
	updateMaxInstaller  = 300 << 20 // hard cap on installer size (300 MB)
)

var (
	updateLatestAPI    = fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", updateRepoOwner, updateRepoName)
	updateAssetsPrefix = fmt.Sprintf("https://github.com/%s/%s/releases/download/", updateRepoOwner, updateRepoName)
)

// UpdateInfo describes the result of an update check.
type UpdateInfo struct {
	Available      bool   `json:"available"`
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	ReleaseName    string `json:"releaseName"`
	ReleaseNotes   string `json:"releaseNotes"`
	ReleaseURL     string `json:"releaseUrl"`
	PublishedAt    string `json:"publishedAt"`
	DownloadURL    string `json:"downloadUrl"`
	ChecksumURL    string `json:"checksumUrl"`
	SizeBytes      int64  `json:"sizeBytes"`
	CheckedAt      string `json:"checkedAt"`
}

// UpdateProgress is emitted on the "update:progress" event while downloading.
type UpdateProgress struct {
	Stage      string  `json:"stage"` // downloading | verifying | launching
	Downloaded int64   `json:"downloaded"`
	Total      int64   `json:"total"`
	Percent    float64 `json:"percent"`
}

type updaterState struct {
	mu          sync.Mutex
	latest      *UpdateInfo
	downloading bool
}

var updater updaterState

var currentAppVersion = func() string {
	var cfg struct {
		Info struct {
			ProductVersion string `json:"productVersion"`
		} `json:"info"`
	}
	if err := json.Unmarshal(wailsConfig, &cfg); err != nil || cfg.Info.ProductVersion == "" {
		return "0.0.0"
	}
	return normalizeVersion(cfg.Info.ProductVersion)
}()

var updateHTTPClient = &http.Client{Timeout: 15 * time.Minute}

// GetAppVersion returns the running application version (e.g. "1.1.0").
func (a *App) GetAppVersion() string {
	return currentAppVersion
}

// CheckForUpdates queries the latest GitHub release and reports whether a newer version exists.
func (a *App) CheckForUpdates() (UpdateInfo, error) {
	ctx, cancel := context.WithTimeout(a.baseContext(), 15*time.Second)
	defer cancel()

	info, err := fetchLatestRelease(ctx)
	if err != nil {
		return UpdateInfo{CurrentVersion: currentAppVersion}, err
	}

	updater.mu.Lock()
	updater.latest = &info
	updater.mu.Unlock()
	return info, nil
}

// DownloadAndInstallUpdate downloads the latest installer, verifies its SHA256 checksum,
// launches it and quits Masar so the installer can replace the running files.
func (a *App) DownloadAndInstallUpdate() error {
	updater.mu.Lock()
	if updater.downloading {
		updater.mu.Unlock()
		return errors.New("an update is already being downloaded")
	}
	updater.downloading = true
	latest := updater.latest
	updater.mu.Unlock()

	defer func() {
		updater.mu.Lock()
		updater.downloading = false
		updater.mu.Unlock()
	}()

	if latest == nil || !latest.Available {
		info, err := a.CheckForUpdates()
		if err != nil {
			return err
		}
		latest = &info
	}
	if !latest.Available {
		return errors.New("Masar is already up to date")
	}
	if !strings.HasPrefix(latest.DownloadURL, updateAssetsPrefix) || !strings.HasPrefix(latest.ChecksumURL, updateAssetsPrefix) {
		return errors.New("release assets are not hosted in the official repository")
	}

	ctx := a.baseContext()

	expectedHash, err := fetchChecksum(ctx, latest.ChecksumURL)
	if err != nil {
		return fmt.Errorf("could not read release checksum: %w", err)
	}

	dir := filepath.Join(os.TempDir(), "masar-update")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	installerPath := filepath.Join(dir, fmt.Sprintf("Masar-Setup-%s.exe", latest.LatestVersion))

	actualHash, err := a.downloadInstaller(ctx, latest.DownloadURL, installerPath, latest.SizeBytes)
	if err != nil {
		_ = os.Remove(installerPath)
		return err
	}

	a.emitUpdateProgress(UpdateProgress{Stage: "verifying", Percent: 100})
	if !strings.EqualFold(actualHash, expectedHash) {
		_ = os.Remove(installerPath)
		return errors.New("downloaded installer failed SHA256 verification")
	}

	a.emitUpdateProgress(UpdateProgress{Stage: "launching", Percent: 100})
	if err := launchInstaller(installerPath); err != nil {
		return fmt.Errorf("could not start the installer: %w", err)
	}

	go func() {
		time.Sleep(700 * time.Millisecond)
		if a.ctx != nil {
			runtime.Quit(a.ctx)
		}
	}()
	return nil
}

func (a *App) baseContext() context.Context {
	if a.ctx != nil {
		return a.ctx
	}
	return context.Background()
}

func (a *App) emitUpdateProgress(p UpdateProgress) {
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "update:progress", p)
	}
}

func (a *App) downloadInstaller(ctx context.Context, url, dest string, expectedSize int64) (string, error) {
	resp, err := githubGet(ctx, url, "application/octet-stream")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	total := resp.ContentLength
	if total <= 0 {
		total = expectedSize
	}
	if total > updateMaxInstaller {
		return "", errors.New("installer is unexpectedly large")
	}

	out, err := os.Create(dest)
	if err != nil {
		return "", err
	}
	defer out.Close()

	hasher := sha256.New()
	writer := io.MultiWriter(out, hasher)
	buf := make([]byte, 64<<10)
	var downloaded int64
	lastEmit := time.Time{}

	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			if _, err := writer.Write(buf[:n]); err != nil {
				return "", err
			}
			downloaded += int64(n)
			if downloaded > updateMaxInstaller {
				return "", errors.New("installer is unexpectedly large")
			}
			if time.Since(lastEmit) > 120*time.Millisecond {
				lastEmit = time.Now()
				a.emitUpdateProgress(newProgress(downloaded, total))
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return "", readErr
		}
	}
	a.emitUpdateProgress(newProgress(downloaded, downloaded))

	if err := out.Close(); err != nil {
		return "", err
	}
	return hex.EncodeToString(hasher.Sum(nil)), nil
}

func newProgress(downloaded, total int64) UpdateProgress {
	p := UpdateProgress{Stage: "downloading", Downloaded: downloaded, Total: total}
	if total > 0 {
		p.Percent = float64(downloaded) * 100 / float64(total)
		if p.Percent > 100 {
			p.Percent = 100
		}
	}
	return p
}

func fetchLatestRelease(ctx context.Context) (UpdateInfo, error) {
	info := UpdateInfo{CurrentVersion: currentAppVersion, CheckedAt: time.Now().Format(time.RFC3339)}

	resp, err := githubGet(ctx, updateLatestAPI, "application/vnd.github+json")
	if err != nil {
		return info, err
	}
	defer resp.Body.Close()

	var release struct {
		TagName     string `json:"tag_name"`
		Name        string `json:"name"`
		Body        string `json:"body"`
		HTMLURL     string `json:"html_url"`
		PublishedAt string `json:"published_at"`
		Draft       bool   `json:"draft"`
		Prerelease  bool   `json:"prerelease"`
		Assets      []struct {
			Name               string `json:"name"`
			Size               int64  `json:"size"`
			BrowserDownloadURL string `json:"browser_download_url"`
		} `json:"assets"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&release); err != nil {
		return info, fmt.Errorf("invalid release data: %w", err)
	}
	if release.Draft || release.Prerelease || release.TagName == "" {
		return info, nil
	}

	info.LatestVersion = normalizeVersion(release.TagName)
	info.ReleaseName = release.Name
	info.ReleaseNotes = release.Body
	info.ReleaseURL = release.HTMLURL
	info.PublishedAt = release.PublishedAt
	for _, asset := range release.Assets {
		switch asset.Name {
		case updateInstallerName:
			info.DownloadURL = asset.BrowserDownloadURL
			info.SizeBytes = asset.Size
		case updateChecksumName:
			info.ChecksumURL = asset.BrowserDownloadURL
		}
	}

	info.Available = compareVersions(info.LatestVersion, currentAppVersion) > 0 &&
		info.DownloadURL != "" && info.ChecksumURL != ""
	return info, nil
}

func fetchChecksum(ctx context.Context, url string) (string, error) {
	resp, err := githubGet(ctx, url, "application/octet-stream")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if err != nil {
		return "", err
	}
	return parseChecksum(string(data))
}

// parseChecksum extracts the hex digest from a "sha256sum"-style line.
func parseChecksum(content string) (string, error) {
	fields := strings.Fields(strings.TrimPrefix(content, "\ufeff"))
	if len(fields) == 0 {
		return "", errors.New("checksum file is empty")
	}
	hash := strings.ToLower(fields[0])
	if len(hash) != 64 {
		return "", errors.New("checksum file is malformed")
	}
	if _, err := hex.DecodeString(hash); err != nil {
		return "", errors.New("checksum file is malformed")
	}
	return hash, nil
}

func githubGet(ctx context.Context, url, accept string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", accept)
	req.Header.Set("User-Agent", "Masar-Updater/"+currentAppVersion)

	resp, err := updateHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		if resp.StatusCode == http.StatusNotFound {
			return nil, errors.New("no published release was found")
		}
		return nil, fmt.Errorf("GitHub responded with HTTP %d", resp.StatusCode)
	}
	return resp, nil
}

// normalizeVersion strips a leading "v" and surrounding whitespace.
func normalizeVersion(v string) string {
	v = strings.TrimSpace(v)
	v = strings.TrimPrefix(strings.TrimPrefix(v, "v"), "V")
	return v
}

// compareVersions compares dotted numeric versions ("1.2.10" > "1.2.9").
// Pre-release suffixes ("-beta") are ranked lower than the plain release.
func compareVersions(a, b string) int {
	coreA, preA := splitPrerelease(normalizeVersion(a))
	coreB, preB := splitPrerelease(normalizeVersion(b))

	partsA := strings.Split(coreA, ".")
	partsB := strings.Split(coreB, ".")
	for i := 0; i < len(partsA) || i < len(partsB); i++ {
		na, nb := versionPart(partsA, i), versionPart(partsB, i)
		if na != nb {
			if na > nb {
				return 1
			}
			return -1
		}
	}

	switch {
	case preA == preB:
		return 0
	case preA == "":
		return 1
	case preB == "":
		return -1
	case preA > preB:
		return 1
	default:
		return -1
	}
}

func splitPrerelease(v string) (string, string) {
	if i := strings.IndexAny(v, "-+"); i >= 0 {
		return v[:i], v[i+1:]
	}
	return v, ""
}

func versionPart(parts []string, i int) int {
	if i >= len(parts) {
		return 0
	}
	n, err := strconv.Atoi(strings.TrimSpace(parts[i]))
	if err != nil {
		return 0
	}
	return n
}
