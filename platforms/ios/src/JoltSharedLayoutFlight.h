#import <UIKit/UIKit.h>
@interface JoltSharedLayoutFlight : UIView
+ (instancetype)capture:(UIView *)view image:(BOOL)image radius:(double)radius maxPixels:(double)maxPixels;
+ (instancetype)captureNavigationImage:(UIView *)view radius:(double)radius maxPixels:(double)maxPixels;
- (NSString *)prepareNavigationImage:(UIView *)view radius:(double)radius maxPixels:(double)maxPixels;
+ (NSInteger)activeCount;
- (BOOL)holdPage:(UIView *)page maxPixels:(double)maxPixels;
- (void)fade:(double)duration onEnd:(void (^)(BOOL))onEnd;
- (double)pixels;
- (NSString *)state;
- (NSString *)prepare:(UIView *)view image:(BOOL)image radius:(double)radius maxPixels:(double)maxPixels;
- (BOOL)freeze:(double)maxPixels;
- (void)play:(NSString *)configuration onEnd:(void (^)(BOOL))onEnd;
- (BOOL)beginInteractive:(NSString *)geometry;
- (void)updateInteractive:(double)progress;
- (BOOL)destinationIsStable;
- (void)dispose;
@end
