; Run before old-version uninstall, including upgrades from clients that did not
; wait for Java exit. Never remove media or force-kill the running client.
!macro customCheckAppRunning
  InitPluginsDir
  File /oname=$PLUGINSDIR\stop-installed-runtime.ps1 "${BUILD_RESOURCES_DIR}\stop-installed-runtime.ps1"
  runtime_check_retry:
    nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\stop-installed-runtime.ps1" -InstallDirectory "$INSTDIR\." -AppExecutable "${APP_EXECUTABLE_FILENAME}" -LogPath "$TEMP\HongguoManju-install-runtime.log"'
    Pop $R0
    ${If} $R0 == 10
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "红果漫剧仍在运行。请在系统托盘菜单选择“退出软件”，等待后台缓存停止后点击重试。已有缓存会保留，无需删除。" /SD IDCANCEL IDRETRY runtime_check_retry
      SetErrorLevel 2
      Quit
    ${ElseIf} $R0 != 0
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "无法确认旧版后台组件已退出，已停止安装以保护数据。请退出托盘中的红果漫剧后重试；必要时重启电脑再覆盖安装，无需清空缓存。" /SD IDCANCEL IDRETRY runtime_check_retry
      SetErrorLevel 2
      Quit
    ${EndIf}
!macroend
