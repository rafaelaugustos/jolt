#import "JoltRealizedReorder.h"
#import <QuartzCore/QuartzCore.h>

@interface JoltRealizedRow : NSObject
@property(nonatomic,weak) UIView *view;
@property(nonatomic) UIView *preview;
@property(nonatomic) CGRect frame;
@property(nonatomic) CGFloat alpha, offset;
@end
@implementation JoltRealizedRow
@end

@interface JoltRealizedReorder () <UIGestureRecognizerDelegate>
@property(nonatomic,weak) UIScrollView *scroll;
@property(nonatomic,weak) UIView *container;
@property(nonatomic) NSArray<UIView *> *rows, *handles;
@property(nonatomic) NSMutableArray<JoltRealizedRow *> *copies;
@property(nonatomic) UILongPressGestureRecognizer *press;
@property(nonatomic) CADisplayLink *clock;
@property(nonatomic) UIView *overlay;
@property(nonatomic,copy) void (^onState)(NSInteger,NSInteger,NSInteger);
@property(nonatomic) BOOL enabled, disposed, active, reduced, scrollEnabled, settling;
@property(nonatomic) NSInteger from, target, generation;
@property(nonatomic) CGFloat edgeSize, edgeSpeed, grabOffset, pointerY, stride;
@property(nonatomic) CGSize viewport;
@property(nonatomic) double previousTime;
@end
static NSInteger JoltRealizedReorderActive=0;
@implementation JoltRealizedReorder
+ (NSInteger)activeCount{return JoltRealizedReorderActive;}
+ (instancetype)attach:(UIScrollView *)scroll container:(UIView *)container options:(NSString *)options onState:(void (^)(NSInteger,NSInteger,NSInteger))onState {
    if(![scroll isKindOfClass:UIScrollView.class] || [scroll isKindOfClass:UITableView.class] || ![container isDescendantOfView:scroll])
        [NSException raise:NSInvalidArgumentException format:@"Realized reorder requires retained content inside UIScrollView"];
    NSDictionary *config=[NSJSONSerialization JSONObjectWithData:[options dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    JoltRealizedReorder *s=[self new];s.scroll=scroll;s.container=container;s.onState=onState;s.enabled=YES;
    s.edgeSize=[config[@"edgeSize"] doubleValue];s.edgeSpeed=[config[@"edgeSpeed"] doubleValue];s.reduced=[config[@"reducedMotion"] boolValue];
    s.press=[[UILongPressGestureRecognizer alloc]initWithTarget:s action:@selector(pressed:)];s.press.minimumPressDuration=[config[@"longPress"] doubleValue]/1000.;
    s.press.numberOfTouchesRequired=1;s.press.allowableMovement=10;s.press.delegate=s;
    [scroll addGestureRecognizer:s.press];return s;
}
- (void)setRows:(NSArray<UIView *> *)rows handles:(NSArray<UIView *> *)handles {
    if(self.disposed)return;[self cancel];self.rows=[rows copy];self.handles=[handles copy];
}
- (NSInteger)indexAt:(CGPoint)point {
    for(NSUInteger i=0;i<self.rows.count;i++){UIView *row=self.rows[i];if(row.window && !row.hidden && row.alpha>.01 && CGRectContainsPoint([row convertRect:row.bounds toView:self.scroll],point))return i;}
    return NSNotFound;
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)recognizer shouldReceiveTouch:(UITouch *)touch {
    if(self.active){[self cancel];return NO;}
    if(!self.enabled || self.disposed || !self.scroll.window)return NO;
    for(UIView *handle in self.handles)if(touch.view==handle || [touch.view isDescendantOfView:handle])return YES;
    return NO;
}
- (BOOL)gestureRecognizerShouldBegin:(UIGestureRecognizer *)recognizer {
    return self.rows.count>0 && [self indexAt:[recognizer locationInView:self.scroll]]!=NSNotFound && !self.scroll.dragging && !self.scroll.decelerating;
}
- (void)pressed:(UILongPressGestureRecognizer *)press {
    if(press.state==UIGestureRecognizerStateBegan)[self begin];
    else if(press.state==UIGestureRecognizerStateChanged && self.active && !self.settling){self.pointerY=[press locationInView:self.scroll.window].y;[self update];}
    else if(press.state==UIGestureRecognizerStateEnded && self.active)[self drop];
    else if(press.state==UIGestureRecognizerStateCancelled || press.state==UIGestureRecognizerStateFailed)[self cancel];
}
- (void)begin {
    NSInteger index=[self indexAt:[self.press locationInView:self.scroll]];
    if(index==NSNotFound || self.rows.count>100 || !self.scroll.window)return;
    NSMutableArray<JoltRealizedRow *> *copies=[NSMutableArray new];
    CGFloat pixels=0,scale=self.scroll.window.screen.scale;
    for(UIView *row in self.rows){
        CGRect frame=[row convertRect:row.bounds toView:self.container];
        pixels+=frame.size.width*frame.size.height*scale*scale;
        if(!row.window || frame.size.width<=0 || frame.size.height<=0 || pixels>16000000)return;
        UIView *copy=[row snapshotViewAfterScreenUpdates:NO];if(!copy)return;
        JoltRealizedRow *item=[JoltRealizedRow new];item.view=row;item.preview=copy;item.frame=frame;item.alpha=row.alpha;[copies addObject:item];
    }
    self.copies=copies;self.overlay=[[UIView alloc]initWithFrame:[self.scroll convertRect:self.scroll.bounds toView:self.scroll.superview]];self.overlay.userInteractionEnabled=NO;self.overlay.accessibilityElementsHidden=YES;self.overlay.clipsToBounds=YES;
    [self.scroll.superview insertSubview:self.overlay aboveSubview:self.scroll];
    for(JoltRealizedRow *item in copies){[self.overlay addSubview:item.preview];item.view.alpha=0;}
    self.from=self.target=index;self.pointerY=[self.press locationInView:self.scroll.window].y;
    CGRect frame=[self.rows[index] convertRect:self.rows[index].bounds toView:self.scroll.window];
    self.grabOffset=self.pointerY-CGRectGetMidY(frame);
    self.stride=index+1<copies.count?CGRectGetMinY(copies[index+1].frame)-CGRectGetMinY(copies[index].frame):copies[index].frame.size.height+(index>0?MAX(0,CGRectGetMinY(copies[index].frame)-CGRectGetMaxY(copies[index-1].frame)):0);
    self.viewport=self.scroll.bounds.size;self.scrollEnabled=self.scroll.scrollEnabled;self.scroll.scrollEnabled=NO;
    self.active=YES;self.settling=NO;self.generation++;JoltRealizedReorderActive++;
    [self.overlay bringSubviewToFront:copies[index].preview];
    if(self.onState)self.onState(1,index,index);
    if(!self.active || self.disposed)return;
    self.previousTime=CACurrentMediaTime();self.clock=[CADisplayLink displayLinkWithTarget:self selector:@selector(tick:)];
    [self.clock addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];[self update];
}
- (void)tick:(CADisplayLink *)clock {
    if(!self.active || self.settling)return;
    if(!self.scroll.window || !CGSizeEqualToSize(self.viewport,self.scroll.bounds.size)){[self finish:NO geometry:YES];return;}
    for(JoltRealizedRow *item in self.copies){
        CGRect frame=[item.view convertRect:item.view.bounds toView:self.container];
        if(!item.view.window || fabs(frame.origin.y-item.frame.origin.y)>.5 || fabs(frame.size.height-item.frame.size.height)>.5 || fabs(frame.size.width-item.frame.size.width)>.5){[self finish:NO geometry:YES];return;}
    }
    double now=CACurrentMediaTime(),dt=MIN(.04,MAX(0,now-self.previousTime));self.previousTime=now;
    CGRect viewport=[self.scroll convertRect:self.scroll.bounds toView:self.scroll.window];CGFloat edge=MIN(self.edgeSize,viewport.size.height/3),speed=0;
    if(self.pointerY<CGRectGetMinY(viewport)+edge)speed=-MIN(1,(CGRectGetMinY(viewport)+edge-self.pointerY)/edge);
    else if(self.pointerY>CGRectGetMaxY(viewport)-edge)speed=MIN(1,(self.pointerY-CGRectGetMaxY(viewport)+edge)/edge);
    CGFloat minimum=-self.scroll.adjustedContentInset.top,maximum=MAX(minimum,self.scroll.contentSize.height-self.scroll.bounds.size.height+self.scroll.adjustedContentInset.bottom);
    CGFloat next=MAX(minimum,MIN(maximum,self.scroll.contentOffset.y+speed*self.edgeSpeed*dt));
    if(fabs(next-self.scroll.contentOffset.y)>.01)[self.scroll setContentOffset:CGPointMake(self.scroll.contentOffset.x,next) animated:NO];
    [self update];
}
- (void)update {
    if(!self.active || self.settling)return;
    CGFloat center=self.pointerY-self.grabOffset;
    CGPoint point=[self.container convertPoint:CGPointMake(0,center) fromView:self.scroll.window];
    CGFloat top=point.y-self.copies[self.from].frame.size.height/2;
    NSInteger destination=0;
    for(NSUInteger i=0;i<self.copies.count;i++){
        if(i==self.from)continue;
        CGFloat midpoint=CGRectGetMidY(self.copies[i].frame)-(i>self.from?self.stride:0);
        if(top<midpoint)break;destination++;
    }
    self.target=MIN((NSInteger)self.rows.count-1,MAX(0,destination));
    for(NSUInteger i=0;i<self.copies.count;i++){
        JoltRealizedRow *item=self.copies[i];CGRect frame=[item.view convertRect:item.view.bounds toView:self.overlay];
        item.preview.bounds=CGRectMake(0,0,frame.size.width,frame.size.height);
        item.preview.center=CGPointMake(CGRectGetMidX(frame),i==self.from?[self.overlay convertPoint:CGPointMake(0,center) fromView:self.scroll.window].y:CGRectGetMidY(frame));
        CGFloat offset=i==self.from?0:i>self.from && i<=self.target?-self.stride:i<self.from && i>=self.target?self.stride:0;
        if(fabs(offset-item.offset)>.01){item.offset=offset;
            [UIView animateWithDuration:self.reduced?0:.16 delay:0 options:UIViewAnimationOptionBeginFromCurrentState|UIViewAnimationOptionAllowUserInteraction animations:^{item.preview.transform=CGAffineTransformMakeTranslation(0,offset);} completion:nil];
        }
    }
}
- (void)drop {
    if(!self.active || self.settling)return;self.settling=YES;[self.clock invalidate];self.clock=nil;
    JoltRealizedRow *drag=self.copies[self.from];CGFloat offset=0;
    if(self.target>self.from)offset=CGRectGetMaxY(self.copies[self.target].frame)-CGRectGetMaxY(drag.frame);
    else if(self.target<self.from)offset=CGRectGetMinY(self.copies[self.target].frame)-CGRectGetMinY(drag.frame);
    CGRect frame=[drag.view convertRect:drag.view.bounds toView:self.overlay];NSInteger generation=self.generation;
    [UIView animateWithDuration:self.reduced?0:.16 delay:0 options:UIViewAnimationOptionBeginFromCurrentState animations:^{drag.preview.center=CGPointMake(CGRectGetMidX(frame),CGRectGetMidY(frame)+offset);} completion:^(BOOL done){if(self.active && self.generation==generation)[self finish:done geometry:NO];}];
}
- (void)finish:(BOOL)commit geometry:(BOOL)geometry {
    if(!self.active)return;self.active=NO;self.settling=NO;self.generation++;JoltRealizedReorderActive--;
    [self.clock invalidate];self.clock=nil;
    for(JoltRealizedRow *item in self.copies){[item.preview.layer removeAllAnimations];if(item.view.alpha==0)item.view.alpha=item.alpha;}
    [self.overlay removeFromSuperview];self.overlay=nil;self.copies=nil;
    if(!self.scroll.scrollEnabled)self.scroll.scrollEnabled=self.scrollEnabled;
    if(!self.disposed && self.onState)self.onState(commit?2:3,self.from,commit?self.target:(geometry?1:0));
}
- (void)cancel{[self finish:NO geometry:NO];}
- (void)setEnabled:(BOOL)value{_enabled=value;if(!value)[self cancel];self.press.enabled=value;}
- (void)setReducedMotion:(BOOL)value{self.reduced=value;}
- (void)dispose{if(self.disposed)return;[self cancel];self.disposed=YES;[self.scroll removeGestureRecognizer:self.press];self.press.delegate=nil;self.press=nil;self.rows=nil;self.handles=nil;self.onState=nil;}
@end
