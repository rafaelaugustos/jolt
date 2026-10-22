#import "JoltPropertyPlayer.h"
NS_ASSUME_NONNULL_BEGIN
@interface JoltReferenceProperties : NSObject
+ (JoltPropertySink *)mapCoordinate:(NSObject *)annotation;
+ (JoltPropertySink *)mapCamera:(NSObject *)mapView;
+ (JoltPropertySink *)scenePose:(NSObject *)node;
@end
NS_ASSUME_NONNULL_END
