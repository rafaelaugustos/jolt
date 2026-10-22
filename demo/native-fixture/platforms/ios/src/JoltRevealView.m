#import "JoltRevealView.h"
@implementation JoltRevealView
- (void)setReveal:(double)value { _reveal = value; [self setNeedsDisplay]; }
- (void)drawRect:(CGRect)rect {
    [[UIColor colorWithRed:0.08 green:0.72 blue:0.65 alpha:1] setFill];
    UIRectFill(CGRectMake(0, 0, self.bounds.size.width * fmax(0, fmin(1, _reveal)), self.bounds.size.height));
}
@end
