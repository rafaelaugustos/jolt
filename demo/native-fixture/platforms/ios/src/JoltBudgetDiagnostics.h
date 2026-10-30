#import <UIKit/UIKit.h>

@interface JoltBudgetInputProbe : UIGestureRecognizer
+ (instancetype)watch:(UIView *)surface delay:(NSInteger)milliseconds;
- (NSString *)finish;
- (void)cancel;
@end

@interface JoltBudgetRetention : NSObject
- (void)watch:(UIView *)view;
- (void)reset;
- (NSString *)snapshot;
@end
