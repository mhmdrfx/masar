//go:build windows

package main

import (
	"os"
	"path/filepath"

	"golang.org/x/sys/windows"
)

// launchInstaller starts the NSIS installer through ShellExecute so Windows can show the
// UAC elevation prompt. When Masar is an installed copy (uninstall.exe sits next to it),
// the update runs silently into the same folder and relaunches Masar afterwards.
// Portable/dev copies get the regular interactive setup wizard instead.
func launchInstaller(installerPath string) error {
	args := ""
	if exe, err := os.Executable(); err == nil {
		installDir := filepath.Dir(exe)
		if _, err := os.Stat(filepath.Join(installDir, "uninstall.exe")); err == nil {
			// NSIS requires /D to be the last argument and unquoted, even with spaces.
			args = "/S /RELAUNCH /D=" + installDir
		}
	}

	verb, err := windows.UTF16PtrFromString("runas")
	if err != nil {
		return err
	}
	file, err := windows.UTF16PtrFromString(installerPath)
	if err != nil {
		return err
	}
	var argPtr *uint16
	if args != "" {
		if argPtr, err = windows.UTF16PtrFromString(args); err != nil {
			return err
		}
	}
	cwd, err := windows.UTF16PtrFromString(filepath.Dir(installerPath))
	if err != nil {
		return err
	}
	return windows.ShellExecute(0, verb, file, argPtr, cwd, windows.SW_SHOWNORMAL)
}
