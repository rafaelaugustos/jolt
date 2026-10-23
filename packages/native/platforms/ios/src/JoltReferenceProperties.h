#import "JoltPropertyPlayer.h"
NS_ASSUME_NONNULL_BEGIN
@interface JoltReferenceProperties : NSObject
+ (JoltPropertySink *)mapCoordinate:(NSObject *)annotation;
+ (JoltPropertySink *)mapCamera:(NSObject *)mapView;
+ (JoltPropertySink *)scenePose:(NSObject *)node;
+ (JoltPropertySink *)sceneFieldOfView:(NSObject *)camera;
/** Diagnostic counts for camera FOV sinks and writes; native camera targets are weak. */
+ (NSUInteger)sceneCameraSinkCount;
+ (NSUInteger)sceneCameraWriteCount;
+ (JoltPropertySink *)sceneLightIntensity:(NSObject *)light;
+ (JoltPropertySink *)sceneLightColor:(NSObject *)light;
+ (JoltPropertySink *)sceneMaterialTransparency:(NSObject *)material;
+ (JoltPropertySink *)sceneMaterialDiffuse:(NSObject *)material;
+ (JoltPropertySink *)sceneMaterialEmission:(NSObject *)material;
/** Diagnostic count of undisposed appearance sinks (native targets are weak). */
+ (NSUInteger)sceneAppearanceSinkCount;
+ (NSUInteger)sceneAppearanceWriteCount;
@end
NS_ASSUME_NONNULL_END
