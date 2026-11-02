#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN
/** Shared retained paint surface; frames never cross into JavaScript. */
@interface JoltLivePaint : NSObject
+ (void)configure:(UIView *)view config:(NSString *)config border:(nullable CALayer *)border;
+ (void)refresh:(UIView *)view config:(NSString *)config border:(nullable CALayer *)border;
+ (instancetype)acquire:(UIView *)view property:(NSString *)property owner:(id)owner;
- (void)write:(double)value property:(NSString *)property owner:(id)owner;
- (void)releaseProperty:(NSString *)property owner:(id)owner;
@end
NS_ASSUME_NONNULL_END
