#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>
// Test-runner only. Returns an error description, or nil after OS event delivery.
NSString * _Nullable JoltGestureTrace(CGPoint center);

NSString * _Nullable JoltSheetInterrupt(CGPoint handle);
NSString * _Nullable JoltNavigationFlick(CGPoint start, CGFloat distance);
NSString * _Nullable JoltPhotoInterrupt(CGPoint center);
NSString * _Nullable JoltNativeTap(CGPoint point);
