#import <UIKit/UIKit.h>
NS_ASSUME_NONNULL_BEGIN

/** Frame's delegate supplies this object to UIKit; it never replaces that delegate. */
@interface JoltInteractiveNavigation : NSObject <UIViewControllerAnimatedTransitioning, UIViewControllerInteractiveTransitioning, UIGestureRecognizerDelegate>
+ (instancetype)attach:(UINavigationController *)navigation stiffness:(double)stiffness
                damping:(double)damping mass:(double)mass
            shouldBegin:(BOOL (^)(void))shouldBegin onEvent:(void (^)(NSInteger))onEvent;
+ (NSUInteger)activeCount;
+ (NSUInteger)recognizerCount;
@property(nonatomic, readonly) BOOL interactive;
@property(nonatomic, readonly) double progress;
@property(nonatomic, readonly) double velocity;
@property(nonatomic) BOOL sharedEnabled;
@property(nonatomic) BOOL sharedDeferred;
- (void)completeSharedPreparation;
- (BOOL)prepareSharedFrom:(UIView *)from to:(UIView *)to image:(BOOL)image fromRadius:(double)fromRadius toRadius:(double)toRadius maxPixels:(double)maxPixels;
- (void)prepareOperation:(NSInteger)operation presented:(UIViewController *)presented reduced:(BOOL)reduced timeScale:(double)timeScale;
- (void)sync;
- (void)cancel;
- (void)disposeRestoringSwipe:(BOOL)enabled;
@end
NS_ASSUME_NONNULL_END
