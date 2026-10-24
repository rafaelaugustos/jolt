#import "JoltSceneShaderProperties.h"
#import <SceneKit/SceneKit.h>
#import <UIKit/UIKit.h>
#import <float.h>

static NSUInteger sinks, writes;
static void invalid(NSString *message) {
    [NSException raise:NSInvalidArgumentException format:@"%@", message];
}
static NSError *failure(NSException *exception) {
    return [NSError errorWithDomain:@"JoltSceneShader" code:1 userInfo:@{NSLocalizedDescriptionKey: exception.reason ?: @"Invalid SceneKit target"}];
}
@interface JoltSceneTrackedSink : JoltPropertySink
@property(nonatomic) BOOL released;
@end
@implementation JoltSceneTrackedSink
- (instancetype)initWithTarget:(NSObject *)target dimensions:(NSUInteger)dimensions {
    if ((self = [super initWithTarget:target dimensions:dimensions])) sinks++;
    return self;
}
- (void)dispose { if (!self.released) { self.released = YES; sinks--; } [super dispose]; }
- (void)dealloc { if (!self.released) sinks--; }
@end

@interface JoltEnvironmentSink : JoltSceneTrackedSink @end
@implementation JoltEnvironmentSink
- (BOOL)alive {
    SCNScene *scene = (id)self.target;
    return scene && isfinite(scene.lightingEnvironment.intensity) && scene.lightingEnvironment.intensity >= 0;
}
- (NSArray<NSNumber *> *)read {
    NSParameterAssert(NSThread.isMainThread);
    if (!self.alive) invalid(@"SceneKit environment target or intensity is no longer valid");
    return @[@([(SCNScene *)self.target lightingEnvironment].intensity)];
}
- (void)write:(NSArray<NSNumber *> *)values {
    NSParameterAssert(NSThread.isMainThread);
    if (!self.alive || values.count != 1 || !isfinite(values[0].doubleValue) || values[0].doubleValue < 0)
        invalid(@"Environment intensity needs one finite nonnegative multiplier");
    [SCNTransaction begin]; [SCNTransaction setDisableActions:YES];
    @try { [(SCNScene *)self.target lightingEnvironment].intensity = values[0].doubleValue; writes++; }
    @finally { [SCNTransaction commit]; }
}
@end

static NSString *withoutComments(NSString *source) {
    NSRegularExpression *comments = [NSRegularExpression regularExpressionWithPattern:@"/\\*[\\s\\S]*?\\*/|//[^\\n]*" options:0 error:NULL];
    return [comments stringByReplacingMatchesInString:source options:0 range:NSMakeRange(0, source.length) withTemplate:@" "];
}
static void validateDeclaration(NSObject<SCNShadable> *target, NSString *name, NSString *type) {
    if (target.program) invalid(@"SCNProgram buffers are unsupported; use declared Metal shaderModifiers inputs");
    if ([target respondsToSelector:NSSelectorFromString(name)] || [target respondsToSelector:NSSelectorFromString([name stringByAppendingString:@":"])])
        invalid(@"A shader input must not shadow a native target property");
    NSDictionary *modifiers = target.shaderModifiers;
    if (!modifiers.count) invalid(@"Declare the uniform in shaderModifiers before creating its adapter");
    BOOL found = NO;
    NSString *pattern = [NSString stringWithFormat:@"(?m)^\\s*(float[234]?)\\s+%@\\s*;\\s*$", name];
    NSRegularExpression *declaration = [NSRegularExpression regularExpressionWithPattern:pattern options:0 error:NULL];
    NSRegularExpression *arguments = [NSRegularExpression regularExpressionWithPattern:@"#pragma[ \\t]+arguments\\b([\\s\\S]*?)(?=#pragma|\\z)" options:0 error:NULL];
    NSRegularExpression *conditional = [NSRegularExpression regularExpressionWithPattern:@"(?m)^\\s*#\\s*(if|ifdef|ifndef|define|include)\\b" options:0 error:NULL];
    for (NSString *raw in modifiers.allValues) {
        if (![raw isKindOfClass:NSString.class]) invalid(@"Shader modifiers must contain source strings");
        NSString *source = withoutComments(raw);
        if ([conditional numberOfMatchesInString:source options:0 range:NSMakeRange(0, source.length)])
            invalid(@"Conditional or macro-defined shader schemas are unsupported; declare literal Metal float inputs");
        for (NSTextCheckingResult *section in [arguments matchesInString:source options:0 range:NSMakeRange(0, source.length)]) {
            NSString *body = [source substringWithRange:[section rangeAtIndex:1]];
            NSArray *matches = [declaration matchesInString:body options:0 range:NSMakeRange(0, body.length)];
            if (matches.count > 1) invalid(@"A uniform declaration must not repeat within one shader stage");
            for (NSTextCheckingResult *match in matches) {
                if (![[body substringWithRange:[match rangeAtIndex:1]] isEqualToString:type]) invalid(@"Uniform declaration does not match the requested component type");
                found = YES;
            }
        }
    }
    if (!found) invalid(@"Uniform name/type was not found as a literal declaration under #pragma arguments");
}

