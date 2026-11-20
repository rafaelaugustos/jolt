#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>
// Test-runner only. Returns an error description, or nil after OS event delivery.
NSString * _Nullable JoltGestureTrace(CGPoint center);

NSString * _Nullable JoltSheetInterrupt(CGPoint handle);
NSString * _Nullable JoltNavigationFlick(CGPoint start, CGFloat distance);
NSString * _Nullable JoltNavigationHold(CGPoint start, CGFloat distance, NSInteger orientation);
NSString * _Nullable JoltModalHold(CGPoint start, CGFloat distance, NSInteger orientation);
NSString * _Nullable JoltPhotoInterrupt(CGPoint center);
NSString * _Nullable JoltNativeTap(CGPoint point);
NSString * _Nullable JoltReaderDoubleTap(CGPoint point);
NSString * _Nullable JoltScrollAndLeave(CGPoint start, CGFloat distance, CGPoint back);
NSString * _Nullable JoltReaderScroll(CGPoint start, CGFloat distance);

NSString * _Nullable JoltPointerTrace(CGRect region);
// One uninterrupted real OS contact, optionally reversing before release.
NSString * _Nullable JoltScrollContact(CGPoint start, CGPoint delta, CGPoint reverse, double hold);

NSString * _Nullable JoltReorderContact(CGPoint start, CGPoint end, CGPoint reverse, double dwell, double reverseDwell);
