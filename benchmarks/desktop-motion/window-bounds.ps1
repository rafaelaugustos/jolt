param([long]$WindowHandle)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class JoltCapture {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect bounds);
}
'@
$bounds = New-Object JoltCapture+Rect
if (![JoltCapture]::GetWindowRect([IntPtr]$WindowHandle, [ref]$bounds)) { throw 'Cannot measure the XAML window' }
@{x=$bounds.Left;y=$bounds.Top;width=$bounds.Right-$bounds.Left;height=$bounds.Bottom-$bounds.Top} | ConvertTo-Json -Compress
