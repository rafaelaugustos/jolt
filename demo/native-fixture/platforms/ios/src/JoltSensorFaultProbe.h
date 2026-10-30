#import <Foundation/Foundation.h>
/** Demo-only controlled Core Motion failure; never part of the shipped Jolt library. */
@interface JoltSensorFaultProbe : NSObject
+ (void)install;
+ (void)stopDelivery;
+ (void)failAccess;
@end
