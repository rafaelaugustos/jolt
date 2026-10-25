#import "JoltInteractiveNavigation.h"
#import "JoltSpringState.h"
#import "JoltSharedLayoutFlight.h"

@interface JoltInteractiveNavigation () {
    JoltSpringState _spring;
}
@property(nonatomic, weak) UINavigationController *navigation;
@property(nonatomic, weak) UIViewController *presented;
@property(nonatomic) UIScreenEdgePanGestureRecognizer *pan;
@property(nonatomic, copy) BOOL (^shouldBegin)(void);
@property(nonatomic, copy) void (^onEvent)(NSInteger);
@property(nonatomic) id<UIViewControllerContextTransitioning> context;
@property(nonatomic) UIView *fromView, *toView, *shade;
@property(nonatomic) CGAffineTransform fromTransform, toTransform;
@property(nonatomic) CGFloat fromAlpha, toAlpha;
@property(nonatomic) JoltSharedLayoutFlight *sharedFlight;
@property(nonatomic) CGRect bounds;
@property(nonatomic) CADisplayLink *link;
@property(nonatomic) double stiffness, damping, mass, started, previous, target, direction, timeScale;
@property(nonatomic) NSInteger operation;
@property(nonatomic) NSNumber *pendingEnd;
@property(nonatomic, readwrite) BOOL interactive;
@property(nonatomic) BOOL reduced, settling, committed, disposed, suppressed, sharedPending;
@property(nonatomic) double pendingStarted, rawProgress, gestureOffset;
@end

