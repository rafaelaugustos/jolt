#import "JoltReorderSession.h"

@implementation JoltReorderHandle
- (BOOL)canBecomeFirstResponder { return YES; }
- (BOOL)beginTrackingWithTouch:(UITouch *)touch withEvent:(UIEvent *)event {
    [self becomeFirstResponder]; return [super beginTrackingWithTouch:touch withEvent:event];
}
- (NSArray<UIKeyCommand *> *)keyCommands {
    if (!self.onMove) return [super keyCommands];
    UIKeyCommand *up = [UIKeyCommand keyCommandWithInput:UIKeyInputUpArrow modifierFlags:UIKeyModifierAlternate action:@selector(moveUp:)];
    UIKeyCommand *down = [UIKeyCommand keyCommandWithInput:UIKeyInputDownArrow modifierFlags:UIKeyModifierAlternate action:@selector(moveDown:)];
    if (@available(iOS 15.0, *)) { up.wantsPriorityOverSystemBehavior = YES; down.wantsPriorityOverSystemBehavior = YES; }
    return @[up, down];
}
- (void)moveUp:(UIKeyCommand *)command { if (self.onMove) self.onMove(-1); }
- (void)moveDown:(UIKeyCommand *)command { if (self.onMove) self.onMove(1); }
@end

@interface JoltReorderCellState : NSObject
@property(nonatomic) CGAffineTransform transform;
@property(nonatomic) CGFloat alpha, offset;
@property(nonatomic) NSInteger index;
@end
@implementation JoltReorderCellState
@end

@interface JoltReorderSession () <UIGestureRecognizerDelegate>
@property(nonatomic, weak) UITableView *list;
@property(nonatomic) UILongPressGestureRecognizer *press;
@property(nonatomic) NSHashTable<UIView *> *handles;
@property(nonatomic) NSMapTable<UITableViewCell *, JoltReorderCellState *> *cells;
@property(nonatomic) UIView *overlay;
@property(nonatomic) CADisplayLink *clock;
@property(nonatomic, copy) void (^onState)(NSInteger, NSInteger, NSInteger);
@property(nonatomic) NSInteger from, target, count, generation;
@property(nonatomic) CGFloat edgeSize, edgeSpeed, height, grabOffset, pointerY, pointerX;
@property(nonatomic) CGSize viewport;
@property(nonatomic) double previousTime;
@property(nonatomic) BOOL enabled, disposed, handlesOnly, reduced, settling, scrollEnabled, cancelling;
@property(nonatomic, readwrite) BOOL active;
@end

