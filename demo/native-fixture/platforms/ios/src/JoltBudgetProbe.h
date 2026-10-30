#import <UIKit/UIKit.h>

/** Demo-only recorder. No JavaScript callbacks and no shipping-library dependency. */
@interface JoltBudgetProbe : NSObject
+ (NSString *)environment;
+ (NSString *)resources;
+ (instancetype)start:(UIView *)target;
- (NSString *)finish;
- (void)cancel;
@end
