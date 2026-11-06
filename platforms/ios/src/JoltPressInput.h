#import <UIKit/UIKit.h>
NS_ASSUME_NONNULL_BEGIN
/** Observes contact without forwarding UIKit touches or synthesizing actions. */
@interface JoltPressInput : UIGestureRecognizer <UIGestureRecognizerDelegate>
+ (instancetype)attach:(UIView *)view change:(void (^)(NSString *action))change;
- (void)dispose;
@end
NS_ASSUME_NONNULL_END
