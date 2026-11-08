//go:build !windows

package main

import "errors"

func launchInstaller(string) error {
	return errors.New("in-app updates are only supported on Windows")
}
