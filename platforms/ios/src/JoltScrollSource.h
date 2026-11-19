#import <UIKit/UIKit.h>
@class JoltLiveSpring;
@interface JoltScrollSource : NSObject
+ (instancetype)attach:(UIScrollView *)source node:(JoltLiveSpring *)node horizontal:(BOOL)horizontal changed:(void(^)(void))changed;
+ (NSUInteger)activeCount;
- (void)setEnabled:(BOOL)enabled;
- (void)setObserving:(BOOL)observing;
- (void)refresh;
- (void)setProfiling:(BOOL)enabled;
- (NSString *)snapshot;
- (void)dispose;
@end
