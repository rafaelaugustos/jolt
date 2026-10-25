#import "JoltMotionProbe.h"
#import <QuartzCore/QuartzCore.h>
#include <math.h>

static NSInteger probeCount = 0;
@interface JoltMotionProbe () {
    double *_rows;
}
@property(nonatomic, weak) UIView *view;
@property(nonatomic) CADisplayLink *link;
@property(nonatomic) NSInteger capacity, count, head, dropped, samples;
@property(nonatomic) double interval, last, sampleCPU, drainCPU;
@end

@implementation JoltMotionProbe
+ (NSInteger)activeCount { return probeCount; }
+ (instancetype)startView:(UIView *)view capacity:(NSInteger)capacity hertz:(double)hertz {
    JoltMotionProbe *p = [JoltMotionProbe new];
    p.view = view; p.capacity = MAX(8, MIN(600, capacity));
    p.interval = 1000.0 / MAX(1, MIN(120, hertz)); p.last = -INFINITY;
    p->_rows = calloc(p.capacity * 9, sizeof(double));
    p.link = [CADisplayLink displayLinkWithTarget:p selector:@selector(frame:)];
    if (@available(iOS 15.0, *)) {
        float rate = MIN(hertz, view.window.screen.maximumFramesPerSecond ?: 60);
        p.link.preferredFrameRateRange = CAFrameRateRangeMake(rate, rate, rate);
    }
    [p.link addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
    [[NSNotificationCenter defaultCenter] addObserver:p selector:@selector(dispose) name:UIApplicationDidEnterBackgroundNotification object:nil];
    probeCount++; return p;
}
- (void)frame:(CADisplayLink *)link {
    if (!self.view.window) { [self dispose]; return; }
    double begin = CACurrentMediaTime() * 1000;
    if (begin - self.last < self.interval - 0.5) return;
    self.last = begin;
    NSInteger slot;
    if (self.count == self.capacity) {
        slot = self.head; self.head = (self.head + 1) % self.capacity; self.dropped++;
    } else { slot = (self.head + self.count) % self.capacity; self.count++; }
    double *row = _rows + slot * 9; row[0] = begin;
    CALayer *layer = self.view.layer.presentationLayer;
    static NSArray<NSString *> *paths;
    static dispatch_once_t once;
    dispatch_once(&once, ^{ paths = @[@"transform.translation.x", @"transform.translation.y", @"transform.scale.x", @"transform.scale.y", @"transform.rotation.z", @"transform.rotation.x", @"transform.rotation.y", @"opacity"]; });
    for (NSInteger i = 0; i < 8; i++) {
        // Missing presentation is explicitly unavailable, never replaced with the model layer.
        row[i + 1] = layer ? [[layer valueForKeyPath:paths[i]] doubleValue] : NAN;
        if (i >= 4 && i <= 6) row[i + 1] *= 180.0 / M_PI;
    }
    self.samples++; self.sampleCPU += CACurrentMediaTime() * 1000 - begin;
}
- (NSString *)drain {
    double begin = CACurrentMediaTime() * 1000;
    NSMutableArray *out = [NSMutableArray arrayWithCapacity:self.count];
    for (NSInteger i = 0; i < self.count; i++) {
        double *row = _rows + ((self.head + i) % self.capacity) * 9;
        NSMutableArray *values = [NSMutableArray arrayWithCapacity:9];
        for (NSInteger j = 0; j < 9; j++) [values addObject:isfinite(row[j]) ? @(row[j]) : NSNull.null];
        [out addObject:values];
    }
    self.count = 0; self.head = 0;
    NSDictionary *result = @{@"rows":out, @"dropped":@(self.dropped), @"samples":@(self.samples), @"sampleCpuMs":@(self.sampleCPU), @"drainCpuMs":@(self.drainCPU), @"active":@(self.link != nil)};
    NSString *json = [[NSString alloc] initWithData:[NSJSONSerialization dataWithJSONObject:result options:0 error:nil] encoding:NSUTF8StringEncoding];
    self.drainCPU += CACurrentMediaTime() * 1000 - begin;
    return json;
}
- (void)dispose {
    if (self.link) { [self.link invalidate]; self.link = nil; probeCount--; }
    [[NSNotificationCenter defaultCenter] removeObserver:self]; self.view = nil;
}
- (void)dealloc { free(_rows); }
@end
