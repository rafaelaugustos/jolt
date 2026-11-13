#import "JoltLiveSpring.h"
#import "JoltScalarProgram.h"
#import "JoltImageEffect.h"
#import "JoltSpringState.h"
#import "JoltColorMath.h"
#import "JoltLivePaint.h"
#import <QuartzCore/QuartzCore.h>

/* Sampled inputs and mappings are decoded once; frames read plain C arrays. */
typedef struct {
    double value, elapsed, duration, delay, repeat, to;
    BOOL reverse, playing;
    NSUInteger count;
    double *times, *values;
} JoltSampled;
typedef struct {
    NSUInteger count;
    double *input, *output;
    BOOL clamp;
    JoltColorStop *colors;
} JoltMapping;

static id decode(NSString *json) {
    return [NSJSONSerialization JSONObjectWithData:[json dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
}
static double *doubles(NSArray *numbers, NSUInteger count) {
    double *result = malloc(sizeof(double) * MAX(1, count));
    for (NSUInteger i = 0; i < count; i++) result[i] = [numbers[i] doubleValue];
    return result;
}
static JoltSampled *decodeSampled(NSArray *list, NSUInteger *count) {
    *count = list.count;
    if (!*count) return NULL;
    JoltSampled *result = calloc(*count, sizeof(JoltSampled));
    for (NSUInteger i = 0; i < *count; i++) {
        NSDictionary *input = list[i];
        NSArray *values = input[@"values"], *times = input[@"times"];
        JoltSampled *s = &result[i];
        s->value = [input[@"value"] doubleValue]; s->elapsed = [input[@"elapsed"] doubleValue];
        s->duration = [input[@"duration"] doubleValue]; s->delay = [input[@"delay"] doubleValue];
        s->repeat = [input[@"repeat"] doubleValue]; s->to = [input[@"to"] doubleValue];
        s->reverse = [input[@"reverse"] boolValue]; s->playing = [input[@"running"] boolValue];
        s->count = MIN(values.count, times.count);
        s->times = doubles(times, s->count);
        s->values = doubles(values, s->count);
    }
    return result;
}
static void freeSampled(JoltSampled *list, NSUInteger count) {
    for (NSUInteger i = 0; i < count; i++) { free(list[i].times); free(list[i].values); }
    free(list);
}
static BOOL sampledRunning(const JoltSampled *s, double anchor, double now) {
    return s->playing && (s->repeat < 0 || now - anchor + s->elapsed < s->delay + s->duration * (s->repeat + 1));
}
static double sampledValue(const JoltSampled *s, double anchor, double now) {
    if (!s->playing || s->count < 2) return s->value;
    if (!sampledRunning(s, anchor, now)) return s->to;
    double time = MAX(0, now - anchor + s->elapsed - s->delay);
    double duration = MAX(1, s->duration);
    double iteration = floor(time / duration), progress = fmod(time, duration) / duration;
    if (s->reverse && fmod(iteration, 2) >= 1) progress = 1 - progress;
    NSUInteger lo = 0, hi = s->count - 1;
    while (lo + 1 < hi) { NSUInteger mid = (lo + hi) / 2; if (s->times[mid] <= progress) lo = mid; else hi = mid; }
    double start = s->times[lo], end = s->times[hi];
    double fraction = end > start ? (progress - start) / (end - start) : 1;
    return s->values[lo] + (s->values[hi] - s->values[lo]) * MAX(0, MIN(1, fraction));
}
static JoltMapping *decodeMappings(NSString *json, NSUInteger *count) {
    NSArray *list = decode(json);
    *count = list.count;
    if (!*count) return NULL;
    JoltMapping *result = calloc(*count, sizeof(JoltMapping));
    for (NSUInteger i = 0; i < *count; i++) {
        NSDictionary *mapping = list[i];
        NSArray *input = mapping[@"input"], *output = mapping[@"output"];
        result[i].count = MIN(input.count, output.count);
        result[i].input = doubles(input, result[i].count);
        result[i].output = doubles(output, result[i].count);
        result[i].clamp = [mapping[@"clamp"] boolValue];
        if ([mapping[@"color"] boolValue]) {
            result[i].colors = calloc(result[i].count, sizeof(JoltColorStop));
            for (NSUInteger j=0; j<result[i].count; j++) result[i].colors[j] = JoltColorDecode((uint32_t)result[i].output[j]);
        }
    }
    return result;
}
static void freeMappings(JoltMapping *maps, NSUInteger count) {
    for (NSUInteger i = 0; i < count; i++) { free(maps[i].input); free(maps[i].output); free(maps[i].colors); }
    free(maps);
}
static double mapped(double value, const JoltMapping *maps, NSUInteger count) {
    for (NSUInteger m = 0; m < count; m++) {
        const JoltMapping *mapping = &maps[m];
        if (mapping->count < 2) continue;
        if (mapping->clamp && value <= mapping->input[0]) { value = mapping->output[0]; continue; }
        if (mapping->clamp && value >= mapping->input[mapping->count - 1]) { value = mapping->output[mapping->count - 1]; continue; }
        NSUInteger index = 0;
        while (index < mapping->count - 2 && value > mapping->input[index + 1]) index++;
        double span = mapping->input[index + 1] - mapping->input[index];
        double fraction = span > 0 ? (value - mapping->input[index]) / span : value < mapping->input[index] ? 0 : 1;
        value = mapping->colors ? JoltColorMix(mapping->colors[index], mapping->colors[index+1], fraction)
            : mapping->output[index] + (mapping->output[index + 1] - mapping->output[index]) * fraction;
    }
    return value;
}

@protocol JoltShadowedView
- (CALayer *)outerShadowContainerLayer;
@end

@interface JoltLiveSpring () {
    JoltSpringState _state;
    double *_graphValues, *_graphVelocities;
    JoltSampled *_inputs;
    NSUInteger _inputCount;
    JoltMapping *_sourceMaps;
    NSUInteger _sourceMapCount;
}
@property(nonatomic) double stiffness, damping, mass, restDelta, restSpeed;
@property(nonatomic, readwrite) BOOL moving;
@property(nonatomic) BOOL reduced, paused, disposed, direct, inputHeld, sensorDriven;
@property(nonatomic) double targetValue, dataTime;
@property(nonatomic) BOOL dataInput;
@property(nonatomic, nullable) JoltLiveSpring *source;
@property(nonatomic) NSArray<JoltLiveSpring *> *graphSources;
@property(nonatomic) JoltScalarProgram *graph;
@property(nonatomic) double inputRest, anchor;
@property(nonatomic) NSMutableArray<JoltLiveSpringBinding *> *bindings;
- (void)step:(double)now seconds:(double)seconds;
- (void)apply;
- (void)wake;
@end
@interface JoltLiveSpringBinding () {
    JoltMapping *_maps;
    NSUInteger _mapCount;
    JoltSampled *_layers;
    NSUInteger _layerCount;
}
@property(nonatomic, weak) JoltImageEffect *imageEffect;
@property(nonatomic) JoltLivePaint *paint;
@property(nonatomic, weak) UIView *view;
@property(nonatomic, weak) JoltLiveSpring *node;
@property(nonatomic) NSString *property, *keyPath;
@property(nonatomic) BOOL stopped, multiply, radians, alpha, shadowed, color, radius;
@property(nonatomic) double layerAnchor;
- (void)useMappings:(NSString *)mappings;
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
        // An instant node only needs the frame's final time; springs integrate every substep.
        for (JoltLiveSpring *node in nodes)
            if (!node.reduced || remaining <= 1e-9) [node step:now - remaining * 1000 seconds:dt];
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
    node.bindings = [NSMutableArray new];
    [nodes addObject:node];
    return node;
}
- (void)dealloc {
    free(_graphValues); free(_graphVelocities);
    freeSampled(_inputs, _inputCount);
    freeMappings(_sourceMaps, _sourceMapCount);
}
- (double)position { return _state.position; }
- (double)velocity { return _state.velocity; }
+ (NSUInteger)activeCount { return displayLink ? 1 : 0; }
+ (NSUInteger)nodeCount { return nodes.count; }
- (void)replaceInputs:(NSArray *)list rest:(double)rest {
    freeSampled(_inputs, _inputCount);
    _inputs = decodeSampled(list, &_inputCount);
    self.inputRest = rest; self.anchor = CACurrentMediaTime() * 1000;
}
- (void)follow:(JoltLiveSpring *)source mappings:(NSString *)mappings {
    if (self.disposed || source.disposed || [nodes indexOfObject:source] >= [nodes indexOfObject:self])
        [NSException raise:NSInvalidArgumentException format:@"A spring can only follow an existing live node"];
    freeMappings(_sourceMaps, _sourceMapCount);
    _sourceMaps = decodeMappings(mappings, &_sourceMapCount);
    self.source = source; [self wake];
}
- (void)compute:(NSArray<JoltLiveSpring *> *)sources program:(NSString *)program {
    for (JoltLiveSpring *parent in sources)
        if (parent.disposed || [nodes indexOfObject:parent] >= [nodes indexOfObject:self])
            [NSException raise:NSInvalidArgumentException format:@"Scalar inputs must precede their output"];
    JoltScalarProgram *next = [[JoltScalarProgram alloc] initWithJSON:program sources:sources.count];
    free(_graphValues); free(_graphVelocities);
    _graphValues=calloc(sources.count, sizeof(double)); _graphVelocities=calloc(sources.count, sizeof(double));
    self.graphSources=[sources copy]; self.graph=next; [self wake];
}
- (void)updateInput:(NSString *)snapshot {
    if (self.disposed) return;
    self.sensorDriven = NO; self.direct = NO;
    [self replaceInputs:@[decode(snapshot)] rest:0];
    [self wake];
}
- (void)setInputs:(NSString *)snapshots rest:(double)rest {
    if (self.disposed) return;
    self.sensorDriven = NO; self.direct = NO;
    [self replaceInputs:decode(snapshots) rest:rest];
    [self wake];
}
- (double)inputValue:(double)now {
    double value = self.inputRest;
    for (NSUInteger i = 0; i < _inputCount; i++) value += sampledValue(&_inputs[i], self.anchor, now);
    return value;
}
- (BOOL)inputMoving:(double)now {
    for (NSUInteger i = 0; i < _inputCount; i++) if (sampledRunning(&_inputs[i], self.anchor, now)) return YES;
    return NO;
}
- (void)setDataInput:(double)value velocity:(double)velocity {
    if(self.disposed || !isfinite(value) || !isfinite(velocity))return;
    self.dataInput=YES; self.dataTime=CACurrentMediaTime()*1000; self.sensorDriven=YES; self.inputHeld=YES; self.direct=YES;
    [self replaceInputs:@[] rest:0]; self.targetValue=value;
    _state=(JoltSpringState){value,velocity}; self.moving=velocity!=0; [JoltLiveSpring schedule];
}
- (void)setSensorInput:(double)value {
    if (self.disposed || !isfinite(value) || (self.sensorDriven && self.inputHeld && _state.position == value)) return;
    self.dataInput=NO; self.sensorDriven = YES; self.inputHeld = YES; self.direct = YES; self.targetValue = value;
    [self replaceInputs:@[] rest:0];
    _state = (JoltSpringState){value, 0}; self.moving = NO;
    [JoltLiveSpring schedule];
}
- (void)setTarget:(double)value {
    if (self.disposed) return;
    self.sensorDriven = NO; self.direct = YES; self.targetValue = value;
    [self replaceInputs:@[] rest:0];
    [self wake];
}
- (void)holdInput:(double)value velocity:(double)velocity {
    if (self.disposed) return;
    self.dataInput=NO; self.sensorDriven = NO; self.inputHeld = YES; self.direct = YES; self.targetValue = value;
    [self replaceInputs:@[] rest:0];
    _state = (JoltSpringState){value, velocity}; self.moving = YES;
    [CATransaction begin]; [CATransaction setDisableActions:YES]; [self apply]; [CATransaction commit];
    [JoltLiveSpring schedule];
}
- (void)releaseInput:(double)target velocity:(double)velocity {
    if (self.disposed) return;
    self.inputHeld = NO; _state.velocity = velocity; [self setTarget:target];
}
- (void)setReduced:(BOOL)value { _reduced = value; [self wake]; }
- (void)setPaused:(BOOL)value {
    _paused = value;
    if (value) self.moving = NO; else [self wake];
}
- (void)wake {
    // Sensor inputs are held data, not springs. A policy change must not wake an endless clock.
    if (self.disposed || self.paused || self.sensorDriven) return;
    self.moving = YES;
    if (self.reduced) {
        [self step:CACurrentMediaTime() * 1000 seconds:0];
        [CATransaction begin]; [CATransaction setDisableActions:YES]; [self apply]; [CATransaction commit];
    }
    [JoltLiveSpring schedule];
}
- (void)step:(double)now seconds:(double)seconds {
    if(self.disposed || self.paused)return;
    if(self.inputHeld) {
        if(self.dataInput && now-self.dataTime>=100) { _state.velocity=0; self.moving=NO; }
        return;
    }
    if (self.graph) {
        BOOL active=NO;
        for (NSUInteger i=0; i<self.graphSources.count; i++) {
            JoltLiveSpring *input=self.graphSources[i];
            _graphValues[i]=input.position; _graphVelocities[i]=input.disposed||input.paused?0:input.velocity; active |= input.moving;
        }
        [self.graph evaluateValues:_graphValues velocities:_graphVelocities];
        _state=(JoltSpringState){self.graph.value,self.graph.velocity}; self.moving=active; return;
    }
    double target = self.source ? mapped(self.source.position, _sourceMaps, _sourceMapCount) : (self.direct ? self.targetValue : [self inputValue:now]);
    BOOL inputMoving = self.source ? self.source.moving : (!self.direct && [self inputMoving:now]);
    if (self.reduced) {
        double velocity=0;
        if (self.source) {
            double value=self.source.position; velocity=self.source.velocity;
            for (NSUInteger m=0; m<_sourceMapCount; m++) {
                const JoltMapping *mapping=&_sourceMaps[m];
                if (mapping->colors || (mapping->clamp && (value<=mapping->input[0] || value>=mapping->input[mapping->count-1]))) velocity=0;
                else { NSUInteger k=0; while(k<mapping->count-2 && value>mapping->input[k+1]) k++; velocity *= (mapping->output[k+1]-mapping->output[k])/(mapping->input[k+1]-mapping->input[k]); }
                value=mapped(value,mapping,1);
            }
        } else if (!self.direct) velocity=([self inputValue:now+.5]-[self inputValue:now-.5])*1000;
        _state = (JoltSpringState){target, isfinite(velocity)?velocity:0};
    }
    else _state = JoltSpringAdvance(_state, target, self.stiffness, self.damping, self.mass, seconds);
    BOOL rest = fabs(_state.position - target) <= self.restDelta && fabs(_state.velocity) <= self.restSpeed;
    if (rest && !inputMoving) _state = (JoltSpringState){target, 0};
    self.moving = inputMoving || !rest;
}
- (JoltLiveSpringBinding *)bind:(UIView *)view property:(NSString *)property mappings:(NSString *)mappings {
    if (self.disposed) [NSException raise:NSInvalidArgumentException format:@"Spring disposed"];
    JoltLiveSpringBinding *binding = [JoltLiveSpringBinding new];
    binding.node = self; binding.view = view; binding.property = property;
    [binding useMappings:mappings];
    NSString *key = property;
    if ([key isEqualToString:@"opacity"]) binding.alpha = YES;
    else if ([key isEqualToString:@"backgroundColor"] || [key isEqualToString:@"borderColor"] || [key isEqualToString:@"color"] || [key hasPrefix:@"border"]) {
        binding.paint=[JoltLivePaint acquire:view property:property owner:binding];
        binding.radius=[key hasSuffix:@"Radius"] || [key hasSuffix:@"Width"];
    }
    else if ([key isEqualToString:@"x"]) key = @"transform.translation.x";
    else if ([key isEqualToString:@"y"]) key = @"transform.translation.y";
    else if ([key isEqualToString:@"scaleX"]) key = @"transform.scale.x";
    else if ([key isEqualToString:@"scaleY"]) key = @"transform.scale.y";
    else if ([key isEqualToString:@"rotate"]) { key = @"transform.rotation.z"; binding.radians = YES; }
    else if ([key isEqualToString:@"rotateX"]) { key = @"transform.rotation.x"; binding.radians = YES; }
    else if ([key isEqualToString:@"rotateY"]) { key = @"transform.rotation.y"; binding.radians = YES; }
    binding.keyPath = key;
    binding.multiply = binding.alpha || [property hasPrefix:@"scale"];
    binding.shadowed = [view respondsToSelector:@selector(outerShadowContainerLayer)];
    [self.bindings addObject:binding];
    [CATransaction begin]; [CATransaction setDisableActions:YES]; [binding apply]; [CATransaction commit];
    return binding;
}
- (JoltLiveSpringBinding *)bindImage:(JoltImageEffect *)effect parameter:(NSString *)parameter {
    if (self.disposed) [NSException raise:NSInvalidArgumentException format:@"Spring disposed"];
    JoltLiveSpringBinding *binding=[JoltLiveSpringBinding new];
    binding.node=self; binding.view=effect.targetView; binding.imageEffect=effect; binding.property=parameter;
    [self.bindings addObject:binding]; [effect retainBinding:binding]; [binding apply]; return binding;
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
    self.disposed = YES; self.moving = NO; while(self.bindings.count)[self.bindings.lastObject cancel]; [nodes removeObject:self];
    for (JoltLiveSpring *child in nodes) if (child.source == self) {
        child.source = nil; [child setTarget:mapped(self.position, child->_sourceMaps, child->_sourceMapCount)];
    }
    self.source = nil; self.graph = nil; self.graphSources = nil;
    if (!nodes.count) { [displayLink invalidate]; displayLink = nil; previousFrame = 0; }
}
@end

@implementation JoltLiveSpringBinding
- (void)dealloc {
    freeMappings(_maps, _mapCount);
    freeSampled(_layers, _layerCount);
}
- (void)useMappings:(NSString *)mappings {
    freeMappings(_maps, _mapCount);
    _maps = decodeMappings(mappings, &_mapCount);
}
- (double)value {
    double value = mapped(self.node.position, _maps, _mapCount);
    return self.radius ? MAX(0, value) : value;
}
- (void)setLayers:(NSString *)inputs {
    freeSampled(_layers, _layerCount);
    _layers = decodeSampled(decode(inputs), &_layerCount);
    self.layerAnchor = CACurrentMediaTime() * 1000;
    [CATransaction begin]; [CATransaction setDisableActions:YES]; [self apply]; [CATransaction commit];
    [JoltLiveSpring schedule];
}
- (BOOL)running:(double)now {
    for (NSUInteger i = 0; i < _layerCount; i++) if (sampledRunning(&_layers[i], self.layerAnchor, now)) return YES;
    return NO;
}
- (void)cancel { if(self.stopped)return; self.stopped = YES; [self.imageEffect releaseBinding:self]; self.imageEffect=nil; [self.paint releaseProperty:self.property owner:self];self.paint=nil; [self.node.bindings removeObject:self]; }
- (void)apply {
    UIView *view = self.view;
    if (self.stopped || !view.window) return;
    double value = self.value;
    double now = CACurrentMediaTime() * 1000;
    for (NSUInteger i = 0; i < _layerCount; i++) {
        double part = sampledValue(&_layers[i], self.layerAnchor, now);
        value = self.multiply ? value * part : value + part;
    }
    if (self.imageEffect) { [self.imageEffect setParameter:self.property value:value]; return; }
    if (self.alpha) { view.alpha = MAX(0, MIN(1, value)); return; }
    if (self.paint) { [self.paint write:value property:self.property owner:self]; return; }
    if (self.color) {
        uint32_t argb = (uint32_t)value;
        view.layer.backgroundColor = [UIColor colorWithRed:((argb>>16)&255)/255.0 green:((argb>>8)&255)/255.0 blue:(argb&255)/255.0 alpha:(argb>>24)/255.0].CGColor;
        return;
    }
    if (self.radius) {
        view.layer.cornerRadius = MIN(value, MIN(view.bounds.size.width/2, view.bounds.size.height/2));
        return;
    }
    if (self.radians) value *= M_PI / 180;
    NSNumber *boxed = @(value);
    [view.layer setValue:boxed forKeyPath:self.keyPath];
    if (self.shadowed) {
        CALayer *shadow = [(id<JoltShadowedView>)view outerShadowContainerLayer];
        if (shadow) [shadow setValue:boxed forKeyPath:self.keyPath];
    }
}
@end
