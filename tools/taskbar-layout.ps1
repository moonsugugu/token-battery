# Read geometry only. Never change Explorer or inject code into the taskbar.
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class TokenBatteryTaskbar {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string name, string title);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string name, string title);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
}
'@
[void][TokenBatteryTaskbar]::SetThreadDpiAwarenessContext([IntPtr](-4))
function Get-TaskbarRect([IntPtr]$window) {
  $taskRect = New-Object TokenBatteryTaskbar+Rect
  if ($window -eq [IntPtr]::Zero -or -not [TokenBatteryTaskbar]::GetWindowRect($window, [ref]$taskRect)) { return $null }
  return @{ x=$taskRect.Left; y=$taskRect.Top; width=$taskRect.Right-$taskRect.Left; height=$taskRect.Bottom-$taskRect.Top }
}
$taskBar = [TokenBatteryTaskbar]::FindWindow('Shell_TrayWnd', $null)
$taskNotify = [TokenBatteryTaskbar]::FindWindowEx($taskBar, [IntPtr]::Zero, 'TrayNotifyWnd', $null)
@{ bar=(Get-TaskbarRect $taskBar); notify=(Get-TaskbarRect $taskNotify) } | ConvertTo-Json -Compress
