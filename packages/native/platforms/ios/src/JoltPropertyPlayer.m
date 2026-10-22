#import "JoltPropertyPlayer.h"
#import <QuartzCore/QuartzCore.h>
#import <UIKit/UIKit.h>
#import <objc/runtime.h>

@interface JoltPropertySink ()
@property(nonatomic, weak, readwrite) NSObject *target;
@property(nonatomic, readwrite) NSUInteger dimensions;
@end
@interface JoltScalarSink : JoltPropertySink
@property(nonatomic, copy) NSString *keyPath;
+ (instancetype)target:(NSObject *)target keyPath:(NSString *)keyPath;
@end
@implementation JoltPropertySink
- (instancetype)initWithTarget:(NSObject *)target dimensions:(NSUInteger)dimensions {
    if ((self = [super init])) { _target = target; _dimensions = dimensions; }
    return self;
}
+ (instancetype)scalarTarget:(NSObject *)target keyPath:(NSString *)keyPath { return [JoltScalarSink target:target keyPath:keyPath]; }
- (BOOL)alive { return self.target != nil; }
- (BOOL)compiled { return class_getImageName(self.class) != NULL; }
- (NSArray<NSNumber *> *)read { [self doesNotRecognizeSelector:_cmd]; return @[]; }
- (void)write:(NSArray<NSNumber *> *)values { [self doesNotRecognizeSelector:_cmd]; }
- (void)dispose { self.target = nil; }
@end

@implementation JoltScalarSink
+ (instancetype)target:(NSObject *)target keyPath:(NSString *)keyPath {
    JoltScalarSink *sink = [[self alloc] initWithTarget:target dimensions:1]; sink.keyPath = keyPath;
    NSAssert([[target valueForKeyPath:keyPath] isKindOfClass:NSNumber.class], @"Expected a numeric native property");
    return sink;
}
- (NSArray<NSNumber *> *)read { return @[[self.target valueForKeyPath:self.keyPath] ?: @0]; }
- (void)write:(NSArray<NSNumber *> *)values {
    [CATransaction begin]; [CATransaction setDisableActions:YES];
    [self.target setValue:values[0] forKeyPath:self.keyPath];
    [CATransaction commit];
}
@end

@interface JoltPropertyPlayer ()
@property(nonatomic, strong, nullable) JoltPropertySink *sink;
@property(nonatomic, copy) NSArray<NSNumber *> *times, *values, *finalValue;
@property(nonatomic) double duration, delay, repeats, anchor, offset;
@property(nonatomic) BOOL reverse, paused, stopped, ended;
@property(nonatomic, readwrite) NSUInteger frames;
@property(nonatomic, copy, nullable) void (^completion)(BOOL);
@end
@implementation JoltPropertyPlayer
static NSMutableSet<JoltPropertyPlayer *> *playing;
static CADisplayLink *displayLink;
+ (void)initialize { if (self == JoltPropertyPlayer.class) playing = [NSMutableSet new]; }
+ (void)schedule {
    if (playing.count && !displayLink) {
        displayLink = [CADisplayLink displayLinkWithTarget:self selector:@selector(tick:)];
        if (@available(iOS 15.0, *)) {
            float rate = MIN(120, UIScreen.mainScreen.maximumFramesPerSecond);
            displayLink.preferredFrameRateRange = CAFrameRateRangeMake(MIN(80, rate), rate, rate);
        }
        [displayLink addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
    } else if (!playing.count) { [displayLink invalidate]; displayLink = nil; }
}
+ (void)tick:(CADisplayLink *)frame {
    for (JoltPropertyPlayer *player in playing.allObjects) {
        if (!player.sink.alive) { [player end:NO]; continue; }
        [player apply:player.elapsed];
        if (isfinite(player.repeats) && player.elapsed >= player.delay + player.duration * (player.repeats + 1)) [player end:YES];
    }
}
+ (instancetype)startSink:(JoltPropertySink *)sink times:(NSArray<NSNumber *> *)times
                   values:(NSArray<NSNumber *> *)values finalValue:(NSArray<NSNumber *> *)finalValue
                 duration:(double)duration delay:(double)delay repeat:(double)repeat reverse:(BOOL)reverse
               completion:(void (^)(BOOL))completion {
    NSParameterAssert(NSThread.isMainThread);
    NSParameterAssert(sink.compiled && sink.dimensions && values.count == times.count * sink.dimensions && finalValue.count == sink.dimensions);
    JoltPropertyPlayer *player = [self new];
    player.sink = sink; player.times = times; player.values = values; player.finalValue = finalValue;
    player.duration = MAX(0.001, duration); player.delay = delay; player.repeats = repeat; player.reverse = reverse;
    player.anchor = CACurrentMediaTime() * 1000; player.completion = completion;
    [player apply:0];
    if (!player.ended) { [playing addObject:player]; [self schedule]; }
    return player;
}
- (double)elapsed { return self.offset + (self.paused ? 0 : CACurrentMediaTime() * 1000 - self.anchor); }
- (void)apply:(double)elapsed {
    if (self.stopped || !self.sink.alive) return;
    @try {
        if (isfinite(self.repeats) && elapsed >= self.delay + self.duration * (self.repeats + 1)) {
            [self.sink write:self.finalValue]; self.frames++; return;
        }
        double time = MAX(0, elapsed - self.delay), iteration = floor(time / self.duration);
        double progress = fmod(time, self.duration) / self.duration;
        if (self.reverse && fmod(iteration, 2) >= 1) progress = 1 - progress;
        NSUInteger low = 0, high = self.times.count - 1;
        while (low + 1 < high) {
            NSUInteger mid = (low + high) / 2;
            if (self.times[mid].doubleValue <= progress) low = mid; else high = mid;
        }
        double start = self.times[low].doubleValue, finish = self.times[high].doubleValue;
        double t = finish > start ? MIN(1, MAX(0, (progress-start)/(finish-start))) : 1;
        NSUInteger n = self.sink.dimensions;
        NSMutableArray *value = [NSMutableArray arrayWithCapacity:n];
        for (NSUInteger i=0; i<n; i++) {
            double a=self.values[low*n+i].doubleValue, b=self.values[high*n+i].doubleValue;
            [value addObject:@(a+(b-a)*t)];
        }
        [self.sink write:value]; self.frames++;
    } @catch (NSException *exception) { NSLog(@"Jolt native property failed: %@", exception.reason); [self end:NO]; }
}
- (void)control:(double)elapsed paused:(BOOL)paused {
    if (self.stopped) return;
    self.offset=elapsed; self.anchor=CACurrentMediaTime()*1000; self.paused=paused; self.ended=NO;
    [self apply:elapsed];
    if (paused || self.ended) [playing removeObject:self]; else [playing addObject:self];
    [JoltPropertyPlayer schedule];
}
- (void)end:(BOOL)completed {
    if (self.ended || self.stopped) return;
    self.ended=YES;
    [playing removeObject:self]; [JoltPropertyPlayer schedule];
    if (self.completion) self.completion(completed);
}
- (void)cancel {
    if (self.stopped) return;
    self.stopped=YES; self.completion=nil;
    [playing removeObject:self]; self.sink=nil;
    [JoltPropertyPlayer schedule];
}
+ (NSUInteger)activeCount { return playing.count; }
@end