@interface JoltUniformSink : JoltSceneTrackedSink
@property(nonatomic, copy) NSString *name;
@property(nonatomic, copy) NSDictionary *modifiers;
@property(nonatomic) double low, high;
@property(nonatomic) BOOL invalidated;
- (NSArray<NSNumber *> *)components;
@end
@implementation JoltUniformSink
- (NSArray<NSNumber *> *)components {
    id value = [self.target valueForKey:self.name];
    NSArray *values;
    if (self.dimensions == 1 && [value isKindOfClass:NSNumber.class]) values = @[value];
    else if ([value isKindOfClass:NSValue.class]) {
        // SceneKit boxes SCNVector3/4 as CGRect on some runtimes; its own accessors
        // decode that canonical representation. The declared shader type owns arity.
        const char *encoding = [value objCType];
        if (self.dimensions == 2 && strcmp(encoding, @encode(CGPoint)) == 0) {
            CGPoint p = [value CGPointValue]; values = @[@(p.x), @(p.y)];
        } else if (self.dimensions == 3 && (strcmp(encoding, @encode(SCNVector3)) == 0 || strcmp(encoding, @encode(CGRect)) == 0)) {
            SCNVector3 p = [value SCNVector3Value]; values = @[@(p.x), @(p.y), @(p.z)];
        } else if (self.dimensions == 4 && (strcmp(encoding, @encode(SCNVector4)) == 0 || strcmp(encoding, @encode(CGRect)) == 0)) {
            SCNVector4 p = [value SCNVector4Value]; values = @[@(p.x), @(p.y), @(p.z), @(p.w)];
        }
    }
    if (values.count != self.dimensions) invalid([NSString stringWithFormat:@"Initialize uniform %@ with %lu components using NSNumber / NSValue CGPoint / SCNVector3 / SCNVector4; got %@ (%s)", self.name, (unsigned long)self.dimensions, [value class], [value isKindOfClass:NSValue.class] ? [value objCType] : "nil"]);
    NSMutableArray *normalized = [NSMutableArray arrayWithCapacity:self.dimensions];
    for (NSNumber *number in values) {
        double v = number.doubleValue;
        double epsilon = self.dimensions == 1 ? 0 : 4 * FLT_EPSILON * MAX(1, fabs(v));
        if (!isfinite(v) || v < self.low - epsilon || v > self.high + epsilon)
            invalid(@"Shader component is outside the declared finite range");
        [normalized addObject:@(MAX(self.low, MIN(self.high, v)))];
    }
    return normalized;
}
- (BOOL)alive {
    if (self.invalidated || !self.target) return NO;
    @try {
        NSObject<SCNShadable> *target = (id)self.target;
        if (target.program || ![target.shaderModifiers isEqualToDictionary:self.modifiers]) self.invalidated = YES;
        if (!self.invalidated) [self components];
    } @catch (NSException *exception) { self.invalidated = YES; }
    return !self.invalidated;
}
- (NSArray<NSNumber *> *)read {
    NSParameterAssert(NSThread.isMainThread);
    if (!self.alive) invalid(@"Shader target, source or initialized value changed; dispose and create a new adapter");
    return [self components];
}
- (void)write:(NSArray<NSNumber *> *)values {
    NSParameterAssert(NSThread.isMainThread);
    if (!self.alive || values.count != self.dimensions) invalid(@"Shader target or component count is invalid");
    for (NSNumber *number in values)
        if (!isfinite(number.doubleValue) || number.doubleValue < self.low || number.doubleValue > self.high)
            invalid(@"Shader component is outside the declared finite range");
    id value = values[0];
    if (self.dimensions == 2) value = [NSValue valueWithCGPoint:CGPointMake(values[0].doubleValue, values[1].doubleValue)];
    else if (self.dimensions == 3) value = [NSValue valueWithSCNVector3:SCNVector3Make(values[0].floatValue, values[1].floatValue, values[2].floatValue)];
    else if (self.dimensions == 4) value = [NSValue valueWithSCNVector4:SCNVector4Make(values[0].floatValue, values[1].floatValue, values[2].floatValue, values[3].floatValue)];
    // One boxed vector assignment prevents separately updated component states.
    [SCNTransaction begin]; [SCNTransaction setDisableActions:YES];
    @try { [self.target setValue:value forKey:self.name]; writes++; }
    @finally { [SCNTransaction commit]; }
}
@end

