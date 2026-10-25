#import "NativeGestureInput.h"
#import <UIKit/UIKit.h>

// XCTest has no public API for a moving, rotating two-pointer path. These private
// test-runner interfaces are discovered dynamically and never linked into Jolt.
@interface NSObject (JoltTestInput)
- (instancetype)initForTouchAtPoint:(CGPoint)point offset:(double)offset;
- (void)moveToPoint:(CGPoint)point atOffset:(double)offset;
- (void)liftUpAtOffset:(double)offset;
- (instancetype)initWithName:(NSString *)name interfaceOrientation:(NSInteger)orientation;
- (void)addPointerEventPath:(id)path;
- (BOOL)synthesizeWithError:(NSError **)error;
@end

NSString *JoltPhotoInterrupt(CGPoint center) {
    Class paths=NSClassFromString(@"XCPointerEventPath"), records=NSClassFromString(@"XCSynthesizedEventRecord");
    if(!paths || !records)return @"XCTest pointer-path interfaces are unavailable";
    id first=[[paths alloc]initForTouchAtPoint:center offset:0];[first liftUpAtOffset:.04];
    id second=[[paths alloc]initForTouchAtPoint:center offset:.10];[second liftUpAtOffset:.14];
    id pan=[[paths alloc]initForTouchAtPoint:center offset:.19];
    for(int i=1;i<=12;i++)[pan moveToPoint:CGPointMake(center.x-i*3,center.y+i) atOffset:.19+i*.02];
    [pan liftUpAtOffset:.65];
    id record=[[records alloc]initWithName:@"Jolt photo double tap interrupted by pan" interfaceOrientation:UIInterfaceOrientationPortrait];
    [record addPointerEventPath:first];[record addPointerEventPath:second];[record addPointerEventPath:pan];
    NSError *error=nil;return [record synthesizeWithError:&error]?nil:error.localizedDescription?:@"XCTest event synthesis failed";
}

// Public XCTest drag helpers decelerate before lifting. This OS path keeps moving
// until release, so the navigation test actually exercises velocity projection.
NSString *JoltNavigationFlick(CGPoint start, CGFloat distance) {
    Class pathClass = NSClassFromString(@"XCPointerEventPath"), recordClass = NSClassFromString(@"XCSynthesizedEventRecord");
    if (!pathClass || !recordClass) return @"XCTest pointer-path interfaces are unavailable";
    id path = [[pathClass alloc] initForTouchAtPoint:start offset:0];
    // Establish edge recognition before accelerating; the last part tests release
    // velocity, independently of UIKit's initial edge-intent threshold.
    [path moveToPoint:CGPointMake(start.x + 12, start.y) atOffset:.2];
    [path moveToPoint:CGPointMake(start.x + 24, start.y) atOffset:.35];
    for (int i = 1; i <= 8; i++)
        [path moveToPoint:CGPointMake(start.x + 24 + (distance - 24) * i / 8, start.y) atOffset:.35 + i * .012];
    [path liftUpAtOffset:.451];
    id record = [[recordClass alloc] initWithName:@"Jolt navigation edge flick" interfaceOrientation:UIInterfaceOrientationPortrait];
    [record addPointerEventPath:path];
    NSError *error = nil;
    return [record synthesizeWithError:&error] ? nil : error.localizedDescription ?: @"XCTest event synthesis failed";
}

NSString *JoltGestureTrace(CGPoint center) {
    Class pathClass = NSClassFromString(@"XCPointerEventPath"), recordClass = NSClassFromString(@"XCSynthesizedEventRecord");
    if (!pathClass || !recordClass) return @"XCTest pointer-path interfaces are unavailable";
    id first = [[pathClass alloc] initForTouchAtPoint:CGPointMake(center.x - 40, center.y) offset:0];
    CGPoint p = CGPointMake(center.x - 24, center.y - 8);
    [first moveToPoint:p atOffset:.3];
    id second = [[pathClass alloc] initForTouchAtPoint:CGPointMake(p.x + 80, p.y) offset:.4];
    CGPoint a = p, b = CGPointMake(p.x + 80, p.y);
    for (int index = 1; index <= 30; index++) {
        double t = index / 30.0, angle = t * M_PI / 6, radius = 40 * (1 + .5 * t);
        CGPoint c = CGPointMake(p.x + 40 + 32 * t, p.y - 20 * t);
        a = CGPointMake(c.x - cos(angle) * radius, c.y - sin(angle) * radius);
        b = CGPointMake(c.x + cos(angle) * radius, c.y + sin(angle) * radius);
        [first moveToPoint:a atOffset:.4 + t]; [second moveToPoint:b atOffset:.4 + t];
    }
    [second liftUpAtOffset:1.45];
    [first moveToPoint:CGPointMake(a.x + 16, a.y + 8) atOffset:1.8];
    [first liftUpAtOffset:1.85];
    id record = [[recordClass alloc] initWithName:@"Jolt simultaneous pan pinch rotation" interfaceOrientation:UIInterfaceOrientationPortrait];
    [record addPointerEventPath:first]; [record addPointerEventPath:second];
    if (![record respondsToSelector:@selector(synthesizeWithError:)]) return @"XCTest event synthesis is unavailable";
    NSError *error = nil;
    return [record synthesizeWithError:&error] ? nil : error.localizedDescription ?: @"XCTest event synthesis failed";
}

// A fast release followed by a stationary contact before the spring can settle.
NSString *JoltSheetInterrupt(CGPoint handle) {
    Class pathClass = NSClassFromString(@"XCPointerEventPath"), recordClass = NSClassFromString(@"XCSynthesizedEventRecord");
    if (!pathClass || !recordClass) return @"XCTest pointer-path interfaces are unavailable";
    id first = [[pathClass alloc] initForTouchAtPoint:handle offset:0];
    for (int i = 1; i <= 6; i++)
        [first moveToPoint:CGPointMake(handle.x, handle.y - i * 16) atOffset:i * .02];
    [first liftUpAtOffset:.13];
    id second = [[pathClass alloc] initForTouchAtPoint:handle offset:.17];
    [second liftUpAtOffset:.75];
    id record = [[recordClass alloc] initWithName:@"Jolt sheet fling interrupted by stationary touch" interfaceOrientation:UIInterfaceOrientationPortrait];
    [record addPointerEventPath:first]; [record addPointerEventPath:second];
    NSError *error = nil;
    return [record synthesizeWithError:&error] ? nil : error.localizedDescription ?: @"XCTest event synthesis failed";
}
