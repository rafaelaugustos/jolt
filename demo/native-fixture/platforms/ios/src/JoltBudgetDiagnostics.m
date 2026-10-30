#import "JoltBudgetDiagnostics.h"
#import <UIKit/UIGestureRecognizerSubclass.h>
#import <QuartzCore/QuartzCore.h>
#import <malloc/malloc.h>
#include <unistd.h>

static NSString *JSON(id value) {
    return [[NSString alloc] initWithData:[NSJSONSerialization dataWithJSONObject:value options:0 error:nil] encoding:NSUTF8StringEncoding];
}
@interface JoltBudgetInputProbe () {
    double _rows[4096][5]; NSUInteger _count, _overflow;
}
@property(nonatomic) NSInteger delayMs;
@property(nonatomic) BOOL delayed, stopped;
@property(nonatomic) double workMs;
@property(nonatomic) CGPoint down;
@end
@implementation JoltBudgetInputProbe
+ (instancetype)watch:(UIView *)surface delay:(NSInteger)milliseconds {
    NSParameterAssert(milliseconds == 0 || milliseconds == 40);
    JoltBudgetInputProbe *probe = [self new]; probe.delayMs = milliseconds;
    probe.cancelsTouchesInView = NO; probe.delaysTouchesBegan = NO; probe.delaysTouchesEnded = NO;
    [surface addGestureRecognizer:probe]; return probe;
}
- (BOOL)canPreventGestureRecognizer:(UIGestureRecognizer *)other { return NO; }
- (BOOL)canBePreventedByGestureRecognizer:(UIGestureRecognizer *)other { return NO; }
- (void)record:(NSSet<UITouch *> *)touches action:(NSInteger)action {
    if (self.stopped) return;
    double begin = CACurrentMediaTime() * 1000;
    UITouch *touch = touches.anyObject; CGPoint point = [touch locationInView:nil];
    if (action == 0) self.down = point;
    if (_count < 4096) {
        double *r = _rows[_count++]; r[0] = touch.timestamp * 1000; r[1] = begin;
        r[2] = action; r[3] = point.x; r[4] = point.y;
    } else _overflow++;
    if (action == 2 && self.delayMs && !self.delayed && !CGPointEqualToPoint(point, self.down)) { self.delayed = YES; usleep((useconds_t)self.delayMs * 1000); }
    self.workMs += CACurrentMediaTime() * 1000 - begin;
}
- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event { self.delayed = NO; [self record:touches action:0]; }
- (void)touchesMoved:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event { [self record:touches action:2]; }
- (void)touchesEnded:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event { [self record:touches action:1]; self.state = UIGestureRecognizerStateFailed; }
- (void)touchesCancelled:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event { [self record:touches action:3]; self.state = UIGestureRecognizerStateFailed; }
- (void)cancel { if (self.stopped) return; self.stopped = YES; [self.view removeGestureRecognizer:self]; }
- (NSString *)finish {
    [self cancel]; NSMutableArray *events = [NSMutableArray arrayWithCapacity:_count];
    for (NSUInteger i = 0; i < _count; i++) { double *r = _rows[i]; [events addObject:@[@(r[0]), @(r[1]), @(r[2]), @(r[3]), @(r[4])]]; }
    return JSON(@{@"columns": @[@"eventMs", @"dispatchMs", @"action", @"x", @"y"], @"events": events,
        @"overflow": @(_overflow), @"workMs": @(self.workMs), @"delayMs": @(self.delayMs), @"clock": @"uptime-ms"});
}
@end

@interface JoltBudgetRetention ()
@property(nonatomic, strong) NSHashTable<UIView *> *targets;
@property(nonatomic) NSUInteger watched;
@end
@implementation JoltBudgetRetention
- (instancetype)init { if ((self = [super init])) _targets = [NSHashTable weakObjectsHashTable]; return self; }
- (void)watch:(UIView *)view { [self.targets addObject:view]; self.watched++; }
- (void)reset { [self.targets removeAllObjects]; self.watched = 0; }
- (NSString *)snapshot {
    malloc_statistics_t stats = {0}; malloc_zone_statistics(NULL, &stats);
    return JSON(@{@"timeMs": @(CACurrentMediaTime() * 1000), @"watched": @(self.watched), @"alive": @(self.targets.allObjects.count),
        @"mallocInUseBytes": @(stats.size_in_use), @"mallocBlocksInUse": @(stats.blocks_in_use), @"mallocReservedBytes": @(stats.size_allocated)});
}
@end