@implementation JoltInteractiveNavigation
static NSUInteger active = 0, recognizers = 0;
+ (NSUInteger)activeCount { return active; }
+ (NSUInteger)recognizerCount { return recognizers; }
+ (instancetype)attach:(UINavigationController *)navigation stiffness:(double)stiffness
                damping:(double)damping mass:(double)mass
            shouldBegin:(BOOL (^)(void))shouldBegin onEvent:(void (^)(NSInteger))onEvent {
    JoltInteractiveNavigation *owner = [self new];
    owner.navigation = navigation;
    owner.stiffness = stiffness; owner.damping = damping; owner.mass = mass;
    owner.shouldBegin = shouldBegin; owner.onEvent = onEvent;
    owner.pan = [[UIScreenEdgePanGestureRecognizer alloc] initWithTarget:owner action:@selector(pan:)];
    owner.pan.delegate = owner;
    owner.direction = navigation.view.effectiveUserInterfaceLayoutDirection == UIUserInterfaceLayoutDirectionRightToLeft ? -1 : 1;
    owner.pan.edges = owner.direction < 0 ? UIRectEdgeRight : UIRectEdgeLeft;
    [navigation.view addGestureRecognizer:owner.pan];
    recognizers++;
    [[NSNotificationCenter defaultCenter] addObserver:owner selector:@selector(cancel) name:UIApplicationWillResignActiveNotification object:nil];
    return owner;
}
- (UIGestureRecognizer *)contentPop {
    // The full-content pop gesture was added in iOS 26. Keep older SDKs compatible.
    if ([self.navigation respondsToSelector:NSSelectorFromString(@"interactiveContentPopGestureRecognizer")])
        return [self.navigation valueForKey:@"interactiveContentPopGestureRecognizer"];
    return nil;
}
- (void)sync {
    if (self.disposed || self.navigation.topViewController != self.presented) return;
    if (!self.suppressed) {
        self.suppressed = YES;
    }
    self.navigation.interactivePopGestureRecognizer.enabled = NO;
    self.contentPop.enabled = NO;
}
- (void)prepareOperation:(NSInteger)operation presented:(UIViewController *)presented reduced:(BOOL)reduced timeScale:(double)timeScale {
    self.operation = operation; self.reduced = reduced;
    self.timeScale = timeScale;
    if (operation == UINavigationControllerOperationPush) self.presented = presented;
}
- (BOOL)gestureRecognizerShouldBegin:(UIGestureRecognizer *)recognizer {
    CGPoint velocity = [self.pan velocityInView:self.navigation.view];
    return !self.disposed && !self.context && self.navigation.topViewController == self.presented &&
        self.navigation.viewControllers.count > 1 && !self.navigation.transitionCoordinator &&
        velocity.x * self.direction > fabs(velocity.y) && self.shouldBegin && self.shouldBegin();
}
- (void)pan:(UIScreenEdgePanGestureRecognizer *)pan {
    if (pan.state == UIGestureRecognizerStateBegan) {
        self.pendingEnd = nil;self.rawProgress=0;self.gestureOffset=0;
        self.interactive = YES;
        if (self.onEvent) self.onEvent(2); // JS enters Core's interactive state and invokes its pop callback once.
        // UIKit may deliver startInteractiveTransition on the next main-loop turn.
        // Keep the interactive request alive until that context arrives.
    }
    if (!self.interactive || self.settling) return;
    double width = MAX(1, self.context ? self.bounds.size.width : self.navigation.view.bounds.size.width);
    double progress = MAX(0, MIN(1, [pan translationInView:self.navigation.view].x * self.direction / width));
    double velocity = [pan velocityInView:self.navigation.view].x * self.direction / width;
    self.rawProgress=progress;
    double mapped=self.sharedPending?0:MAX(0,MIN(1,(progress-self.gestureOffset)/MAX(.01,1-self.gestureOffset)));
    _spring = (JoltSpringState){mapped, velocity/MAX(.01,1-self.gestureOffset)};
    if (self.context) {
        [self render:_spring.position];
        [self.context updateInteractiveTransition:_spring.position];
    }
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
    UIViewController *from = [context viewControllerForKey:UITransitionContextFromViewControllerKey];
    UIViewController *to = [context viewControllerForKey:UITransitionContextToViewControllerKey];
    self.fromView = [context viewForKey:UITransitionContextFromViewKey] ?: from.view;
    self.toView = [context viewForKey:UITransitionContextToViewKey] ?: to.view;
    self.fromTransform = self.fromView.transform; self.toTransform = self.toView.transform;
    self.fromAlpha = self.fromView.alpha; self.toAlpha = self.toView.alpha;
    self.toView.frame = [context finalFrameForViewController:to];
    UIView *container = context.containerView;
    if (self.operation == UINavigationControllerOperationPush) [container addSubview:self.toView];
    else [container insertSubview:self.toView belowSubview:self.fromView];
    [self.toView setNeedsLayout];
    // A recycled page may still be rebuilding its JS-backed data source. Let
    // the deferred provider cross Core's layout boundary before forcing UIKit.
    if(!self.sharedDeferred)[self.toView layoutIfNeeded];
    self.bounds = container.bounds;
    self.sharedPending=self.sharedDeferred;self.pendingStarted=CACurrentMediaTime();
    // One setup callback after UIKit lays out both pages; subsequent progress stays native.
    if(self.sharedEnabled && self.onEvent)self.onEvent(8);
    self.shade = [[UIView alloc] initWithFrame:self.bounds];
    self.shade.backgroundColor = UIColor.blackColor;
    self.shade.userInteractionEnabled = NO; self.shade.isAccessibilityElement = NO;
    [container insertSubview:self.shade belowSubview:self.operation == UINavigationControllerOperationPush ? self.toView : self.fromView];
    _spring = (JoltSpringState){0, 0};
    [self render:0];
}
- (void)startInteractiveTransition:(id<UIViewControllerContextTransitioning>)context {
    JoltSpringState held = _spring;
    [self prepare:context];
    _spring = self.sharedPending?(JoltSpringState){0,held.velocity}:held; [self render:_spring.position];
    [context updateInteractiveTransition:MAX(0, MIN(1, _spring.position))];
    [self startLink]; // Monitors resize/suspension while the finger is held; no JS display callbacks.
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
    double p = MAX(0, MIN(1, progress)), width = self.bounds.size.width * self.direction;
    BOOL push = self.operation == UINavigationControllerOperationPush;
    [CATransaction begin]; [CATransaction setDisableActions:YES];
    if(self.sharedPending) {
        self.fromView.transform=self.fromTransform;self.toView.transform=self.toTransform;self.fromView.alpha=self.fromAlpha;self.toView.alpha=self.toAlpha;self.shade.alpha=0;
    } else if(self.sharedFlight) {
        self.fromView.alpha = self.fromAlpha * (push ? 1 : 1-p); self.toView.alpha = self.toAlpha * (push ? p : 1);
        self.shade.alpha = 0;
        [self.sharedFlight updateInteractive:p];
    } else if(self.sharedDeferred && !push) {
        // A missing/deleted recycled target fades to the live collection. Do
        // not translate its table while Core is realizing replacement cells.
        self.fromView.alpha=self.fromAlpha*(1-p);self.toView.alpha=self.toAlpha;
        self.shade.alpha=0;
    } else {
        self.fromView.transform = CGAffineTransformConcat(self.fromTransform, CGAffineTransformMakeTranslation(width * (push ? -.25 * p : p), 0));
        self.toView.transform = CGAffineTransformConcat(self.toTransform, CGAffineTransformMakeTranslation(width * (push ? 1 - p : -.25 * (1 - p)), 0));
        self.shade.alpha = .16 * (push ? p : 1 - p);
    }
    [CATransaction commit];
}
- (BOOL)prepareSharedFrom:(UIView *)from to:(UIView *)to image:(BOOL)image fromRadius:(double)fromRadius toRadius:(double)toRadius maxPixels:(double)maxPixels {
    if(!self.context || self.reduced || self.sharedFlight || !from || !to)return NO;
    JoltSharedLayoutFlight *flight=image?[JoltSharedLayoutFlight captureNavigationImage:from radius:fromRadius maxPixels:maxPixels]:[JoltSharedLayoutFlight capture:from image:NO radius:fromRadius maxPixels:maxPixels];
    NSString *geometry=image?[flight prepareNavigationImage:to radius:toRadius maxPixels:maxPixels]:[flight prepare:to image:NO radius:toRadius maxPixels:maxPixels];
    if(!geometry || ![flight beginInteractive:geometry]) { [flight dispose]; return NO; }
    self.sharedFlight=flight; return YES;
}
- (void)completeSharedPreparation {
    if(!self.context || !self.sharedPending)return;
    self.sharedPending=NO;self.gestureOffset=self.rawProgress;
    _spring.position=0;self.started=CACurrentMediaTime();self.previous=self.started;
    [self render:0];
    if(self.settling && self.reduced)[self finish];
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
        if (finish) [self.context finishInteractiveTransition]; else [self.context cancelInteractiveTransition];
        if (self.onEvent) self.onEvent(finish ? 3 : 4);
    }
    if (!self.context) return; // An observer may synchronously cancel/dispose at the release boundary.
    self.started = CACurrentMediaTime(); self.previous = self.started;
    if (self.sharedPending && !finish){self.sharedPending=NO;[self finish];return;}
    if ((self.reduced && !self.sharedPending) || self.disposed) { [self finish]; return; }
    [self startLink];
}
- (void)tick:(CADisplayLink *)link {
    if (!CGRectEqualToRect(self.bounds, self.context.containerView.bounds) || !self.context.containerView.window) { [self cancel]; return; }
    if(self.sharedFlight && ![self.sharedFlight destinationIsStable]) { [self cancel]; return; }
    if(self.sharedPending){if(CACurrentMediaTime()-self.pendingStarted>5.1)[self completeSharedPreparation];else return;}
    if (!self.settling) return;
    double now = CACurrentMediaTime(), seconds = MAX(0, now - self.previous); self.previous = now;
    _spring = JoltSpringAdvance(_spring, self.target, self.stiffness * self.timeScale * self.timeScale, self.damping * self.timeScale, self.mass, seconds);
    if (!isfinite(_spring.position) || !isfinite(_spring.velocity)) { [self finish]; return; }
    [self render:_spring.position];
    // Bound even a deliberately slow/undamped spring; never leave UIKit's route queue stuck.
    if ((fabs(_spring.position - self.target) < .0005 && fabs(_spring.velocity) < .005) || now - self.started >= 3) [self finish];
}
- (void)finish {
    if (!self.context) return;
    [self.link invalidate]; self.link = nil;
    BOOL completed = self.committed, interactive = self.interactive;
    self.sharedPending=NO;
    _spring = (JoltSpringState){completed ? 1 : 0, 0}; [self render:_spring.position];
    self.fromView.transform = self.fromTransform; self.toView.transform = self.toTransform;
    self.fromView.alpha = self.fromAlpha; self.toView.alpha = self.toAlpha;
    [self.sharedFlight dispose]; self.sharedFlight = nil;
    [self.shade removeFromSuperview]; self.shade = nil;
    id<UIViewControllerContextTransitioning> context = self.context;
    self.context = nil; self.fromView = nil; self.toView = nil;
    self.settling = NO; self.interactive = NO; active--;
    // Complete exactly once. Core/Router observes UIKit's actual committed controller.
    [context completeTransition:completed];
    [self sync];
    if (self.onEvent) self.onEvent(interactive ? (completed ? 5 : 6) : 1);
}
- (void)cancel {
    if (!self.context) { if (self.interactive) self.pendingEnd = @NO; return; }
    if (!self.settling) [self settle:!self.interactive velocity:0];
    [self finish]; // Preserve an already-decided completion; otherwise roll an active drag back.
}
- (void)disposeRestoringSwipe:(BOOL)enabled {
    if (self.disposed) return;
    self.disposed = YES;
    [self cancel];
    [[NSNotificationCenter defaultCenter] removeObserver:self];
    [self.navigation.view removeGestureRecognizer:self.pan]; self.pan.delegate = nil; self.pan = nil;
    recognizers--;
    if (self.suppressed && self.navigation.topViewController == self.presented) {
        self.navigation.interactivePopGestureRecognizer.enabled = enabled;
        self.contentPop.enabled = enabled;
    }
    self.onEvent = nil; self.shouldBegin = nil;
}
@end
