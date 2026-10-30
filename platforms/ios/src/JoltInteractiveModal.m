#import "JoltInteractiveModal.h"
#import "JoltSpringState.h"

@interface JoltInteractiveModal () {
    JoltSpringState _spring;
}
@property(nonatomic, weak) UIViewController *controller;
@property(nonatomic) UIPanGestureRecognizer *pan;
@property(nonatomic, copy) BOOL (^shouldBegin)(void);
@property(nonatomic, copy) void (^onEvent)(NSInteger);
@property(nonatomic) id<UIViewControllerContextTransitioning> context;
@property(nonatomic) UIView *moving;
@property(nonatomic) CGAffineTransform originalTransform;
@property(nonatomic) CGRect bounds;
@property(nonatomic) CADisplayLink *link;
@property(nonatomic) double stiffness, damping, mass, previous, started, target, timeScale;
@property(nonatomic) NSNumber *pendingEnd;
@property(nonatomic, readwrite) BOOL interactive;
@property(nonatomic) BOOL presenting, reduced, settling, committed, disposed;
@end

@implementation JoltInteractiveModal
static NSUInteger active = 0, recognizers = 0;
+ (NSUInteger)activeCount { return active; }
+ (NSUInteger)recognizerCount { return recognizers; }
+ (instancetype)attach:(UIViewController *)controller stiffness:(double)stiffness damping:(double)damping mass:(double)mass shouldBegin:(BOOL (^)(void))shouldBegin onEvent:(void (^)(NSInteger))onEvent {
    JoltInteractiveModal *owner = [self new];
    owner.controller = controller;
    owner.stiffness = stiffness; owner.damping = damping; owner.mass = mass;
    owner.timeScale = 1;
    owner.shouldBegin = shouldBegin; owner.onEvent = onEvent;
    owner.pan = [[UIPanGestureRecognizer alloc] initWithTarget:owner action:@selector(pan:)];
    owner.pan.maximumNumberOfTouches = 1;
    owner.pan.delegate = owner;
    [controller.view addGestureRecognizer:owner.pan]; recognizers++;
    [[NSNotificationCenter defaultCenter] addObserver:owner selector:@selector(cancel) name:UIApplicationWillResignActiveNotification object:nil];
    return owner;
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceiveTouch:(UITouch *)touch {
    // Scrolling content and native controls keep their own interaction. A modal
    // can expose an ordinary, non-scrolling header as its dismissal surface.
    for (UIView *view = touch.view; view; view = view.superview) {
        if ([view isKindOfClass:UIControl.class] || [view isKindOfClass:UIScrollView.class]) return NO;
        if (view == self.controller.view) break;
    }
    return YES;
}
- (BOOL)gestureRecognizerShouldBegin:(UIGestureRecognizer *)recognizer {
    UIViewController *controller = self.controller;
    CGPoint velocity = [self.pan velocityInView:controller.view];
    return !self.disposed && !self.context && controller.presentingViewController &&
        !controller.presentedViewController && !controller.transitionCoordinator && !controller.modalInPresentation &&
        velocity.y > fabs(velocity.x) && self.shouldBegin && self.shouldBegin();
}
- (void)preparePresenting:(BOOL)presenting reduced:(BOOL)reduced timeScale:(double)timeScale {
    self.presenting = presenting; self.reduced = reduced; self.timeScale = timeScale;
}
- (void)pan:(UIPanGestureRecognizer *)pan {
    if (pan.state == UIGestureRecognizerStateBegan) {
        self.pendingEnd = nil; self.interactive = YES;
        _spring = (JoltSpringState){0, 0};
        if (self.onEvent) self.onEvent(2);
    }
    if (!self.interactive || self.settling) return;
    double height = MAX(1, self.context ? self.bounds.size.height : self.controller.view.bounds.size.height);
    double progress = MAX(0, MIN(1, [pan translationInView:self.controller.view].y / height));
    double velocity = [pan velocityInView:self.controller.view].y / height;
    _spring = (JoltSpringState){progress, velocity};
    if (self.context) { [self render:progress]; [self.context updateInteractiveTransition:progress]; }
    if (pan.state == UIGestureRecognizerStateEnded || pan.state == UIGestureRecognizerStateCancelled || pan.state == UIGestureRecognizerStateFailed) {
        BOOL finish = pan.state == UIGestureRecognizerStateEnded && progress + velocity * .16 > .5;
        if (self.context) [self settle:finish velocity:velocity];
        else self.pendingEnd = @(finish);
    }
}
- (NSTimeInterval)transitionDuration:(id<UIViewControllerContextTransitioning>)context { return self.reduced ? 0 : .55; }
- (BOOL)wantsInteractiveStart { return self.interactive; }
- (CGFloat)completionSpeed { return 1; }
- (UIViewAnimationCurve)completionCurve { return UIViewAnimationCurveLinear; }
- (double)progress { return _spring.position; }
- (double)velocity { return _spring.velocity; }
- (void)prepare:(id<UIViewControllerContextTransitioning>)context {
    self.context = context; active++;
    UIViewController *controller = [context viewControllerForKey:self.presenting ? UITransitionContextToViewControllerKey : UITransitionContextFromViewControllerKey];
    self.moving = [context viewForKey:self.presenting ? UITransitionContextToViewKey : UITransitionContextFromViewKey] ?: controller.view;
    self.originalTransform = self.moving.transform;
    if (self.presenting) {
        self.moving.frame = [context finalFrameForViewController:controller];
        [context.containerView addSubview:self.moving];
    }
    [self.moving setNeedsLayout]; [self.moving layoutIfNeeded];
    self.bounds = context.containerView.bounds;
    _spring = (JoltSpringState){0, 0};
    [self render:0];
}
- (void)startInteractiveTransition:(id<UIViewControllerContextTransitioning>)context {
    JoltSpringState held = _spring;
    [self prepare:context]; _spring = held;
    [self render:_spring.position]; [context updateInteractiveTransition:_spring.position];
    [self startLink];
    if (self.pendingEnd || self.disposed) {
        [self settle:!self.disposed && self.pendingEnd.boolValue velocity:_spring.velocity];
        self.pendingEnd = nil;
    }
}
- (void)animateTransition:(id<UIViewControllerContextTransitioning>)context {
    [self prepare:context];
    if (self.onEvent) self.onEvent(0);
    [self settle:YES velocity:0];
}
- (void)render:(double)progress {
    double p = MAX(0, MIN(1, progress));
    double translation = self.bounds.size.height * (self.presenting ? 1 - p : p);
    [CATransaction begin]; [CATransaction setDisableActions:YES];
    self.moving.transform = CGAffineTransformConcat(self.originalTransform, CGAffineTransformMakeTranslation(0, translation));
    [CATransaction commit];
}
- (void)startLink {
    if (self.link || !self.context) return;
    self.previous = CACurrentMediaTime();
    self.link = [CADisplayLink displayLinkWithTarget:self selector:@selector(tick:)];
    if (@available(iOS 15.0, *)) {
        float maximum = MIN(120, UIScreen.mainScreen.maximumFramesPerSecond);
        self.link.preferredFrameRateRange = CAFrameRateRangeMake(MIN(80, maximum), maximum, maximum);
    }
    [self.link addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
}
- (void)settle:(BOOL)finish velocity:(double)velocity {
    if (!self.context || self.settling) return;
    self.committed = finish; self.settling = YES; self.target = finish ? 1 : 0;
    _spring.velocity = velocity;
    if (self.interactive) {
        // Core must know cancellation BEFORE UIKit executes dismissal completion.
        if (self.onEvent) self.onEvent(finish ? 3 : 4);
        if (!self.context) return;
        if (finish) [self.context finishInteractiveTransition]; else [self.context cancelInteractiveTransition];
    }
    self.started = CACurrentMediaTime(); self.previous = self.started;
    if (self.reduced || self.disposed) { [self finish]; return; }
    [self startLink];
}
- (void)tick:(CADisplayLink *)link {
    if (!CGRectEqualToRect(self.bounds, self.context.containerView.bounds) || !self.context.containerView.window) { [self cancel]; return; }
    if (!self.settling) return;
    double now = CACurrentMediaTime(), seconds = MAX(0, now - self.previous); self.previous = now;
    _spring = JoltSpringAdvance(_spring, self.target, self.stiffness*self.timeScale*self.timeScale, self.damping*self.timeScale, self.mass, seconds);
    if (!isfinite(_spring.position) || !isfinite(_spring.velocity)) { [self finish]; return; }
    [self render:_spring.position];
    if ((fabs(_spring.position-self.target)<.0005 && fabs(_spring.velocity)<.005) || now-self.started>=3) [self finish];
}
- (void)finish {
    if (!self.context) return;
    [self.link invalidate]; self.link = nil;
    BOOL completed = self.committed, presenting = self.presenting;
    _spring = (JoltSpringState){completed ? 1 : 0, 0}; [self render:_spring.position];
    self.moving.transform = self.originalTransform;
    id<UIViewControllerContextTransitioning> context = self.context;
    self.context = nil; self.moving = nil; self.settling = NO; self.interactive = NO; active--;
    [context completeTransition:completed];
    if (self.onEvent) self.onEvent(presenting ? 1 : completed ? 5 : 6);
}
- (void)cancel {
    if (!self.context) { if (self.interactive) self.pendingEnd = @NO; return; }
    if (!self.settling) [self settle:!self.interactive velocity:0];
    [self finish];
}
- (void)dispose {
    if (self.disposed) return;
    self.disposed = YES;
    [self cancel];
    [self.pan.view removeGestureRecognizer:self.pan];
    self.pan.delegate = nil;
    if (self.pan) recognizers--;
    self.pan = nil;
    [[NSNotificationCenter defaultCenter] removeObserver:self];
    self.shouldBegin = nil; self.onEvent = nil;
}
@end
