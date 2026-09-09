!macro customInstall
  ExecWait 'icacls "$INSTDIR" /grant *S-1-15-2-1:(OI)(CI)(RX) /t'
  ExecWait 'icacls "$INSTDIR" /grant *S-1-15-2-2:(OI)(CI)(RX) /t'
!macroend
