#import <UIKit/UIKit.h>
NS_ASSUME_NONNULL_BEGIN
/** Native input and previews for retained rows in an existing UIScrollView. */
@interface JoltRealizedReorder : NSObject
+ (instancetype)attach:(UIScrollView *)scroll container:(UIView *)container options:(NSString *)options onState:(void (^)(NSInteger, NSInteger, NSInteger))onState;
+ (NSInteger)activeCount;
- (void)setRows:(NSArray<UIView *> *)rows handles:(NSArray<UIView *> *)handles;
- (void)setEnabled:(BOOL)enabled;
- (void)setReducedMotion:(BOOL)reduced;
- (void)cancel;
- (void)dispose;
@end
NS_ASSUME_NONNULL_END
