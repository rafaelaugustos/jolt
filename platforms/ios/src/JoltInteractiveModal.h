#import <UIKit/UIKit.h>
NS_ASSUME_NONNULL_BEGIN

/** Animator supplied through Core's modal transition delegate. No delegate replacement. */
@interface JoltInteractiveModal : NSObject <UIViewControllerAnimatedTransitioning, UIViewControllerInteractiveTransitioning, UIGestureRecognizerDelegate>
+ (instancetype)attach:(UIViewController *)controller stiffness:(double)stiffness damping:(double)damping mass:(double)mass shouldBegin:(BOOL (^)(void))shouldBegin onEvent:(void (^)(NSInteger))onEvent;
+ (NSUInteger)activeCount;
+ (NSUInteger)recognizerCount;
@property(nonatomic, readonly) BOOL interactive;
@property(nonatomic, readonly) double progress;
@property(nonatomic, readonly) double velocity;
- (void)preparePresenting:(BOOL)presenting reduced:(BOOL)reduced timeScale:(double)timeScale;
- (void)cancel;
- (void)dispose;
@end
NS_ASSUME_NONNULL_END
