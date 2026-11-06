#import "JoltPointerInput.h"
@interface JoltHoverRecognizer : UIHoverGestureRecognizer
@end
@implementation JoltHoverRecognizer
- (BOOL)canPreventGestureRecognizer:(UIGestureRecognizer *)other { return NO; }
- (BOOL)canBePreventedByGestureRecognizer:(UIGestureRecognizer *)other { return NO; }
@end
@interface JoltPointerInput ()
@property(nonatomic, weak) UIView *target;
@property(nonatomic, strong) UIHoverGestureRecognizer *hover API_AVAILABLE(ios(13.0));
@property(nonatomic, copy, nullable) void (^change)(double, double, double, double, BOOL);
@end
@implementation JoltPointerInput
+ (instancetype)attach:(UIView *)view change:(void (^)(double,double,double,double,BOOL))change {
    if (@available(iOS 13.0, *)) {
        if (UIDevice.currentDevice.userInterfaceIdiom != UIUserInterfaceIdiomPad) return nil;
        JoltPointerInput *source = [self new];
        source.target = view; source.change = change;
        source.hover = [[JoltHoverRecognizer alloc] initWithTarget:source action:@selector(moved:)];
        source.hover.cancelsTouchesInView = NO;
        source.hover.delaysTouchesBegan = NO;
        source.hover.delaysTouchesEnded = NO;
        if (@available(iOS 13.4, *)) source.hover.allowedTouchTypes = @[@(UITouchTypeIndirectPointer), @(UITouchTypePencil)];
        source.hover.delegate = source;
        [view addGestureRecognizer:source.hover];
        return source;
    }
    return nil;
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)other { return YES; }
- (void)moved:(UIHoverGestureRecognizer *)recognizer API_AVAILABLE(ios(13.0)) { [self refresh]; }
- (void)refresh {
    if (@available(iOS 13.0, *)) {
        UIView *view = self.target;
        if (!view || !self.change) return;
        CGPoint p = [self.hover locationInView:view];
        CGRect b = view.bounds;
        BOOL active = view.window && !view.hidden && (self.hover.state == UIGestureRecognizerStateBegan || self.hover.state == UIGestureRecognizerStateChanged);
        self.change(p.x - CGRectGetMidX(b), p.y - CGRectGetMidY(b), b.size.width, b.size.height, active);
    }
}
- (void)dispose {
    self.change = nil;
    if (@available(iOS 13.0, *)) { [self.target removeGestureRecognizer:self.hover]; self.hover.delegate = nil; self.hover = nil; }
    self.target = nil;
}
@end
