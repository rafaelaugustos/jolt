#import <UIKit/UIKit.h>
NS_ASSUME_NONNULL_BEGIN
/// Removable native recognition relationships. Original delegates and input listeners are preserved.
@interface JoltGestureLink : NSObject
+ (instancetype)connect:(UIGestureRecognizer *)first other:(UIGestureRecognizer *)second relation:(NSString *)relation;
+ (void)detach:(UIGestureRecognizer *)recognizer;
- (void)dispose;
@end
NS_ASSUME_NONNULL_END
