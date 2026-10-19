#import "JoltInteractiveAnimation.h"
#import <QuartzCore/QuartzCore.h>

@interface JoltInteractiveAnimation ()
@property(nonatomic, weak) UIView *view;
@property(nonatomic, copy) NSArray<CALayer *> *layers;
@property(nonatomic, copy) NSString *keyPath;
@property(nonatomic, copy) NSArray<NSNumber *> *values;
@property(nonatomic, copy) NSArray<NSNumber *> *times;
@property(nonatomic) double duration, delay, repeats, anchor, offset, finalValue;
@property(nonatomic) BOOL reverse, paused, stopped;
@property(nonatomic, copy, nullable) void (^completion)(BOOL);
@end

@implementation JoltInteractiveAnimation
static NSMapTable<UIView *, NSMutableDictionary<NSString *, JoltInteractiveAnimation *> *> *views;
static NSMutableSet<JoltInteractiveAnimation *> *playing;
static CADisplayLink *displayLink;

+ (void)initialize {
    if (self != [JoltInteractiveAnimation class]) return;
    views = [NSMapTable weakToStrongObjectsMapTable];
    playing = [NSMutableSet new];
}
+ (void)schedule {
    if (playing.count && !displayLink) {
        displayLink = [CADisplayLink displayLinkWithTarget:self selector:@selector(tick:)];
        if (@available(iOS 15.0, *)) {
            float maximum = MIN(120, UIScreen.mainScreen.maximumFramesPerSecond);
            displayLink.preferredFrameRateRange = CAFrameRateRangeMake(MIN(80, maximum), maximum, maximum);
        }
        [displayLink addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
    } else if (!playing.count && displayLink) {
        [displayLink invalidate]; displayLink = nil;
    }
}
+ (void)tick:(CADisplayLink *)link {
    for (JoltInteractiveAnimation *track in playing.allObjects) {
        if (track.stopped || track.paused) continue;
        if (!track.view) { [track finish:NO]; continue; }
        double elapsed = track.elapsed;
        [track apply:elapsed];
        if (isfinite(track.repeats) && elapsed >= track.delay + track.duration * (track.repeats + 1))
            [track finish:YES];
    }
}
+ (instancetype)startView:(UIView *)view layers:(NSArray<CALayer *> *)layers keyPath:(NSString *)keyPath
                  values:(NSArray<NSNumber *> *)values times:(NSArray<NSNumber *> *)times
                duration:(double)duration delay:(double)delay repeat:(double)repeat
                 reverse:(BOOL)reverse finalValue:(double)finalValue
               startedAt:(double)startedAt completion:(void (^)(BOOL))completion {
    JoltInteractiveAnimation *track = [self new];
    track.view = view; track.layers = layers; track.keyPath = keyPath; track.values = values; track.times = times;
    track.duration = MAX(1, duration); track.delay = delay; track.repeats = repeat;
    track.reverse = reverse; track.finalValue = finalValue;
    track.anchor = startedAt; track.completion = completion;
    NSMutableDictionary *properties = [views objectForKey:view];
    if (!properties) { properties = [NSMutableDictionary new]; [views setObject:properties forKey:view]; }
    JoltInteractiveAnimation *previous = properties[keyPath];
    [previous cancel];
    // Cancelling the last property can remove the dictionary from the weak map.
    [views setObject:properties forKey:view];
    properties[keyPath] = track;
    [track apply:track.elapsed];
    [playing addObject:track]; [self schedule];
    return track;
}
- (double)elapsed { return self.offset + (self.paused ? 0 : CACurrentMediaTime() * 1000 - self.anchor); }
- (double)value:(double)elapsed {
    double total = self.delay + self.duration * (self.repeats + 1);
    if (isfinite(total) && elapsed >= total) return self.finalValue;
    double time = MAX(0, elapsed - self.delay);
    double iteration = floor(time / self.duration);
    double progress = fmod(time, self.duration) / self.duration;
    if (self.reverse && fmod(iteration, 2) >= 1) progress = 1 - progress;
    NSUInteger low = 0, high = self.times.count - 1;
    while (low + 1 < high) {
        NSUInteger middle = (low + high) / 2;
        if (self.times[middle].doubleValue <= progress) low = middle; else high = middle;
    }
    double start = self.times[low].doubleValue, end = self.times[high].doubleValue;
    double fraction = end > start ? MIN(1, MAX(0, (progress - start) / (end - start))) : 1;
    return self.values[low].doubleValue + (self.values[high].doubleValue - self.values[low].doubleValue) * fraction;
}
- (void)apply:(double)elapsed {
    UIView *view = self.view;
    if (!view || self.stopped) return;
    double value = [self value:elapsed];
    [CATransaction begin]; [CATransaction setDisableActions:YES];
    if ([self.keyPath isEqualToString:@"opacity"]) view.alpha = value;
    for (CALayer *layer in self.layers) [layer setValue:@(value) forKeyPath:self.keyPath];
    [CATransaction commit];
}
- (void)control:(double)elapsed paused:(BOOL)paused {
    if (self.stopped) return;
    self.offset = elapsed; self.anchor = CACurrentMediaTime() * 1000; self.paused = paused;
    [self apply:elapsed];
    if (paused) [playing removeObject:self]; else [playing addObject:self];
    [[self class] schedule];
}
- (void)finish:(BOOL)completed {
    if (self.stopped) return;
    self.stopped = YES;
    [playing removeObject:self];
    UIView *view = self.view;
    NSMutableDictionary *properties = view ? [views objectForKey:view] : nil;
    if (properties[self.keyPath] == self) [properties removeObjectForKey:self.keyPath];
    if (view && !properties.count) [views removeObjectForKey:view];
    void (^callback)(BOOL) = self.completion; self.completion = nil;
    [[self class] schedule];
    if (callback) callback(completed);
}
- (void)cancel { [self finish:NO]; }
+ (void)syncView:(UIView *)view excluding:(NSString *)keyPath {
    for (JoltInteractiveAnimation *track in [views objectForKey:view].allValues)
        if (![track.keyPath isEqualToString:keyPath]) [track apply:track.elapsed];
}
+ (NSNumber *)valueForView:(UIView *)view keyPath:(NSString *)keyPath {
    JoltInteractiveAnimation *track = [views objectForKey:view][keyPath];
    return track ? [view.layer valueForKeyPath:keyPath] : nil;
}
+ (NSUInteger)activeCount { return playing.count; }
@end
