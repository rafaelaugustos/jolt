#import <Foundation/Foundation.h>
#import "JoltLiveSpring.h"
@interface JoltSensorSource : NSObject
+ (instancetype)create:(NSString *)kind options:(NSString *)options onState:(void (^)(void))onState;
+ (NSUInteger)activeCount;
+ (NSUInteger)sourceCount;
- (void)connect:(JoltLiveSpring *)node index:(NSInteger)index;
- (void)setEnabled:(BOOL)enabled paused:(BOOL)paused;
- (void)recenter;
- (void)replay:(NSString *)trace;
- (NSString *)snapshot;
- (void)dispose;
@end
