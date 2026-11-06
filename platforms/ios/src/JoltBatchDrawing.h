#import <UIKit/UIKit.h>
@interface JoltBatchDrawing : CALayer
+ (instancetype)attach:(UIView *)view;
+ (NSInteger)liveCount;
- (BOOL)apply:(NSString *)program;
@property(nonatomic, copy, readonly) NSString *lastError;
- (void)resize;
- (void)dispose;
@end
