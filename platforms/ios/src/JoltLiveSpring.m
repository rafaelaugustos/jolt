#import "JoltLiveSpring.h"
#import "JoltSpringState.h"
#import <QuartzCore/QuartzCore.h>

static id decode(NSString *json) {
    return [NSJSONSerialization JSONObjectWithData:[json dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
}
static double mapped(double value, NSArray *mappings) {
    for (NSDictionary *mapping in mappings) {
        NSArray *input = mapping[@"input"], *output = mapping[@"output"];
        BOOL clamp = [mapping[@"clamp"] boolValue];
        if (clamp && value <= [input.firstObject doubleValue]) { value = [output.firstObject doubleValue]; continue; }
        if (clamp && value >= [input.lastObject doubleValue]) { value = [output.lastObject doubleValue]; continue; }
        NSUInteger index = 0;
        while (index < input.count - 2 && value > [input[index + 1] doubleValue]) index++;
        double span = [input[index + 1] doubleValue] - [input[index] doubleValue];
        double fraction = span > 0 ? (value - [input[index] doubleValue]) / span : value < [input[index] doubleValue] ? 0 : 1;
        value = [output[index] doubleValue] + ([output[index + 1] doubleValue] - [output[index] doubleValue]) * fraction;
    }
    return value;
}
static BOOL inputRunning(NSDictionary *input, double anchor, double now) {
    double repeat = [input[@"repeat"] doubleValue];
    return [input[@"running"] boolValue] && (repeat < 0 || now - anchor + [input[@"elapsed"] doubleValue] <
           [input[@"delay"] doubleValue] + [input[@"duration"] doubleValue] * (repeat + 1));
}
static double inputValue(NSDictionary *input, double anchor, double now) {
    NSArray *values = input[@"values"], *times = input[@"times"];
    if (![input[@"running"] boolValue] || values.count < 2) return [input[@"value"] doubleValue];
    if (!inputRunning(input, anchor, now)) return [input[@"to"] doubleValue];
    double time = MAX(0, now - anchor + [input[@"elapsed"] doubleValue] - [input[@"delay"] doubleValue]);
    double duration = MAX(1, [input[@"duration"] doubleValue]);
    double iteration = floor(time / duration), progress = fmod(time, duration) / duration;
    if ([input[@"reverse"] boolValue] && fmod(iteration, 2) >= 1) progress = 1 - progress;
    NSUInteger lo = 0, hi = times.count - 1;
    while (lo + 1 < hi) { NSUInteger mid = (lo + hi) / 2; if ([times[mid] doubleValue] <= progress) lo = mid; else hi = mid; }
    double start = [times[lo] doubleValue], end = [times[hi] doubleValue];
    double fraction = end > start ? (progress - start) / (end - start) : 1;
    return [values[lo] doubleValue] + ([values[hi] doubleValue] - [values[lo] doubleValue]) * MAX(0, MIN(1, fraction));
}

@interface JoltLiveSpring () {
    JoltSpringState _state;
}
@property(nonatomic) double stiffness, damping, mass, restDelta, restSpeed;
@property(nonatomic, readwrite) BOOL moving;
@property(nonatomic) BOOL reduced, paused, disposed, direct;
@property(nonatomic) double targetValue;
@property(nonatomic, nullable) JoltLiveSpring *source;
@property(nonatomic) NSArray *sourceMaps;
@property(nonatomic) NSDictionary *input;
@property(nonatomic) double anchor;
@property(nonatomic) NSMutableArray<JoltLiveSpringBinding *> *bindings;
- (void)step:(double)now seconds:(double)seconds;
- (void)apply;
- (void)wake;
@end
@interface JoltLiveSpringBinding ()
@property(nonatomic, weak) UIView *view;
@property(nonatomic, weak) JoltLiveSpring *node;
@property(nonatomic) NSString *property;
@property(nonatomic) NSArray *mappings;
@property(nonatomic) BOOL stopped;
@property(nonatomic) NSArray *sampledLayers;
@property(nonatomic) double layerAnchor;
- (BOOL)running:(double)now;
- (void)apply;
@end

@implementation JoltLiveSpring
static NSMutableArray<JoltLiveSpring *> *nodes;
static CADisplayLink *displayLink;
static double previousFrame;
+ (void)initialize {
    if (self == [JoltLiveSpring class]) nodes = [NSMutableArray new];
}
+ (void)schedule {
    if (displayLink || !nodes.count) return;
    displayLink = [CADisplayLink displayLinkWithTarget:self selector:@selector(tick:)];
    if (@available(iOS 15.0, *)) {
        float maximum = MIN(120, UIScreen.mainScreen.maximumFramesPerSecond);
        displayLink.preferredFrameRateRange = CAFrameRateRangeMake(MIN(80, maximum), maximum, maximum);
    }
    [displayLink addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
}
+ (void)tick:(CADisplayLink *)link {
    double now = link.timestamp * 1000;
    double remaining = previousFrame == 0 ? 1.0 / 120 : MIN(.064, MAX(0, link.timestamp - previousFrame));
    previousFrame = link.timestamp;
    while (remaining > 1e-9) {
        double dt = MIN(remaining, 1.0 / 240);
        remaining -= dt;
        for (JoltLiveSpring *node in nodes) [node step:now - remaining * 1000 seconds:dt];
    }
    BOOL active = NO;
    [CATransaction begin]; [CATransaction setDisableActions:YES];
    for (JoltLiveSpring *node in nodes) {
        [node apply]; active |= node.moving;
        for (JoltLiveSpringBinding *binding in node.bindings) active |= [binding running:now];
    }
    [CATransaction commit];
    if (!active) { [displayLink invalidate]; displayLink = nil; previousFrame = 0; }
}
+ (instancetype)create:(double)initial stiffness:(double)stiffness damping:(double)damping mass:(double)mass
             restDelta:(double)restDelta restSpeed:(double)restSpeed reduced:(BOOL)reduced {
    JoltLiveSpring *node = [self new];
    node->_state = (JoltSpringState){initial, 0};
    node.stiffness = stiffness; node.damping = damping; node.mass = mass;
    node.restDelta = restDelta; node.restSpeed = restSpeed; node->_reduced = reduced;
    node.direct = YES; node.targetValue = initial;
    node.bindings = [NSMutableArray new]; node.sourceMaps = @[];
    [nodes addObject:node];
    return node;
}
- (double)position { return _state.position; }
- (double)velocity { return _state.velocity; }
+ (NSUInteger)activeCount { return displayLink ? 1 : 0; }
+ (NSUInteger)nodeCount { return nodes.count; }
- (void)follow:(JoltLiveSpring *)source mappings:(NSString *)mappings {
    if (self.disposed || source.disposed || [nodes indexOfObject:source] >= [nodes indexOfObject:self])
        [NSException raise:NSInvalidArgumentException format:@"A spring can only follow an existing live node"];
    self.sourceMaps = decode(mappings); self.source = source; [self wake];
}
- (void)updateInput:(NSString *)snapshot {
    if (self.disposed) return;
    self.input = decode(snapshot); self.direct = NO; self.anchor = CACurrentMediaTime() * 1000; [self wake];
}
- (void)setTarget:(double)value {
    if (self.disposed) return;
    self.direct = YES; self.targetValue = value; self.input = nil; [self wake];
}
- (void)setReduced:(BOOL)value { _reduced = value; [self wake]; }
- (void)setPaused:(BOOL)value {
    _paused = value;
    if (value) self.moving = NO; else [self wake];
}
- (void)wake {
    if (self.disposed || self.paused) return;
    self.moving = YES;
    if (self.reduced) {
        [self step:CACurrentMediaTime() * 1000 seconds:0];
        [CATransaction begin]; [CATransaction setDisableActions:YES]; [self apply]; [CATransaction commit];
    }
    [JoltLiveSpring schedule];
}
- (void)step:(double)now seconds:(double)seconds {
    if (self.disposed || self.paused) return;
    double target = self.source ? mapped(self.source.position, self.sourceMaps) : (self.direct ? self.targetValue : inputValue(self.input, self.anchor, now));
    BOOL inputMoving = self.source ? self.source.moving : (!self.direct && inputRunning(self.input, self.anchor, now));
    if (self.reduced) _state = (JoltSpringState){target, 0};
    else _state = JoltSpringAdvance(_state, target, self.stiffness, self.damping, self.mass, seconds);
    BOOL rest = fabs(_state.position - target) <= self.restDelta && fabs(_state.velocity) <= self.restSpeed;
    if (rest && !inputMoving) _state = (JoltSpringState){target, 0};
    self.moving = inputMoving || !rest;
}
- (JoltLiveSpringBinding *)bind:(UIView *)view property:(NSString *)property mappings:(NSString *)mappings {
    if (self.disposed) [NSException raise:NSInvalidArgumentException format:@"Spring disposed"];
    JoltLiveSpringBinding *binding = [JoltLiveSpringBinding new];
    binding.node = self; binding.view = view; binding.property = property; binding.mappings = decode(mappings);
    [self.bindings addObject:binding];
    [CATransaction begin]; [CATransaction setDisableActions:YES]; [binding apply]; [CATransaction commit];
    return binding;
}
- (void)apply {
    for (NSInteger i = self.bindings.count - 1; i >= 0; i--) {
        JoltLiveSpringBinding *binding = self.bindings[i];
        if (!binding.view) [self.bindings removeObjectAtIndex:i]; else [binding apply];
    }
}
+ (void)sync:(UIView *)view {
    [CATransaction begin]; [CATransaction setDisableActions:YES];
    for (JoltLiveSpring *node in nodes)
        for (JoltLiveSpringBinding *binding in node.bindings)
            if (binding.view == view) [binding apply];
    [CATransaction commit];
}
- (void)dispose {
    if (self.disposed) return;
    self.disposed = YES; self.moving = NO; [self.bindings removeAllObjects]; [nodes removeObject:self];
    for (JoltLiveSpring *child in nodes) if (child.source == self) {
        child.source = nil; [child setTarget:mapped(self.position, child.sourceMaps)];
    }
    self.source = nil;
    if (!nodes.count) { [displayLink invalidate]; displayLink = nil; previousFrame = 0; }
}
@end

@implementation JoltLiveSpringBinding
- (double)value { return mapped(self.node.position, self.mappings); }
- (void)setLayers:(NSString *)inputs {
    self.sampledLayers = decode(inputs); self.layerAnchor = CACurrentMediaTime() * 1000;
    [CATransaction begin]; [CATransaction setDisableActions:YES]; [self apply]; [CATransaction commit];
    [JoltLiveSpring schedule];
}
- (BOOL)running:(double)now {
    for (NSDictionary *layer in self.sampledLayers) if (inputRunning(layer, self.layerAnchor, now)) return YES;
    return NO;
}
- (void)cancel { self.stopped = YES; [self.node.bindings removeObject:self]; }
- (void)apply {
    UIView *view = self.view;
    if (self.stopped || !view.window) return;
    NSString *key = self.property;
    double value = self.value;
    BOOL multiply = [key isEqualToString:@"opacity"] || [key hasPrefix:@"scale"];
    double now = CACurrentMediaTime() * 1000;
    for (NSDictionary *layer in self.sampledLayers) {
        double part = inputValue(layer, self.layerAnchor, now);
        value = multiply ? value * part : value + part;
    }
    if ([key isEqualToString:@"opacity"]) { view.alpha = MAX(0, MIN(1, value)); return; }
    if ([key isEqualToString:@"x"]) key = @"transform.translation.x";
    else if ([key isEqualToString:@"y"]) key = @"transform.translation.y";
    else if ([key isEqualToString:@"scaleX"]) key = @"transform.scale.x";
    else if ([key isEqualToString:@"scaleY"]) key = @"transform.scale.y";
    else if ([key isEqualToString:@"rotate"]) { key = @"transform.rotation.z"; value *= M_PI / 180; }
    else if ([key isEqualToString:@"rotateX"]) { key = @"transform.rotation.x"; value *= M_PI / 180; }
    else if ([key isEqualToString:@"rotateY"]) { key = @"transform.rotation.y"; value *= M_PI / 180; }
    [view.layer setValue:@(value) forKeyPath:key];
    if ([view respondsToSelector:NSSelectorFromString(@"outerShadowContainerLayer")]) {
        CALayer *shadow = [view valueForKey:@"outerShadowContainerLayer"];
        [shadow setValue:@(value) forKeyPath:key];
    }
}
@end
