//go:build windows

package main

import (
	"syscall"
	"unsafe"
)

func setWindowsAppUserModelID() {
	shell32 := syscall.NewLazyDLL("shell32.dll")
	proc := shell32.NewProc("SetCurrentProcessExplicitAppUserModelID")
	if proc != nil && proc.Find() == nil {
		appID, err := syscall.UTF16PtrFromString("mhmdrfx.Masar")
		if err == nil {
			proc.Call(uintptr(unsafe.Pointer(appID)))
		}
	}
}
