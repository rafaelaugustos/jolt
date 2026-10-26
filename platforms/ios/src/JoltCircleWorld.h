#import <UIKit/UIKit.h>
NS_ASSUME_NONNULL_BEGIN
@interface JoltCircleWorld : NSObject
+ (instancetype)create:(UIView *)container options:(NSString *)options;
- (void)connect:(UIView *)view index:(NSInteger)index;
- (void)setEnabled:(BOOL)enabled;
- (void)resize:(double)width height:(double)height;
- (void)impulse:(NSInteger)index x:(double)x y:(double)y;
- (void)reset;
- (NSString *)snapshot;
- (void)dispose;
+ (NSUInteger)worldCount;
+ (NSUInteger)activeCount;
@end
NS_ASSUME_NONNULL_END
