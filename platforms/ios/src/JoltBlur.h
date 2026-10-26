#import <UIKit/UIKit.h>
NS_ASSUME_NONNULL_BEGIN
@interface JoltBlur : NSObject
+ (instancetype)attach:(UIView *)view options:(NSString *)options;
+ (NSInteger)liveCount;
+ (NSInteger)activeCount;
- (void)paint:(double)amount;
- (void)play:(NSString *)program;
- (void)control:(double)time paused:(BOOL)paused;
- (void)resize;
- (NSString *)snapshot;
- (void)dispose;
@end
NS_ASSUME_NONNULL_END
