#import <UIKit/UIKit.h>
#import "JoltLiveSpring.h"
NS_ASSUME_NONNULL_BEGIN
@interface JoltScrollHeader : NSObject
+ (instancetype)attach:(UITableView *)list node:(JoltLiveSpring *)node title:(UIView *)title toolbarTitle:(UIView *)toolbarTitle toolbar:(UIView *)toolbar diagnostic:(nullable UILabel *)diagnostic options:(NSString *)options onState:(void (^)(void))onState;
+ (NSInteger)activeCount;
- (void)configure:(NSString *)options;
- (NSString *)snapshot;
- (void)scroll:(double)offset animated:(BOOL)animated;
- (void)setEnabled:(BOOL)enabled;
- (void)dispose;
@end
NS_ASSUME_NONNULL_END
