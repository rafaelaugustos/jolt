#import "JoltSensorFaultProbe.h"
#import <CoreMotion/CoreMotion.h>
#import <objc/runtime.h>

static __weak CMMotionManager *probeManager;
static CMDeviceMotionHandler probeHandler;
@interface CMMotionManager (JoltSensorFaultFixture)
- (void)jolt_probeStart:(CMAttitudeReferenceFrame)frame toQueue:(NSOperationQueue *)queue withHandler:(CMDeviceMotionHandler)handler;
@end
@implementation CMMotionManager (JoltSensorFaultFixture)
- (void)jolt_probeStart:(CMAttitudeReferenceFrame)frame toQueue:(NSOperationQueue *)queue withHandler:(CMDeviceMotionHandler)handler {
    probeManager = self; probeHandler = [handler copy];
    [self jolt_probeStart:frame toQueue:queue withHandler:handler];
}
@end
@implementation JoltSensorFaultProbe
+ (void)install {
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        method_exchangeImplementations(class_getInstanceMethod(CMMotionManager.class, @selector(startDeviceMotionUpdatesUsingReferenceFrame:toQueue:withHandler:)),
            class_getInstanceMethod(CMMotionManager.class, @selector(jolt_probeStart:toQueue:withHandler:)));
    });
}
+ (void)stopDelivery { [probeManager stopDeviceMotionUpdates]; }
+ (void)failAccess {
    if (probeHandler) probeHandler(nil, [NSError errorWithDomain:@"JoltDemoControlledAccessFailure" code:1
        userInfo:@{NSLocalizedDescriptionKey: @"demo-injected-access-failure"}]);
}
@end
