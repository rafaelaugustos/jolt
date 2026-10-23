#import "JoltReferenceProperties.h"
#import <MapKit/MapKit.h>
#import <SceneKit/SceneKit.h>
#import <UIKit/UIKit.h>

static double longitude(double value) { return fmod(fmod(value+180,360)+360,360)-180; }
@interface JoltMapCoordinateSink : JoltPropertySink @end
@implementation JoltMapCoordinateSink
- (NSArray<NSNumber *> *)read {
    CLLocationCoordinate2D p=[(id<MKAnnotation>)self.target coordinate];
    return @[@(p.latitude),@(p.longitude)];
}
- (void)write:(NSArray<NSNumber *> *)values {
    id<MKAnnotation> target=(id)self.target;
    if(target) target.coordinate=CLLocationCoordinate2DMake(MAX(-90,MIN(90,values[0].doubleValue)),longitude(values[1].doubleValue));
}
@end
@interface JoltMapCameraSink : JoltPropertySink @end
@implementation JoltMapCameraSink
- (NSArray<NSNumber *> *)read {
    MKMapCamera *camera=[(MKMapView *)self.target camera];
    return @[@(camera.centerCoordinate.latitude),@(camera.centerCoordinate.longitude),@(camera.altitude),@(camera.pitch),@(camera.heading)];
}
- (void)write:(NSArray<NSNumber *> *)values {
    MKMapView *map=(id)self.target;
    if(!map) return;
    MKMapCamera *camera=[map.camera copy];
    camera.centerCoordinate=CLLocationCoordinate2DMake(MAX(-90,MIN(90,values[0].doubleValue)),longitude(values[1].doubleValue));
    camera.altitude=MAX(1,values[2].doubleValue); camera.pitch=MAX(0,MIN(80,values[3].doubleValue)); camera.heading=values[4].doubleValue;
    [map setCamera:camera animated:NO];
}
@end
@interface JoltScenePoseSink : JoltPropertySink @end
@implementation JoltScenePoseSink
- (NSArray<NSNumber *> *)read {
    SCNNode *node=(id)self.target;
    SCNNode *presented=node.presentationNode ?: node;
    SCNVector3 p=presented.position; SCNQuaternion q=presented.orientation;
    return @[@(p.x),@(p.y),@(p.z),@(q.x),@(q.y),@(q.z),@(q.w)];
}
- (void)write:(NSArray<NSNumber *> *)values {
    SCNNode *node=(id)self.target; if(!node) return;
    [SCNTransaction begin]; [SCNTransaction setDisableActions:YES];
    node.position=SCNVector3Make(values[0].floatValue,values[1].floatValue,values[2].floatValue);
    double x=values[3].doubleValue,y=values[4].doubleValue,z=values[5].doubleValue,w=values[6].doubleValue;
    double norm=sqrt(x*x+y*y+z*z+w*w);
    node.orientation=norm>0?SCNVector4Make(x/norm,y/norm,z/norm,w/norm):SCNVector4Make(0,0,0,1);
    [SCNTransaction commit];
}
@end
// Appearance is read from the model: SceneKit exposes presentationNode, but no public
// presentation object for a standalone SCNLight/SCNMaterial. Our immediate writes keep
// the model current. Apps must remove competing animations before transferring control.
typedef NS_ENUM(NSUInteger, JoltSceneAppearanceKind) {
    JoltSceneIntensity, JoltSceneLightColor, JoltSceneTransparency, JoltSceneDiffuse, JoltSceneEmission
};
static NSUInteger appearanceSinks, appearanceWrites;
static CGFloat unitComponent(CGFloat value) { return MAX(0, MIN(1, value)); }
static CGColorRef copySceneColor(id value) CF_RETURNS_RETAINED {
    CGColorRef original = NULL;
    if ([value isKindOfClass:UIColor.class])
        original = [[value resolvedColorWithTraitCollection:UITraitCollection.currentTraitCollection] CGColor];
    else if (value && CFGetTypeID((__bridge CFTypeRef)value) == CGColorGetTypeID())
        original = (__bridge CGColorRef)value;
    if (!original) return NULL;
    CGColorSpaceRef space = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
    CGColorRef converted = CGColorCreateCopyByMatchingToColorSpace(space, kCGRenderingIntentDefault, original, NULL);
    CGColorSpaceRelease(space);
    if (converted && (CGColorGetNumberOfComponents(converted) != 4 || CGColorSpaceGetModel(CGColorGetColorSpace(converted)) != kCGColorSpaceModelRGB)) {
        CGColorRelease(converted); return NULL;
    }
    return converted;
}
@interface JoltSceneAppearanceSink : JoltPropertySink
@property(nonatomic) JoltSceneAppearanceKind kind;
@property(nonatomic) BOOL released;
+ (instancetype)target:(NSObject *)target kind:(JoltSceneAppearanceKind)kind;
@end
@implementation JoltSceneAppearanceSink
+ (instancetype)target:(NSObject *)target kind:(JoltSceneAppearanceKind)kind {
    NSParameterAssert(NSThread.isMainThread);
    BOOL light = kind == JoltSceneIntensity || kind == JoltSceneLightColor;
    if (![target isKindOfClass:light ? SCNLight.class : SCNMaterial.class])
        [NSException raise:NSInvalidArgumentException format:@"Jolt SceneKit adapter requires %@", light ? @"SCNLight" : @"SCNMaterial"];
    JoltSceneAppearanceSink *sink = [[self alloc] initWithTarget:target dimensions:(kind == JoltSceneIntensity || kind == JoltSceneTransparency) ? 1 : 4];
    sink.kind = kind; appearanceSinks++;
    if (!sink.alive) {
        [sink dispose];
        [NSException raise:NSInvalidArgumentException format:@"Jolt SceneKit adapter requires a valid scalar or solid UIColor/CGColor; textures, images, numbers, patterns and nil color contents are unsupported"];
    }
    return sink;
}
- (id)contents {
    switch (self.kind) {
        case JoltSceneLightColor: return [(SCNLight *)self.target color];
        case JoltSceneDiffuse: return [(SCNMaterial *)self.target diffuse].contents;
        case JoltSceneEmission: return [(SCNMaterial *)self.target emission].contents;
        default: return nil;
    }
}
- (BOOL)alive {
    if (!self.target) return NO;
    if (self.kind == JoltSceneIntensity || self.kind == JoltSceneTransparency) {
        double value = self.kind == JoltSceneIntensity ? [(SCNLight *)self.target intensity] : [(SCNMaterial *)self.target transparency];
        return isfinite(value) && value >= 0 && (self.kind != JoltSceneTransparency || value <= 1);
    }
    CGColorRef color = copySceneColor(self.contents);
    BOOL valid = color != NULL;
    if (color) CGColorRelease(color);
    return valid;
}
- (NSArray<NSNumber *> *)read {
    NSParameterAssert(NSThread.isMainThread);
    if (!self.alive) [NSException raise:NSInvalidArgumentException format:@"Jolt SceneKit target or solid color contents are no longer valid"];
    if (self.kind == JoltSceneIntensity) return @[@([(SCNLight *)self.target intensity])];
    if (self.kind == JoltSceneTransparency) return @[@([(SCNMaterial *)self.target transparency])];
    CGColorRef color = copySceneColor(self.contents);
    const CGFloat *v = CGColorGetComponents(color);
    CGFloat a = unitComponent(v[3]);
    NSArray *result = @[@(unitComponent(v[0])*a), @(unitComponent(v[1])*a), @(unitComponent(v[2])*a), @(a)];
    CGColorRelease(color);
    return result;
}
- (void)write:(NSArray<NSNumber *> *)values {
    NSParameterAssert(NSThread.isMainThread);
    if (!self.alive) [NSException raise:NSInvalidArgumentException format:@"Jolt will not overwrite unsupported SceneKit contents"];
    if (values.count != self.dimensions) [NSException raise:NSInvalidArgumentException format:@"Invalid SceneKit component count"];
    for (NSNumber *value in values)
        if (!isfinite(value.doubleValue)) [NSException raise:NSInvalidArgumentException format:@"Nonfinite SceneKit component"];
    if (self.dimensions == 1 && (values[0].doubleValue < 0 || (self.kind == JoltSceneTransparency && values[0].doubleValue > 1)))
        [NSException raise:NSInvalidArgumentException format:@"SceneKit scalar is outside its range"];
    UIColor *color = nil;
    if (self.dimensions == 4) {
        double a = values[3].doubleValue;
        if (a < 0 || a > 1) [NSException raise:NSInvalidArgumentException format:@"Invalid SceneKit alpha"];
        for (NSUInteger i=0; i<3; i++)
            if (values[i].doubleValue < 0 || values[i].doubleValue > a + 1e-9)
                [NSException raise:NSInvalidArgumentException format:@"Invalid premultiplied SceneKit color"];
        color = [UIColor colorWithRed:a ? unitComponent(values[0].doubleValue/a) : 0
                               green:a ? unitComponent(values[1].doubleValue/a) : 0
                                blue:a ? unitComponent(values[2].doubleValue/a) : 0 alpha:a];
    }
    [SCNTransaction begin]; [SCNTransaction setDisableActions:YES];
    @try {
        switch (self.kind) {
            case JoltSceneIntensity: [(SCNLight *)self.target setIntensity:values[0].doubleValue]; break;
            case JoltSceneTransparency: [(SCNMaterial *)self.target setTransparency:values[0].doubleValue]; break;
            case JoltSceneLightColor: [(SCNLight *)self.target setColor:color]; break;
            case JoltSceneDiffuse: [(SCNMaterial *)self.target diffuse].contents = color; break;
            case JoltSceneEmission: [(SCNMaterial *)self.target emission].contents = color; break;
        }
        appearanceWrites++;
    } @finally { [SCNTransaction commit]; }
}
- (void)dispose {
    if (!self.released) { self.released = YES; appearanceSinks--; }
    [super dispose];
}
- (void)dealloc { if (!self.released) appearanceSinks--; }
@end

