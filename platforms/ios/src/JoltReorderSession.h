#import <UIKit/UIKit.h>

@interface JoltReorderHandle : UIButton
@property(nonatomic, copy) void (^onMove)(NSInteger direction);
@end

@interface JoltReorderSession : NSObject
+ (instancetype)attach:(UITableView *)list options:(NSString *)options onState:(void (^)(NSInteger state, NSInteger index, NSInteger toIndex))onState;
- (void)registerHandle:(UIView *)view;
- (void)setEnabled:(BOOL)enabled;
- (void)setReducedMotion:(BOOL)reduced;
- (void)cancel;
- (void)dispose;
@property(nonatomic, readonly) BOOL active;
@end
