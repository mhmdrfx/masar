Unicode true

!include "wails_tools.nsh"

VIProductVersion "${INFO_PRODUCTVERSION}.0"
VIFileVersion    "${INFO_PRODUCTVERSION}.0"

VIAddVersionKey "CompanyName"      "${INFO_COMPANYNAME}"
VIAddVersionKey "FileDescription"  "${INFO_PRODUCTNAME} Setup"
VIAddVersionKey "ProductVersion"   "${INFO_PRODUCTVERSION}"
VIAddVersionKey "FileVersion"      "${INFO_PRODUCTVERSION}"
VIAddVersionKey "LegalCopyright"   "${INFO_COPYRIGHT}"
VIAddVersionKey "ProductName"      "${INFO_PRODUCTNAME}"
VIAddVersionKey "OriginalFilename" "Masar-Setup.exe"

ManifestDPIAware true

!include "MUI2.nsh"
!include "FileFunc.nsh"

!define MUI_ICON "..\icon.ico"
!define MUI_UNICON "..\icon.ico"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_FINISHPAGE_RUN "$INSTDIR\${PRODUCT_EXECUTABLE}"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Masar"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Arabic"

Name "${INFO_PRODUCTNAME}"
OutFile "..\..\bin\Masar-Setup.exe"

!ifdef WAILS_INSTALL_SCOPE
  !if "${WAILS_INSTALL_SCOPE}" == "user"
    InstallDir "$LOCALAPPDATA\Programs\Masar"
  !else
    InstallDir "$PROGRAMFILES64\Masar"
  !endif
!else
  InstallDir "$PROGRAMFILES64\Masar"
!endif

ShowInstDetails show
ShowUninstDetails show

Function .onInit
    !insertmacro wails.checkArchitecture
FunctionEnd

; In-app updates run "Masar-Setup.exe /S /RELAUNCH /D=<install dir>".
; Relaunch Masar unelevated (through Explorer) once the silent update has finished.
Function .onInstSuccess
    ${GetParameters} $R0
    ClearErrors
    ${GetOptions} $R0 "/RELAUNCH" $R1
    IfErrors relaunch_done
    Exec '"$WINDIR\explorer.exe" "$INSTDIR\${PRODUCT_EXECUTABLE}"'
    relaunch_done:
FunctionEnd

Section "Masar"
    !insertmacro wails.setShellContext
    !insertmacro wails.webview2runtime

    ; When updating from inside Masar, wait (up to ~10s) until the running copy has exited.
    StrCpy $1 0
    wait_for_exit:
        IfFileExists "$INSTDIR\${PRODUCT_EXECUTABLE}" 0 exe_unlocked
        ClearErrors
        FileOpen $0 "$INSTDIR\${PRODUCT_EXECUTABLE}" a
        IfErrors 0 exe_free
        IntOp $1 $1 + 1
        IntCmp $1 40 exe_unlocked
        Sleep 250
        Goto wait_for_exit
    exe_free:
        FileClose $0
    exe_unlocked:

    SetOutPath $INSTDIR
    !insertmacro wails.files

    CreateDirectory "$SMPROGRAMS\Masar"
    CreateShortCut "$SMPROGRAMS\Masar\Masar.lnk" "$INSTDIR\${PRODUCT_EXECUTABLE}" "" "$INSTDIR\${PRODUCT_EXECUTABLE}" 0
    CreateShortCut "$SMPROGRAMS\Masar\Uninstall Masar.lnk" "$INSTDIR\uninstall.exe" "" "$INSTDIR\uninstall.exe" 0
    CreateShortCut "$DESKTOP\Masar.lnk" "$INSTDIR\${PRODUCT_EXECUTABLE}" "" "$INSTDIR\${PRODUCT_EXECUTABLE}" 0

    !insertmacro wails.associateFiles
    !insertmacro wails.associateCustomProtocols
    !insertmacro wails.writeUninstaller
SectionEnd

Section "Uninstall"
    !insertmacro wails.setShellContext

    RMDir /r "$AppData\${PRODUCT_EXECUTABLE}"
    Delete "$DESKTOP\Masar.lnk"
    Delete "$SMPROGRAMS\Masar\Masar.lnk"
    Delete "$SMPROGRAMS\Masar\Uninstall Masar.lnk"
    RMDir "$SMPROGRAMS\Masar"
    Delete "$SMPROGRAMS\${INFO_PRODUCTNAME}.lnk"
    Delete "$DESKTOP\${INFO_PRODUCTNAME}.lnk"

    !insertmacro wails.unassociateFiles
    !insertmacro wails.unassociateCustomProtocols
    !insertmacro wails.deleteUninstaller

    RMDir /r "$INSTDIR"
SectionEnd
