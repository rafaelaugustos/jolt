#import <UIKit/UIKit.h>
@interface JoltSharedLayoutFlight : UIView
+ (instancetype)capture:(UIView *)view image:(BOOL)image radius:(double)radius maxPixels:(double)maxPixels;
+ (NSInteger)activeCount;
- (double)pixels;
- (NSString *)state;
- (NSString *)prepare:(UIView *)view image:(BOOL)image radius:(double)radius maxPixels:(double)maxPixels;
- (BOOL)freeze:(double)maxPixels;
- (void)play:(NSString *)configuration onEnd:(void (^)(BOOL))onEnd;
- (void)dispose;
@end
