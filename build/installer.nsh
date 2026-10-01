; 프로그램을 제거하면 윈도우 시작 시 자동 실행 등록도 함께 지운다.
; 업데이트할 때도 이전 버전의 제거 과정이 실행되므로, 그때는 사용자의 자동 실행 설정을 그대로 둔다.
!macro removeAutostart NAME
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${NAME}"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "${NAME}"
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    !insertmacro removeAutostart "com.moonsune.tokenbattery"
    !insertmacro removeAutostart "com.moonsunezip.tokenbattery"
    !insertmacro removeAutostart "com.moonsunezip.ai-usage-widget"
  ${endIf}
!macroend
