!macro customInstall
  nsExec::Exec 'icacls "$INSTDIR" /grant *S-1-15-2-1:(OI)(CI)(RX) /t /q'
  nsExec::Exec 'icacls "$INSTDIR" /grant *S-1-15-2-2:(OI)(CI)(RX) /t /q'
!macroend
