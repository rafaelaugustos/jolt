#import <UIKit/UIKit.h>

@interface JoltReorderHandle : UIButton
@property(nonatomic, copy) void (^onMove)(NSInteger direction);
@end

@interface JoltReorderSession : NSObject
+ (instancetype)attach:(UIScrollView *)list options:(NSString *)options onState:(void (^)(NSInteger state, NSInteger index, NSInteger toIndex))onState;
+ (BOOL)supportsCollections;
- (void)recycle:(UIView *)view;
- (void)registerHandle:(UIView *)view;
- (void)setEnabled:(BOOL)enabled;
- (void)setReducedMotion:(BOOL)reduced;
- (void)cancel;
- (UIGestureRecognizer *)recognizer:(NSString *)kind;
- (void)dispose;
@property(nonatomic, readonly) BOOL active;
@end
