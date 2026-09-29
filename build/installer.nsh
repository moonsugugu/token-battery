; electron-builder가 설치 파일을 만들 때 자동으로 포함하는 사용자 지정 스크립트 (build/installer.nsh)

!macro customUnInstall
  ; 프로그램을 지울 때 '윈도우 시작 시 자동 실행' 등록도 함께 지운다. 등록 이름은 앱 ID(APP_ID)와 같다.
  ; 새 버전을 설치할 때도 이전 버전 제거가 --updated로 실행되므로, 그때는 지우지 않는다(업데이트 후에도 자동 실행 유지)
  ${ifNot} ${isUpdated}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APP_ID}"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "${APP_ID}"
  ${endIf}
!macroend
