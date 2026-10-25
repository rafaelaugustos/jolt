#import "JoltGestureSession.h"
#import <UIKit/UIGestureRecognizerSubclass.h>

static double clamp(double value, double minimum, double maximum) { return MAX(minimum, MIN(maximum, value)); }
@class JoltGestureSession;

/* Centroid tracking in window coordinates. Pointer membership changes rebase without movement. */
@interface JoltAxisPan : UIGestureRecognizer
@property(nonatomic, weak) JoltGestureSession *owner;
@property(nonatomic) NSMutableSet<UITouch *> *contacts;
@property(nonatomic) CGPoint previous, origin, delta, velocity;
@property(nonatomic) double previousTime, threshold, failOffset;
@property(nonatomic) NSInteger axis;
- (void)rebase;
@end

@interface JoltGestureSession () <UIGestureRecognizerDelegate, UIScrollViewDelegate>
@property(nonatomic, weak) UIView *surface;
@property(nonatomic, weak) UIScrollView *scroll;
@property(nonatomic) id<UIScrollViewDelegate> previousDelegate;
@property(nonatomic) JoltAxisPan *pan;
@property(nonatomic) UIPinchGestureRecognizer *pinch;
@property(nonatomic) UIRotationGestureRecognizer *rotate;
@property(nonatomic) UITapGestureRecognizer *tap, *doubleTap;
@property(nonatomic) JoltLiveSpring *x, *y, *scale, *rotation;
@property(nonatomic) double minX, maxX, minY, maxY, minScale, maxScale, velocityX, velocityY, scrollPosition;
@property(nonatomic, readwrite) BOOL active;
@property(nonatomic) BOOL enabled, disposed, contactEvents, contact, fromScroll, adjusting, ending, replayOnly;
@property(nonatomic, copy) void (^onState)(NSInteger, double, double);
- (void)touchStarted:(UITouch *)touch;
- (void)finish:(BOOL)cancelled;
- (void)applyScroll;
@end

@implementation JoltAxisPan
- (instancetype)initWithTarget:(id)target action:(SEL)action {
    if ((self = [super initWithTarget:target action:action])) self.contacts = [NSMutableSet new];
    return self;
}
- (CGPoint)centroid {
    CGPoint point = CGPointZero;
    for (UITouch *touch in self.contacts) { CGPoint p = [touch locationInView:nil]; point.x += p.x; point.y += p.y; }
    if (self.contacts.count) { point.x /= self.contacts.count; point.y /= self.contacts.count; }
    return point;
}
- (void)rebase { self.previous = [self centroid]; self.previousTime = CACurrentMediaTime(); self.delta = CGPointZero; self.velocity = CGPointZero; }
- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
    BOOL first = !self.contacts.count;
    [self.contacts unionSet:touches]; [self rebase];
    if (self.state == UIGestureRecognizerStatePossible) self.origin = self.previous;
    if (first) { self.origin = self.previous; [self.owner touchStarted:touches.anyObject]; }
}
- (void)touchesMoved:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
    CGPoint point = [self centroid]; double now = CACurrentMediaTime(), dt = MAX(.001, now - self.previousTime);
    self.delta = CGPointMake(point.x - self.previous.x, point.y - self.previous.y);
    self.velocity = CGPointMake(self.delta.x / dt, self.delta.y / dt);
    self.previous = point; self.previousTime = now;
    if (self.state == UIGestureRecognizerStatePossible) {
        double dx = fabs(point.x - self.origin.x), dy = fabs(point.y - self.origin.y);
        if ((self.axis == 1 && dy > self.failOffset) || (self.axis == 2 && dx > self.failOffset)) { self.state = UIGestureRecognizerStateFailed; return; }
        double distance = self.axis == 1 ? dx : self.axis == 2 ? dy : hypot(dx, dy);
        if (self.axis && distance >= self.threshold) self.state = UIGestureRecognizerStateBegan;
    } else if (self.state == UIGestureRecognizerStateBegan || self.state == UIGestureRecognizerStateChanged) self.state = UIGestureRecognizerStateChanged;
}
- (void)touchesEnded:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
    [self.contacts minusSet:touches];
    if (self.contacts.count) [self rebase];
    else {
        if (CACurrentMediaTime() - self.previousTime > .08) self.velocity = CGPointZero;
        self.owner.velocityX = (self.axis & 1) ? self.velocity.x : 0; self.owner.velocityY = (self.axis & 2) ? self.velocity.y : 0;
        self.state = self.state == UIGestureRecognizerStatePossible ? UIGestureRecognizerStateFailed : UIGestureRecognizerStateEnded;
        [self.owner finish:NO];
    }
}
- (void)touchesCancelled:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event { self.state = UIGestureRecognizerStateCancelled; [self.owner finish:YES]; }
- (void)reset { [super reset]; [self.contacts removeAllObjects]; self.delta = CGPointZero; self.velocity = CGPointZero; }
@end

