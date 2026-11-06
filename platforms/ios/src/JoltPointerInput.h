#import <UIKit/UIKit.h>
NS_ASSUME_NONNULL_BEGIN
@interface JoltPointerInput : NSObject <UIGestureRecognizerDelegate>
+ (nullable instancetype)attach:(UIView *)view change:(void (^)(double x, double y, double width, double height, BOOL active))change;
- (void)refresh;
- (void)dispose;
@end
NS_ASSUME_NONNULL_END
