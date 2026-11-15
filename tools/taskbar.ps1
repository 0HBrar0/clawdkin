# Reports the taskbar's layout as one line of JSON: the bar itself, the Start button, running-app buttons
# and the clock, in physical screen pixels. Used by the buddy's taskbar tricks. Read-only.
$ErrorActionPreference = 'Stop'
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public class FG {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct MI { public int cb; public RECT mon, work; public int flags; }
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr h, uint f);
  [DllImport("user32.dll")] public static extern bool GetMonitorInfo(IntPtr m, ref MI i);
  // is the active window covering its whole monitor (a video, a game)?
  public static bool Fullscreen() {
    var h = GetForegroundWindow(); if (h == IntPtr.Zero) return false;
    var c = new StringBuilder(64); GetClassName(h, c, 64); var cls = c.ToString();
    if (cls == "Progman" || cls == "WorkerW" || cls == "Shell_TrayWnd") return false;
    RECT r; if (!GetWindowRect(h, out r)) return false;
    var mi = new MI(); mi.cb = Marshal.SizeOf(typeof(MI)); if (!GetMonitorInfo(MonitorFromWindow(h, 2), ref mi)) return false;
    return r.L <= mi.mon.L && r.T <= mi.mon.T && r.R >= mi.mon.R && r.B >= mi.mon.B;
  }
}
"@
[void][FG]::SetProcessDPIAware()
if ([FG]::Fullscreen()) { '{"ok":false,"fullscreen":true}'; exit }
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
$AE = [System.Windows.Automation.AutomationElement]
$TS = [System.Windows.Automation.TreeScope]
$cond = New-Object System.Windows.Automation.PropertyCondition($AE::ClassNameProperty, 'Shell_TrayWnd')
$bar = $AE::RootElement.FindFirst($TS::Children, $cond)
if (-not $bar) { '{"ok":false}'; exit }
function Rect($e) { $r = $e.Current.BoundingRectangle; @{ x = [int]$r.X; y = [int]$r.Y; w = [int]$r.Width; h = [int]$r.Height } }
$out = @{ ok = $true; bar = (Rect $bar); apps = @(); start = $null; clock = $null; tray = $null }
$all = $bar.FindAll($TS::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
foreach ($e in $all) {
  $c = $e.Current
  if ($c.BoundingRectangle.Width -le 0) { continue }
  $id = [string]$c.AutomationId; $cls = [string]$c.ClassName; $name = [string]$c.Name
  if ($id -eq 'StartButton') { $out.start = Rect $e }
  elseif ($cls -eq 'TrayClockWClass' -or $id -eq 'SystemTrayIcon' -and $name -match '\d:\d') { $out.clock = Rect $e }
  elseif ($id -eq 'SystemTrayIcon' -and $cls -eq 'SystemTray.NormalButton' -and $name -match 'hidden') { $out.chevron = Rect $e }
  elseif ($id -like 'Appid:*' -or $cls -eq 'Taskbar.TaskListButtonAutomationPeer') { $out.apps += @{ name = $name; r = (Rect $e) } }
}
$out | ConvertTo-Json -Depth 4 -Compress
