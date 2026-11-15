# Prints the foreground window's handle, rectangle (physical pixels), maximized flag and process id
# whenever any of them change. Used by Clawdkin's "Perch on windows" mode. Reads positions only.
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class BuddyFG {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  public struct RECT { public int L, T, R, B; }
}
"@
$last = ''
while ($true) {
  $h = [BuddyFG]::GetForegroundWindow()
  $r = New-Object BuddyFG+RECT
  [void][BuddyFG]::GetWindowRect($h, [ref]$r)
  $p = [uint32]0
  [void][BuddyFG]::GetWindowThreadProcessId($h, [ref]$p)
  $z = [int][BuddyFG]::IsZoomed($h)
  $s = "$h $($r.L) $($r.T) $($r.R) $($r.B) $z $p"
  if ($s -ne $last) { $last = $s; [Console]::Out.WriteLine($s) }
  Start-Sleep -Milliseconds 300
}
