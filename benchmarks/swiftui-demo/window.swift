import Foundation
import CoreGraphics
let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String:Any]] ?? []
guard CGPreflightScreenCaptureAccess() else { fputs("Screen recording permission is required.\n",stderr); exit(1) }
guard let window = windows.first(where: {
    ($0[kCGWindowOwnerName as String] as? String) == "JoltSwiftUIMac" && ($0[kCGWindowLayer as String] as? Int) == 0
}), let identifier = window[kCGWindowNumber as String] as? Int else { exit(2) }
print(identifier)
