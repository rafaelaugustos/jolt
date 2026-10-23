#import <UIKit/UIKit.h>
#import "JoltLiveSpring.h"

NS_ASSUME_NONNULL_BEGIN
@interface JoltGestureSession : NSObject
@property(nonatomic, readonly) BOOL active;
+ (BOOL)supportsContactEvents;
+ (instancetype)attach:(UIView *)surface scroll:(nullable UIScrollView *)scroll
                     x:(JoltLiveSpring *)x y:(JoltLiveSpring *)y scale:(JoltLiveSpring *)scale rotation:(JoltLiveSpring *)rotation
               options:(NSString *)options onState:(void (^)(NSInteger, double, double))onState;
- (void)cancel;
- (void)refreshScrollDelegate;
- (void)setEnabled:(BOOL)enabled;
- (void)settleX:(double)x y:(double)y scale:(double)scale rotation:(double)rotation animated:(BOOL)animated;
- (void)updateLeft:(double)left right:(double)right top:(double)top bottom:(double)bottom;
- (void)dispose;
@end
NS_ASSUME_NONNULL_END