@implementation JoltReorderSession
+ (instancetype)attach:(UITableView *)list options:(NSString *)options onState:(void (^)(NSInteger, NSInteger, NSInteger))onState {
    if (![list isKindOfClass:UITableView.class]) @throw [NSException exceptionWithName:NSInvalidArgumentException reason:@"Reorder requires a UITableView" userInfo:nil];
    NSDictionary *config = [NSJSONSerialization JSONObjectWithData:[options dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    JoltReorderSession *s = [self new]; s.list = list; s.onState = onState; s.enabled = YES;
    s.edgeSize = [config[@"edgeSize"] doubleValue]; s.edgeSpeed = [config[@"edgeSpeed"] doubleValue];
    s.reduced = [config[@"reducedMotion"] boolValue]; s.handlesOnly = [config[@"handles"] boolValue];
    s.handles = [NSHashTable weakObjectsHashTable]; s.cells = [NSMapTable weakToStrongObjectsMapTable];
    s.press = [[UILongPressGestureRecognizer alloc] initWithTarget:s action:@selector(pressed:)];
    s.press.minimumPressDuration = [config[@"longPress"] doubleValue] / 1000.; s.press.numberOfTouchesRequired = 1;
    s.press.allowableMovement = 10; s.press.delegate = s;
    [list addGestureRecognizer:s.press];
    return s;
}
- (void)registerHandle:(UIView *)view { if (!self.disposed && view) [self.handles addObject:view]; }
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceiveTouch:(UITouch *)touch {
    if (self.active) { [self cancel]; return NO; }
    if (!self.enabled || self.disposed || self.active || !self.list.window) return NO;
    if (!self.handlesOnly) return YES;
    for (UIView *view = touch.view; view && view != self.list; view = view.superview)
        if ([self.handles containsObject:view]) return YES;
    return NO;
}
- (BOOL)gestureRecognizerShouldBegin:(UIGestureRecognizer *)recognizer {
    NSIndexPath *path = [self.list indexPathForRowAtPoint:[recognizer locationInView:self.list]];
    return path && path.section == 0 && self.list.numberOfSections == 1 && !self.list.dragging && !self.list.decelerating;
}
- (void)emit:(NSInteger)state detail:(NSInteger)detail { if (!self.disposed && self.onState) self.onState(state, self.from, detail); }
- (void)pressed:(UILongPressGestureRecognizer *)press {
    if (press.state == UIGestureRecognizerStateBegan) [self begin];
    else if (press.state == UIGestureRecognizerStateChanged && self.active && !self.settling) {
        CGPoint p = [press locationInView:self.list.window]; self.pointerY = p.y; self.pointerX = p.x; [self update];
    } else if (press.state == UIGestureRecognizerStateEnded && self.active) [self drop];
    else if (press.state == UIGestureRecognizerStateCancelled || press.state == UIGestureRecognizerStateFailed) [self cancel];
}
- (void)begin {
    UITableView *list = self.list;
    NSIndexPath *path = [list indexPathForRowAtPoint:[self.press locationInView:list]];
    UITableViewCell *cell = path ? [list cellForRowAtIndexPath:path] : nil;
    if (!cell || path.section != 0 || !list.window) return;
    UIView *snapshot = [cell snapshotViewAfterScreenUpdates:NO];
    if (!snapshot) return;
    CGRect frame = [list convertRect:[list rectForRowAtIndexPath:path] toView:list.window];
    self.overlay = snapshot; snapshot.frame = frame; snapshot.userInteractionEnabled = NO;
    snapshot.accessibilityElementsHidden = YES;
    snapshot.layer.shadowColor = UIColor.blackColor.CGColor; snapshot.layer.shadowRadius = 12;
    snapshot.layer.shadowOpacity = .18; snapshot.layer.shadowOffset = CGSizeMake(0, 6);
    [list.window addSubview:snapshot];
    CGPoint p = [self.press locationInView:list.window];
    self.pointerY = p.y; self.pointerX = p.x; self.grabOffset = p.y - CGRectGetMidY(frame);
    self.height = frame.size.height; self.viewport = list.bounds.size;
    self.count = [list numberOfRowsInSection:0]; self.from = self.target = path.row;
    self.scrollEnabled = list.scrollEnabled; list.scrollEnabled = NO;
    self.active = YES; self.settling = NO; self.previousTime = CACurrentMediaTime(); self.generation++;
    [self emit:1 detail:self.from];
    if (!self.active || self.disposed) return;
    self.clock = [CADisplayLink displayLinkWithTarget:self selector:@selector(tick:)];
    [self.clock addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
    [self update];
}
- (void)tick:(CADisplayLink *)clock {
    if (!self.active || self.settling) return;
    UITableView *list = self.list;
    if (!list.window || !CGSizeEqualToSize(self.viewport, list.bounds.size) || self.count != [list numberOfRowsInSection:0]) {
        [self finish:NO detail:1]; return;
    }
    double now = CACurrentMediaTime(), dt = MIN(.04, MAX(0, now - self.previousTime)); self.previousTime = now;
    CGRect viewport = [list convertRect:list.bounds toView:list.window];
    CGFloat inset = MIN(self.edgeSize, viewport.size.height / 3), distance = 0;
    if (self.pointerY < CGRectGetMinY(viewport) + inset) distance = -MIN(1, (CGRectGetMinY(viewport) + inset - self.pointerY) / inset);
    else if (self.pointerY > CGRectGetMaxY(viewport) - inset) distance = MIN(1, (self.pointerY - CGRectGetMaxY(viewport) + inset) / inset);
    CGFloat top = -list.adjustedContentInset.top, bottom = MAX(top, list.contentSize.height - list.bounds.size.height + list.adjustedContentInset.bottom);
    CGFloat next = MAX(top, MIN(bottom, list.contentOffset.y + distance * self.edgeSpeed * dt));
    if (fabs(next - list.contentOffset.y) > .01) { [list setContentOffset:CGPointMake(list.contentOffset.x, next) animated:NO]; [list layoutIfNeeded]; }
    [self update];
}
- (void)restore:(UITableViewCell *)cell state:(JoltReorderCellState *)state {
    [cell.layer removeAnimationForKey:@"jolt.reorder"];
    cell.transform = state.transform; cell.alpha = state.alpha; state.offset = 0;
}
- (void)update {
    if (!self.active || self.settling) return;
    UITableView *list = self.list;
    CGFloat center = self.pointerY - self.grabOffset;
    CGPoint inList = [list convertPoint:CGPointMake(self.pointerX, center) fromView:list.window];
    CGFloat draggedTop = inList.y - self.height / 2;
    self.overlay.center = CGPointMake(self.overlay.center.x, center);
    NSArray<NSIndexPath *> *paths = [[list indexPathsForVisibleRows] sortedArrayUsingSelector:@selector(compare:)];
    NSInteger destination = self.from;
    for (NSIndexPath *path in paths) {
        if (path.section || path.row == self.from) continue;
        CGRect frame = [list rectForRowAtIndexPath:path];
        CGFloat midpoint = CGRectGetMidY(frame) - (path.row > self.from ? self.height : 0);
        NSInteger insertion = path.row - (path.row > self.from ? 1 : 0);
        destination = insertion;
        if (draggedTop < midpoint) break;
        destination = insertion + 1;
    }
    self.target = MAX(0, MIN(self.count - 1, destination));
    NSSet *visible = [NSSet setWithArray:list.visibleCells];
    for (UITableViewCell *cell in self.cells.keyEnumerator.allObjects)
        if (![visible containsObject:cell]) { [self restore:cell state:[self.cells objectForKey:cell]]; [self.cells removeObjectForKey:cell]; }
    for (NSIndexPath *path in paths) {
        UITableViewCell *cell = [list cellForRowAtIndexPath:path]; if (!cell) continue;
        JoltReorderCellState *state = [self.cells objectForKey:cell];
        if (state && state.index != path.row) { [self restore:cell state:state]; [self.cells removeObjectForKey:cell]; state = nil; }
        if (!state) { state = [JoltReorderCellState new]; state.transform = cell.transform; state.alpha = cell.alpha; state.index = path.row; [self.cells setObject:state forKey:cell]; }
        cell.alpha = path.row == self.from ? 0 : state.alpha;
        CGFloat offset = path.row > self.from && path.row <= self.target ? -self.height : path.row < self.from && path.row >= self.target ? self.height : 0;
        if (fabs(offset - state.offset) < .01) continue;
        CGFloat previous = ((CALayer *)cell.layer.presentationLayer ?: cell.layer).affineTransform.ty;
        state.offset = offset; cell.transform = CGAffineTransformTranslate(state.transform, 0, offset);
        [cell.layer removeAnimationForKey:@"jolt.reorder"];
        if (!self.reduced) {
            CASpringAnimation *spring = [CASpringAnimation animationWithKeyPath:@"transform.translation.y"];
            spring.mass = 1; spring.stiffness = 360; spring.damping = 34;
            spring.fromValue = @(previous); spring.toValue = @(cell.transform.ty); spring.duration = spring.settlingDuration;
            [cell.layer addAnimation:spring forKey:@"jolt.reorder"];
        }
    }
}
- (void)drop {
    if (!self.active || self.settling) return;
    self.settling = YES; [self.clock invalidate]; self.clock = nil;
    NSInteger generation = self.generation;
    CGRect row = [self.list rectForRowAtIndexPath:[NSIndexPath indexPathForRow:self.target inSection:0]];
    CGFloat top = self.target > self.from ? CGRectGetMaxY(row) - self.height : row.origin.y;
    CGPoint end = [self.list convertPoint:CGPointMake(row.origin.x + row.size.width / 2, top + self.height / 2) toView:self.list.window];
    if (self.reduced) { [self finish:YES detail:0]; return; }
    [UIView animateWithDuration:.18 delay:0 options:UIViewAnimationOptionBeginFromCurrentState | UIViewAnimationOptionCurveEaseOut animations:^{ self.overlay.center = end; } completion:^(BOOL finished) {
        if (self.active && generation == self.generation) [self finish:YES detail:0];
    }];
}
- (void)finish:(BOOL)commit detail:(NSInteger)detail {
    if (!self.active) return;
    self.active = NO; self.settling = NO; self.generation++;
    [self.clock invalidate]; self.clock = nil;
    [self.overlay.layer removeAllAnimations]; [self.overlay removeFromSuperview]; self.overlay = nil;
    for (UITableViewCell *cell in self.cells.keyEnumerator.allObjects) [self restore:cell state:[self.cells objectForKey:cell]];
    [self.cells removeAllObjects]; self.list.scrollEnabled = self.scrollEnabled;
    [self emit:commit ? 2 : 3 detail:commit ? self.target : detail];
}
- (void)cancel {
    if (self.cancelling) return;
    self.cancelling = YES;
    [self finish:NO detail:0];
    if (self.press.enabled) { self.press.enabled = NO; self.press.enabled = YES; }
    self.cancelling = NO;
}
- (void)setEnabled:(BOOL)value { _enabled = value; if (!value) [self cancel]; }
- (void)setReducedMotion:(BOOL)value { self.reduced = value; }
- (void)dispose {
    if (self.disposed) return;
    [self cancel]; self.disposed = YES; [self.list removeGestureRecognizer:self.press]; self.onState = nil;
    [self.handles removeAllObjects];
}
@end
