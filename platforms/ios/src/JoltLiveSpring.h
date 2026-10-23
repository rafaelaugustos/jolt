#import <UIKit/UIKit.h>
NS_ASSUME_NONNULL_BEGIN
@class JoltLiveSpringBinding;
@interface JoltLiveSpring : NSObject
+ (instancetype)create:(double)initial stiffness:(double)stiffness damping:(double)damping mass:(double)mass
             restDelta:(double)restDelta restSpeed:(double)restSpeed reduced:(BOOL)reduced;
@property(nonatomic, readonly) double position;
@property(nonatomic, readonly) double velocity;
@property(nonatomic, readonly) BOOL moving;
+ (NSUInteger)activeCount;
+ (NSUInteger)nodeCount;
+ (void)sync:(UIView *)view;
- (void)follow:(JoltLiveSpring *)source mappings:(NSString *)mappings;
- (void)updateInput:(NSString *)snapshot;
- (void)setTarget:(double)value;
- (void)holdInput:(double)value velocity:(double)velocity;
- (void)releaseInput:(double)target velocity:(double)velocity;
- (void)setReduced:(BOOL)value;
- (void)setPaused:(BOOL)value;
- (JoltLiveSpringBinding *)bind:(UIView *)view property:(NSString *)property mappings:(NSString *)mappings;
- (void)dispose;
@end
@interface JoltLiveSpringBinding : NSObject
@property(nonatomic, readonly) double value;
- (void)setLayers:(NSString *)inputs;
- (void)cancel;
@end
NS_ASSUME_NONNULL_END