@implementation JoltSceneShaderProperties
+ (JoltPropertySink *)environment:(NSObject *)scene error:(NSError **)error {
    @try {
        if (!NSThread.isMainThread || ![scene isKindOfClass:SCNScene.class]) invalid(@"Environment intensity needs an SCNScene on the main thread");
        double value = [(SCNScene *)scene lightingEnvironment].intensity;
        if (!isfinite(value) || value < 0) invalid(@"Environment intensity must start finite and nonnegative");
        return [[JoltEnvironmentSink alloc] initWithTarget:scene dimensions:1];
    } @catch (NSException *exception) { if (error) *error = failure(exception); return nil; }
}
+ (JoltPropertySink *)uniform:(NSObject *)target name:(NSString *)name configuration:(NSString *)configuration error:(NSError **)error {
    JoltUniformSink *sink = nil;
    @try {
        if (!NSThread.isMainThread || (![target isKindOfClass:SCNMaterial.class] && ![target isKindOfClass:SCNGeometry.class]))
            invalid(@"Shader uniforms need an SCNMaterial or SCNGeometry on the main thread");
        NSRegularExpression *identifier = [NSRegularExpression regularExpressionWithPattern:@"^[A-Za-z][A-Za-z0-9_]*$" options:0 error:NULL];
        if (![name isKindOfClass:NSString.class] || [identifier numberOfMatchesInString:name options:0 range:NSMakeRange(0, name.length)] != 1
            || [name hasPrefix:@"u_"] || [name hasPrefix:@"a_"] || [name hasPrefix:@"v_"] || [name hasPrefix:@"scn_"])
            invalid(@"Invalid or reserved shader uniform identifier");
        NSDictionary *config = [NSJSONSerialization JSONObjectWithData:[configuration dataUsingEncoding:NSUTF8StringEncoding] options:0 error:NULL];
        if (![config isKindOfClass:NSDictionary.class]) invalid(@"Invalid shader schema");
        NSString *type = config[@"type"];
        NSArray *types = @[@"float", @"float2", @"float3", @"float4"];
        NSUInteger index = [types indexOfObject:type];
        if (index == NSNotFound || ![config[@"low"] isKindOfClass:NSNumber.class] || ![config[@"high"] isKindOfClass:NSNumber.class]) invalid(@"Invalid shader type or range");
        double low = [config[@"low"] doubleValue], high = [config[@"high"] doubleValue];
        if (!isfinite(low) || !isfinite(high) || low >= high || fabs(low) > FLT_MAX || fabs(high) > FLT_MAX) invalid(@"Shader ranges must be ordered finite float limits");
        validateDeclaration((id)target, name, type);
        sink = [[JoltUniformSink alloc] initWithTarget:target dimensions:index+1];
        sink.name = name; sink.low = low; sink.high = high;
        sink.modifiers = [(id<SCNShadable>)target shaderModifiers];
        [sink components];
        return sink;
    } @catch (NSException *exception) { [sink dispose]; if (error) *error = failure(exception); return nil; }
}
+ (NSUInteger)sinkCount { return sinks; }
+ (NSUInteger)writeCount { return writes; }
@end
