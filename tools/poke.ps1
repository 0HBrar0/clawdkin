# Presses a taskbar button for Clawdkin's "oops" tricks, through UI Automation (no mouse clicks).
# The only key it ever sends is Esc, to close the Start menu, and only while Start is the window in front.
#   start-open | start-close   the Start menu (a toggle button that knows if it is open)
#   tray-open  | tray-close    the "Show hidden icons" flyout
# The *-close actions only act if the thing is still open, so nothing the user closed gets reopened.
# Prints one word: done, already, missing or error.
param([Parameter(Mandatory = $true)][ValidateSet('start-open', 'start-close', 'tray-open', 'tray-close')][string]$Action)
$ErrorActionPreference = 'Stop'
try {
  Add-Type @"
using System; using System.Runtime.InteropServices;
public class K {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
  [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, UIntPtr e);
}
"@
  # is the Start menu (or its search) the window in front?
  function StartInFront { $p = 0; [void][K]::GetWindowThreadProcessId([K]::GetForegroundWindow(), [ref]$p); try { (Get-Process -Id $p).ProcessName -in @('SearchHost', 'StartMenuExperienceHost') } catch { $false } }
  if ($Action -eq 'start-close') {
    # Start hides the taskbar from UI Automation while it is open, so close it with Esc, which only reaches it when it is in front
    if (-not (StartInFront)) { 'already'; exit }
    [K]::keybd_event(0x1B, 0, 0, [UIntPtr]::Zero); [K]::keybd_event(0x1B, 0, 2, [UIntPtr]::Zero); 'done'; exit
  }
  if ($Action -eq 'start-open' -and (StartInFront)) { 'already'; exit }
  Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
  $AE = [System.Windows.Automation.AutomationElement]
  $TS = [System.Windows.Automation.TreeScope]
  $bar = $AE::RootElement.FindFirst($TS::Children, (New-Object System.Windows.Automation.PropertyCondition($AE::ClassNameProperty, 'Shell_TrayWnd')))
  if (-not $bar) { 'missing'; exit }

  if ($Action -like 'start-*') {
    $btn = $bar.FindFirst($TS::Descendants, (New-Object System.Windows.Automation.PropertyCondition($AE::AutomationIdProperty, 'StartButton')))
    if (-not $btn) { 'missing'; exit }
    $tog = $btn.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern)
    $open = $tog.Current.ToggleState -eq [System.Windows.Automation.ToggleState]::On
    if (($Action -eq 'start-open') -eq $open) { 'already'; exit }
    $tog.Toggle(); 'done'; exit
  }

  # hidden icons: the chevron button, and the flyout window it opens
  $chev = $null
  foreach ($e in $bar.FindAll($TS::Descendants, (New-Object System.Windows.Automation.PropertyCondition($AE::AutomationIdProperty, 'SystemTrayIcon')))) {
    if ($e.Current.ClassName -eq 'SystemTray.NormalButton' -and $e.Current.Name -match 'hidden') { $chev = $e; break }
  }
  if (-not $chev) { 'missing'; exit }
  $flyout = $AE::RootElement.FindFirst($TS::Children, (New-Object System.Windows.Automation.PropertyCondition($AE::ClassNameProperty, 'TopLevelWindowForOverflowXamlIsland')))
  $open = $flyout -and -not $flyout.Current.IsOffscreen -and $flyout.Current.BoundingRectangle.Width -gt 0
  if (($Action -eq 'tray-open') -eq [bool]$open) { 'already'; exit }
  $chev.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); 'done'
} catch { 'error' }
