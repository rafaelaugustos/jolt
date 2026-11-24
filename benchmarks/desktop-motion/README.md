# Native desktop motion acceptance

Build the Jolt package from the repository root, then install the optional platform runtime with `npm ci --prefix benchmarks/desktop-motion`. The examples use the compiled desktop entries. They exercise a real control, read its presentation during playback, replace its active animation, suspend during a fade and check disposal.

On a macOS GUI session with Node 22, run `node benchmarks/desktop-motion/appkit.mjs`. Supply a fresh MOV path to record the AppKit window. The host imports AppKit and QuartzCore before constructing a layer-backed view.

The Windows example needs Node 22, Windows XAML Islands and a prepared host executable. From the repository root on Windows run the following commands.

```powershell
node benchmarks/desktop-motion/windows-host.mjs .local/runtime/node.exe
.local/runtime/node.exe benchmarks/desktop-motion/windows.mjs
```

The hosted Windows workflow enables client animations on its disposable runner and supplies FFmpeg to capture the window. It also exercises immediate placement with reduced motion. Applications should respect the user's system preference.
