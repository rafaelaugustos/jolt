#import <UIKit/UIKit.h>

/** Inert until explicitly started by the optional development inspector. */
@interface JoltMotionProbe : NSObject
+ (instancetype)startView:(UIView *)view capacity:(NSInteger)capacity hertz:(double)hertz;
+ (NSInteger)activeCount;
- (NSString *)drain;
- (void)dispose;
@end
