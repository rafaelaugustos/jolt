#import "JoltBudgetProbe.h"
#import <QuartzCore/QuartzCore.h>
#import <mach/mach.h>
#import <sys/resource.h>
#import <sys/utsname.h>

// Fixed storage bounds both recorder overhead and retained evidence. Overflow fails verification.
enum { BudgetCapacity = 4096 };
typedef struct { double time, timestamp, target, x, scale, y; } BudgetFrame;
static NSString *BudgetJSON(id object) {
    NSData *data = [NSJSONSerialization dataWithJSONObject:object options:0 error:nil];
    return data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] : @"{}";
}
static NSDictionary *BudgetResources(void) {
    struct rusage usage = {0};
    int cpuStatus = getrusage(RUSAGE_SELF, &usage);
    task_vm_info_data_t info = {0};
    mach_msg_type_number_t size = TASK_VM_INFO_COUNT;
    kern_return_t memoryStatus = task_info(mach_task_self(), TASK_VM_INFO, (task_info_t)&info, &size);
    return @{@"timeMs": @(CACurrentMediaTime() * 1000),
             @"cpuMs": cpuStatus == 0 ? @((usage.ru_utime.tv_sec + usage.ru_stime.tv_sec) * 1000.0 + (usage.ru_utime.tv_usec + usage.ru_stime.tv_usec) / 1000.0) : [NSNull null],
             @"memoryBytes": memoryStatus == KERN_SUCCESS ? @(info.phys_footprint) : [NSNull null],
             @"memoryMetric": @"phys_footprint",
             @"thermalState": @(NSProcessInfo.processInfo.thermalState),
             @"lowPowerMode": @(NSProcessInfo.processInfo.lowPowerModeEnabled)};
}

@interface JoltBudgetProbe () {
    BudgetFrame _frames[BudgetCapacity];
    NSUInteger _count, _overflow;
}
@property(nonatomic, strong) CADisplayLink *link;
@property(nonatomic, weak) UIView *target;
@property(nonatomic, strong) NSDictionary *before;
@property(nonatomic, strong) NSString *result;
@property(nonatomic) double sampledPeakBytes, lastMemoryMs, probeWorkMs;
@property(nonatomic) NSUInteger memorySamples;
@end

@implementation JoltBudgetProbe
+ (NSString *)environment {
    struct utsname system; uname(&system);
    return BudgetJSON(@{@"physical": @(!TARGET_OS_SIMULATOR),
        @"model": [NSString stringWithUTF8String:system.machine],
        @"os": UIDevice.currentDevice.systemVersion,
        @"osBuild": NSProcessInfo.processInfo.operatingSystemVersionString,
        @"maximumRefreshHz": @(UIScreen.mainScreen.maximumFramesPerSecond),
        @"reduceMotion": @(UIAccessibilityIsReduceMotionEnabled()),
        @"minimumFrameDurationDisabled": @([[NSBundle.mainBundle objectForInfoDictionaryKey:@"CADisableMinimumFrameDurationOnPhone"] boolValue]),
        @"resources": BudgetResources()});
}
+ (NSString *)resources { return BudgetJSON(BudgetResources()); }
+ (instancetype)start:(UIView *)target {
    JoltBudgetProbe *probe = [JoltBudgetProbe new];
    probe.target = target;
    probe.before = BudgetResources();
    probe.sampledPeakBytes = [probe.before[@"memoryBytes"] doubleValue];
    probe.lastMemoryMs = [probe.before[@"timeMs"] doubleValue];
    probe.memorySamples = 1;
    probe.link = [CADisplayLink displayLinkWithTarget:probe selector:@selector(tick:)];
    // Observe the app's default cadence. Do not force ProMotion on for the benchmark.
    [probe.link addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
    return probe;
}
- (void)tick:(CADisplayLink *)link {
    double begin = CACurrentMediaTime() * 1000;
    if (_count == BudgetCapacity) { _overflow++; return; }
    CALayer *layer = self.target.layer.presentationLayer ?: self.target.layer;
    CATransform3D transform = layer.transform;
    _frames[_count++] = (BudgetFrame){ CACurrentMediaTime() * 1000,
        link.timestamp * 1000, link.targetTimestamp * 1000,
        transform.m41, hypot(transform.m11, transform.m12), transform.m42 };
    if (begin - self.lastMemoryMs >= 500) {
        self.sampledPeakBytes = MAX(self.sampledPeakBytes, [BudgetResources()[@"memoryBytes"] doubleValue]);
        self.lastMemoryMs = begin; self.memorySamples++;
    }
    self.probeWorkMs += CACurrentMediaTime() * 1000 - begin;
}
- (NSString *)finish {
    if (self.result) return self.result;
    [self.link invalidate]; self.link = nil;
    NSDictionary *after = BudgetResources();
    self.sampledPeakBytes = MAX(self.sampledPeakBytes, [after[@"memoryBytes"] doubleValue]);
    NSMutableArray *samples = [NSMutableArray arrayWithCapacity:_count];
    for (NSUInteger i = 0; i < _count; i++) {
        BudgetFrame f = _frames[i];
        [samples addObject:@[@(f.time), @(f.timestamp), @(f.target), @(f.x), @(f.scale), @(f.y)]];
    }
    self.result = BudgetJSON(@{@"before": self.before, @"after": after,
        @"frameMetric": @"display-link-opportunities-not-presented-frames",
        @"columns": @[@"callbackMs", @"timestampMs", @"targetMs", @"xDip", @"scaleX", @"yDip"],
        @"frames": samples, @"overflow": @(_overflow),
        @"sampledPeakMemoryBytes": @(self.sampledPeakBytes), @"memorySamples": @(self.memorySamples + 1),
        @"probeWorkMs": @(self.probeWorkMs)});
    self.target = nil;
    return self.result;
}
- (void)cancel { [self.link invalidate]; self.link = nil; self.target = nil; }
- (void)dealloc { [_link invalidate]; }
@end
