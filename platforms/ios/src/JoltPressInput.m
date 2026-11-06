#import "JoltPressInput.h"

@interface JoltPressInput ()
@property(nonatomic, copy, nullable) void (^change)(NSString *);
@property(nonatomic) BOOL contact;
@end

@implementation JoltPressInput
+ (instancetype)attach:(UIView *)view change:(void (^)(NSString *))change {
    JoltPressInput *input = [[self alloc] initWithTarget:nil action:nil];
    input.change = change;
    input.cancelsTouchesInView = NO;
    input.delaysTouchesBegan = NO;
    input.delaysTouchesEnded = NO;
    input.delegate = input;
    [view addGestureRecognizer:input];
    return input;
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)gestureRecognizer
        shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)other {
    return YES;
}
- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
    if (!self.contact && self.change) {
        self.contact = YES;
        self.change(@"down");
    }
}
- (void)touchesMoved:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {}
- (void)touchesEnded:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
    if (self.contact && self.change) self.change(@"up");
    self.contact = NO;
    self.state = UIGestureRecognizerStateFailed;
}
- (void)touchesCancelled:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
    if (self.contact && self.change) self.change(@"cancel");
    self.contact = NO;
    self.state = UIGestureRecognizerStateFailed;
}
- (void)reset {
    [super reset];
    if (self.contact && self.change) self.change(@"cancel");
    self.contact = NO;
}
- (void)dispose {
    // Detaching a recognizer can synchronously reset it. Clear callbacks first.
    self.change = nil;
    self.contact = NO;
    [self.view removeGestureRecognizer:self];
    self.delegate = nil;
}
@end