@implementation JoltReferenceProperties
+ (JoltPropertySink *)sceneLightIntensity:(NSObject *)light { return [JoltSceneAppearanceSink target:light kind:JoltSceneIntensity]; }
+ (JoltPropertySink *)sceneLightColor:(NSObject *)light { return [JoltSceneAppearanceSink target:light kind:JoltSceneLightColor]; }
+ (JoltPropertySink *)sceneMaterialTransparency:(NSObject *)material { return [JoltSceneAppearanceSink target:material kind:JoltSceneTransparency]; }
+ (JoltPropertySink *)sceneMaterialDiffuse:(NSObject *)material { return [JoltSceneAppearanceSink target:material kind:JoltSceneDiffuse]; }
+ (JoltPropertySink *)sceneMaterialEmission:(NSObject *)material { return [JoltSceneAppearanceSink target:material kind:JoltSceneEmission]; }
+ (NSUInteger)sceneAppearanceSinkCount { return appearanceSinks; }
+ (NSUInteger)sceneAppearanceWriteCount { return appearanceWrites; }
+ (JoltPropertySink *)mapCoordinate:(NSObject *)annotation {
    NSParameterAssert([annotation conformsToProtocol:@protocol(MKAnnotation)] && [annotation respondsToSelector:@selector(setCoordinate:)]);
    return [[JoltMapCoordinateSink alloc] initWithTarget:annotation dimensions:2];
}
+ (JoltPropertySink *)mapCamera:(NSObject *)mapView {
    NSParameterAssert([mapView isKindOfClass:MKMapView.class]);
    return [[JoltMapCameraSink alloc] initWithTarget:mapView dimensions:5];
}
+ (JoltPropertySink *)scenePose:(NSObject *)node {
    NSParameterAssert([node isKindOfClass:SCNNode.class]);
    return [[JoltScenePoseSink alloc] initWithTarget:node dimensions:7];
}
@end
