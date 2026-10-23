#import "JoltSceneProbe.h"
#import <SceneKit/SceneKit.h>
@protocol JoltProbeSink
@property(nonatomic, readonly) BOOL alive;
- (void)dispose;
@end
@protocol JoltProbeFactory
+ (id<JoltProbeSink>)sceneLightIntensity:(NSObject *)light;
+ (id<JoltProbeSink>)sceneFieldOfView:(NSObject *)camera;
@end
@implementation JoltSceneProbe
+ (BOOL)weakCameraReleased {
    id<JoltProbeSink> sink;
    @autoreleasepool {
        SCNCamera *camera = [SCNCamera camera];
        sink = [(Class<JoltProbeFactory>)NSClassFromString(@"JoltReferenceProperties") sceneFieldOfView:camera];
        if (!sink.alive) return NO;
    }
    BOOL released = !sink.alive;
    [sink dispose];
    return released;
}
+ (BOOL)weakTargetReleased {
    id<JoltProbeSink> sink;
    @autoreleasepool {
        SCNLight *light = [SCNLight light];
        sink = [(Class<JoltProbeFactory>)NSClassFromString(@"JoltReferenceProperties") sceneLightIntensity:light];
        if (!sink.alive) return NO;
    }
    BOOL released = !sink.alive;
    [sink dispose];
    return released;
}
@end