@implementation JoltGestureSession
+ (BOOL)supportsContactEvents { return YES; }
+ (BOOL)hasSession:(UIView *)surface {
    for (UIGestureRecognizer *g in surface.gestureRecognizers) if ([g isKindOfClass:JoltAxisPan.class]) return YES;
    return NO;
}
+ (instancetype)attach:(UIView *)surface scroll:(UIScrollView *)scroll x:(JoltLiveSpring *)x y:(JoltLiveSpring *)y scale:(JoltLiveSpring *)scale rotation:(JoltLiveSpring *)rotation options:(NSString *)options onState:(void (^)(NSInteger,double,double))onState {
    NSDictionary *config = [NSJSONSerialization JSONObjectWithData:[options dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    if ([config[@"replay"] boolValue] && [self hasSession:surface])
        [NSException raise:NSInvalidArgumentException format:@"Replay requires an unowned gesture surface"];
    JoltGestureSession *s = [self new]; s.surface = surface; s.scroll = scroll; s.x = x; s.y = y; s.scale = scale; s.rotation = rotation;
    s.minX = [config[@"minX"] doubleValue]; s.maxX = [config[@"maxX"] doubleValue]; s.minY = [config[@"minY"] doubleValue]; s.maxY = [config[@"maxY"] doubleValue];
    s.minScale = [config[@"minScale"] doubleValue]; s.maxScale = [config[@"maxScale"] doubleValue]; s.onState = onState; s.enabled = YES;
    s.pan = [[JoltAxisPan alloc] initWithTarget:s action:@selector(panned:)]; s.pan.owner = s;
    s.pan.axis = [config[@"axis"] integerValue]; s.pan.threshold = [config[@"threshold"] doubleValue]; s.pan.failOffset = [config[@"failOffset"] doubleValue];
    s.pinch = [[UIPinchGestureRecognizer alloc] initWithTarget:s action:@selector(pinched:)];
    s.rotate = [[UIRotationGestureRecognizer alloc] initWithTarget:s action:@selector(rotated:)];
    s.tap = [[UITapGestureRecognizer alloc] initWithTarget:s action:@selector(tapped:)];
    s.doubleTap = [[UITapGestureRecognizer alloc] initWithTarget:s action:@selector(tapped:)]; s.doubleTap.numberOfTapsRequired = 2;
    [s.tap requireGestureRecognizerToFail:s.doubleTap];
    for (UIGestureRecognizer *g in @[s.pan, s.pinch, s.rotate, s.tap, s.doubleTap]) { g.delegate = s; [surface addGestureRecognizer:g]; }
    s.pinch.enabled = [config[@"pinch"] boolValue]; s.rotate.enabled = [config[@"rotate"] boolValue];
    s.contactEvents = [config[@"contactEvents"] boolValue];
    s.replayOnly = [config[@"replay"] boolValue];
    s.tap.enabled = [config[@"tap"] boolValue]; s.doubleTap.enabled = [config[@"doubleTap"] boolValue];
    if (s.replayOnly) for (UIGestureRecognizer *g in @[s.pan, s.pinch, s.rotate, s.tap, s.doubleTap]) g.enabled = NO;
    // NativeScript's scroll delegate is forwarded, never replaced with a JS per-frame bridge.
    if (scroll) { s.previousDelegate = scroll.delegate; scroll.delegate = s; }
    return s;
}
- (BOOL)respondsToSelector:(SEL)selector { return [super respondsToSelector:selector] || [self.previousDelegate respondsToSelector:selector]; }
- (void)refreshScrollDelegate {
    if (!self.disposed && self.scroll && self.scroll.delegate != self) {
        self.previousDelegate = self.scroll.delegate; self.scroll.delegate = self;
    }
}
- (id)forwardingTargetForSelector:(SEL)selector { return [self.previousDelegate respondsToSelector:selector] ? self.previousDelegate : [super forwardingTargetForSelector:selector]; }
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)first shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)second {
    if ([first isKindOfClass:UITapGestureRecognizer.class] || [second isKindOfClass:UITapGestureRecognizer.class]) return NO;
    return YES;
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)gesture shouldReceiveTouch:(UITouch *)touch {
    return self.enabled && !self.disposed;
}
- (void)touchStarted:(UITouch *)touch {
    if (self.disposed || !self.enabled) return;
    self.contact = YES; self.fromScroll = self.scroll && [touch.view isDescendantOfView:self.scroll];
    self.scrollPosition = MAX(-self.scroll.adjustedContentInset.top, self.scroll.contentOffset.y);
    self.velocityX = self.velocityY = 0;
    for (JoltLiveSpring *node in @[self.x, self.y, self.scale, self.rotation]) [node releaseInput:node.position velocity:0];
    if (self.contactEvents) [self emit:6];
}
- (void)emit:(NSInteger)state { if (!self.disposed && self.onState) self.onState(state, self.velocityX, self.velocityY); }
- (void)begin {
    if (self.active || self.disposed || !self.enabled) return;
    self.active = YES;
    for (JoltLiveSpring *node in @[self.x, self.y, self.scale, self.rotation]) [node holdInput:node.position velocity:0];
    [self emit:1];
}
- (void)panned:(JoltAxisPan *)pan {
    if (self.disposed || !self.enabled) return;
    if (pan.state == UIGestureRecognizerStateBegan || pan.state == UIGestureRecognizerStateChanged) {
        [self begin]; if (self.disposed || !self.enabled || !self.active) return;
        self.velocityX = (pan.axis & 1) ? pan.velocity.x : 0; self.velocityY = (pan.axis & 2) ? pan.velocity.y : 0;
        double dx = pan.delta.x, dy = pan.delta.y;
        if (self.fromScroll) {
            [self consumeScrollDelta:dy];
        } else {
            if (pan.axis & 1) [self.x holdInput:clamp(self.x.position + dx, self.minX, self.maxX) velocity:self.velocityX];
            if (pan.axis & 2) [self.y holdInput:clamp(self.y.position + dy, self.minY, self.maxY) velocity:self.velocityY];
        }
    } else if (pan.state == UIGestureRecognizerStateEnded) [self finish:NO];
    else if (pan.state == UIGestureRecognizerStateCancelled || pan.state == UIGestureRecognizerStateFailed) [self finish:YES];
}
// Shared by the OS recognizer and the isolated semantic replay adapter.
- (void)consumeScrollDelta:(double)dy {
    double oldY = self.y.position, nextY = oldY, top = -self.scroll.adjustedContentInset.top;
    if (dy < 0) { nextY = MAX(self.minY, oldY + dy); dy -= nextY - oldY; }
    else {
        double consumed = MIN(dy, MAX(0, self.scrollPosition - top));
        self.scrollPosition -= consumed; dy -= consumed;
        nextY = MIN(self.maxY, oldY + dy); dy -= nextY - oldY;
    }
    double bottom = MAX(top, self.scroll.contentSize.height - self.scroll.bounds.size.height + self.scroll.adjustedContentInset.bottom);
    self.scrollPosition = clamp(self.scrollPosition - dy, top, bottom);
    [self.y holdInput:nextY velocity:self.velocityY]; [self applyScroll];
}
+ (BOOL)supportsScrollReplay { return YES; }
- (void)replayScroll:(NSInteger)phase delta:(double)dy velocity:(double)velocity {
    if (!self.replayOnly || self.disposed || !self.scroll || !isfinite(dy) || !isfinite(velocity))
        [NSException raise:NSInvalidArgumentException format:@"Scroll replay needs an isolated replay session and finite input"];
    if (phase == 1) {
        [self cancel]; self.contact = YES; self.fromScroll = YES;
        self.scrollPosition = MAX(-self.scroll.adjustedContentInset.top, self.scroll.contentOffset.y);
        self.velocityX = self.velocityY = 0; [self begin];
    } else if (phase == 2 && self.contact) {
        self.velocityY = velocity; [self consumeScrollDelta:dy];
    } else if (phase == 3 || phase == 4) [self finish:phase == 4];
}
- (void)replayScrollOffset:(double)offset {
    if (!self.replayOnly || self.disposed || !isfinite(offset))
        [NSException raise:NSInvalidArgumentException format:@"Invalid scroll replay offset"];
    self.scrollPosition = -self.scroll.adjustedContentInset.top + offset; [self applyScroll];
}
- (void)pinched:(UIPinchGestureRecognizer *)gesture {
    if (self.fromScroll || self.disposed || !self.enabled) return;
    if (gesture.state == UIGestureRecognizerStateBegan || gesture.state == UIGestureRecognizerStateChanged) {
        [self begin]; if (self.disposed || !self.active) return;
        [self.scale holdInput:clamp(self.scale.position * gesture.scale, self.minScale, self.maxScale) velocity:0]; gesture.scale = 1;
    } else if (!self.pan.contacts.count) [self finish:gesture.state == UIGestureRecognizerStateCancelled];
}
- (void)rotated:(UIRotationGestureRecognizer *)gesture {
    if (self.fromScroll || self.disposed || !self.enabled) return;
    if (gesture.state == UIGestureRecognizerStateBegan || gesture.state == UIGestureRecognizerStateChanged) {
        [self begin]; if (self.disposed || !self.active) return;
        [self.rotation holdInput:self.rotation.position + gesture.rotation * 180 / M_PI velocity:0]; gesture.rotation = 0;
    } else if (!self.pan.contacts.count) [self finish:gesture.state == UIGestureRecognizerStateCancelled];
}
- (void)tapped:(UITapGestureRecognizer *)gesture { if (gesture.state == UIGestureRecognizerStateRecognized) [self emit:gesture == self.doubleTap ? 5 : 4]; }
- (void)applyScroll {
    if (!self.scroll || self.adjusting) return;
    self.adjusting = YES;
    [self.scroll setContentOffset:CGPointMake(self.scroll.contentOffset.x, self.scrollPosition) animated:NO];
    self.adjusting = NO;
}
- (void)scrollViewDidScroll:(UIScrollView *)scroll {
    if (self.contact && self.fromScroll && !self.adjusting) [self applyScroll];
    if (!self.adjusting && [self.previousDelegate respondsToSelector:_cmd]) [self.previousDelegate scrollViewDidScroll:scroll];
}
- (void)scrollViewWillEndDragging:(UIScrollView *)scroll withVelocity:(CGPoint)velocity targetContentOffset:(inout CGPoint *)target {
    if (self.y.position > self.minY + .01) target->y = scroll.contentOffset.y;
    if ([self.previousDelegate respondsToSelector:_cmd]) [self.previousDelegate scrollViewWillEndDragging:scroll withVelocity:velocity targetContentOffset:target];
}
- (void)finish:(BOOL)cancelled {
    BOOL hadContact = self.contact;
    self.contact = NO;
    if (!self.active) { if (hadContact && self.contactEvents) [self emit:7]; return; }
    self.active = NO;
    for (JoltLiveSpring *node in @[self.x, self.y, self.scale, self.rotation]) [node releaseInput:node.position velocity:0];
    self.ending = !cancelled;
    @try { [self emit:cancelled ? 3 : 2]; } @finally { self.ending = NO; }
    if (hadContact && self.contactEvents) [self emit:7];
}
- (void)cancel {
    if (self.active) [self finish:YES];
    else {
        [self finish:YES];
        for (JoltLiveSpring *node in @[self.x, self.y, self.scale, self.rotation]) [node releaseInput:node.position velocity:0];
    }
    for (UIGestureRecognizer *g in @[self.pan, self.pinch, self.rotate, self.tap, self.doubleTap]) if (g.enabled) { g.enabled = NO; g.enabled = YES; }
}
- (void)setEnabled:(BOOL)value { _enabled = value; if (!value) [self cancel]; }
- (void)settleX:(double)x y:(double)y scale:(double)scale rotation:(double)rotation animated:(BOOL)animated {
    if (self.disposed) return;
    double vx = self.ending ? self.velocityX : self.x.velocity, vy = self.ending ? self.velocityY : self.y.velocity;
    [self cancel];
    double targets[] = {clamp(x, self.minX, self.maxX), clamp(y, self.minY, self.maxY), clamp(scale, self.minScale, self.maxScale), rotation};
    NSArray *nodes = @[self.x, self.y, self.scale, self.rotation];
    for (NSUInteger i = 0; i < nodes.count; i++) {
        JoltLiveSpring *node = nodes[i];
        if (!animated) [node holdInput:targets[i] velocity:0];
        [node releaseInput:targets[i] velocity:animated ? i == 0 ? vx : i == 1 ? vy : 0 : 0];
    }
}
- (void)updateLeft:(double)left right:(double)right top:(double)top bottom:(double)bottom { self.minX = left; self.maxX = right; self.minY = top; self.maxY = bottom; }
- (void)dispose {
    if (self.disposed) return;
    [self cancel]; self.disposed = YES;
    for (UIGestureRecognizer *g in @[self.pan, self.pinch, self.rotate, self.tap, self.doubleTap]) [self.surface removeGestureRecognizer:g];
    if (self.scroll.delegate == self) self.scroll.delegate = self.previousDelegate;
    self.previousDelegate = nil; self.onState = nil;
}
@end
