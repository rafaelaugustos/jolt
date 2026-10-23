#import "JoltSceneProbe.h"
#import <SceneKit/SceneKit.h>
@protocol JoltProbeSink
@property(nonatomic, readonly) BOOL alive;
- (void)dispose;
@end
@protocol JoltProbeFactory
+ (id<JoltProbeSink>)sceneLightIntensity:(NSObject *)light;
@end
@implementation JoltSceneProbe
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
