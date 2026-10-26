#import "JoltCircleWorld.h"
#import "JoltCircleMath.h"
#import <QuartzCore/QuartzCore.h>

@interface JoltCircleWorld () <UIGestureRecognizerDelegate> {
    JoltCircleState state;
    BOOL originalInteraction[16];
    double touchOffsetX[16],touchOffsetY[16];
    double initialX[16],initialY[16],initialVX[16],initialVY[16],originalX[16],originalY[16];
}
@property(nonatomic) UIView *container;
@property(nonatomic) NSMutableArray *views,*pans;
@property(nonatomic) CADisplayLink *link;
@property(nonatomic) BOOL enabled,disposed,background,fits;
@property(nonatomic) double previous,accumulator,processingMs,droppedMs,offsetX,offsetY;
@property(nonatomic) NSUInteger frames,dragStarts,dragMoves,dragEnds,dragCancels;
@property(nonatomic) NSInteger dragging;
- (void)refresh;
- (void)apply;
- (void)cancelDrag;
@end

@implementation JoltCircleWorld
static NSMutableSet<JoltCircleWorld *> *worlds;
+ (void)initialize { if(self==JoltCircleWorld.class)worlds=[NSMutableSet new]; }
+ (NSUInteger)worldCount{return worlds.count;}
+ (NSUInteger)activeCount{NSUInteger count=0;for(JoltCircleWorld *w in worlds)if(w.link)count++;return count;}
+ (instancetype)create:(UIView *)container options:(NSString *)options {
    NSDictionary *config=[NSJSONSerialization JSONObjectWithData:[options dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    NSArray *bodies=config[@"bodies"];
    if(bodies.count<1||bodies.count>16)[NSException raise:NSInvalidArgumentException format:@"Physics needs 1–16 circles"];
    JoltCircleWorld *w=[self new];w.container=container;w.views=[NSMutableArray new];w.pans=[NSMutableArray new];w.dragging=-1;
    w->state.count=(int)bodies.count;w->state.width=[config[@"width"] doubleValue];w->state.height=[config[@"height"] doubleValue];
    w->state.gx=[config[@"gravity"][@"x"] doubleValue];w->state.gy=[config[@"gravity"][@"y"] doubleValue];
    w->state.restitution=[config[@"restitution"] doubleValue];w->state.damping=[config[@"damping"] doubleValue];
    for(int i=0;i<bodies.count;i++){
        NSDictionary *v=bodies[i];JoltCircle *b=&w->state.bodies[i];
        b->x=[v[@"x"] doubleValue];b->y=[v[@"y"] doubleValue];b->r=[v[@"radius"] doubleValue];b->m=[v[@"mass"] doubleValue];
        b->vx=[v[@"vx"] doubleValue];b->vy=[v[@"vy"] doubleValue];
        w->initialX[i]=b->x/w->state.width;w->initialY[i]=b->y/w->state.height;w->initialVX[i]=b->vx;w->initialVY[i]=b->vy;
        [w.views addObject:NSNull.null];[w.pans addObject:NSNull.null];
    }
    w.fits=JoltCircleFits(&w->state,w->state.width,w->state.height);
    w.background=UIApplication.sharedApplication.applicationState==UIApplicationStateBackground;
    [[NSNotificationCenter defaultCenter] addObserver:w selector:@selector(backgrounded) name:UIApplicationDidEnterBackgroundNotification object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:w selector:@selector(foregrounded) name:UIApplicationDidBecomeActiveNotification object:nil];
    [worlds addObject:w];return w;
}
- (void)connect:(UIView *)view index:(NSInteger)index {
    if(self.disposed||index<0||index>=state.count)return;
    if(view.superview!=self.container)[NSException raise:NSInvalidArgumentException format:@"Physics circles must be direct native children"];
    self.views[index]=view;originalInteraction[index]=view.userInteractionEnabled;view.userInteractionEnabled=YES;originalX[index]=[[view.layer valueForKeyPath:@"transform.translation.x"] doubleValue];originalY[index]=[[view.layer valueForKeyPath:@"transform.translation.y"] doubleValue];
    UIPanGestureRecognizer *pan=[[UIPanGestureRecognizer alloc] initWithTarget:self action:@selector(panned:)];
    pan.maximumNumberOfTouches=1;pan.delegate=self;pan.enabled=NO;pan.cancelsTouchesInView=YES;
    self.pans[index]=pan;[view addGestureRecognizer:pan];
    [self apply];
}
- (BOOL)ready {return self.enabled&&!self.disposed&&!self.background&&self.fits&&self.container.window!=nil;}
- (void)refresh {
    BOOL ready=[self ready];
    for(id candidate in self.pans)if(candidate!=NSNull.null){UIPanGestureRecognizer *pan=candidate;if(pan.enabled!=ready)pan.enabled=ready;}
    if(ready&&!state.sleeping){
        if(!self.link){self.previous=0;self.accumulator=0;self.link=[CADisplayLink displayLinkWithTarget:self selector:@selector(tick:)];[self.link addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];}
    }else if(self.link){[self.link invalidate];self.link=nil;self.previous=0;self.accumulator=0;}
}
- (void)tick:(CADisplayLink *)link {
    if(![self ready]){[self cancelDrag];[self refresh];return;}
    double started=CACurrentMediaTime(),elapsed=self.previous?MAX(0,link.timestamp-self.previous):0;self.previous=link.timestamp;
    self.droppedMs+=MAX(0,elapsed-1.0/15)*1000;self.accumulator+=MIN(elapsed,1.0/15);
    int budget=16;
    while(self.accumulator+1e-10>=JOLT_CIRCLE_DT&&budget-->0&&!state.sleeping){JoltCircleStep(&state);self.accumulator-=JOLT_CIRCLE_DT;}
    [self apply];self.frames++;self.processingMs+=(CACurrentMediaTime()-started)*1000;[self refresh];
}
- (void)apply {
    [CATransaction begin];[CATransaction setDisableActions:YES];
    for(int i=0;i<state.count;i++){
        if(self.views[i]==NSNull.null)continue;UIView *v=self.views[i];
        if(v.superview!=self.container){self.enabled=NO;continue;}
        // layer.position is the untransformed layout center; body coordinates use container DIPs.
        [v.layer setValue:@(state.bodies[i].x-v.layer.position.x) forKeyPath:@"transform.translation.x"];
        [v.layer setValue:@(state.bodies[i].y-v.layer.position.y) forKeyPath:@"transform.translation.y"];
    }
    [CATransaction commit];
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)gesture shouldReceiveTouch:(UITouch *)touch {
    if(![self ready]||self.dragging>=0)return NO;
    NSInteger i=[self.pans indexOfObject:gesture];if(i==NSNotFound)return NO;
    CGPoint p=[touch locationInView:self.container];JoltCircle *b=&state.bodies[i];
    touchOffsetX[i]=b->x-p.x;touchOffsetY[i]=b->y-p.y;
    return hypot(p.x-b->x,p.y-b->y)<=b->r;
}
- (BOOL)gestureRecognizerShouldBegin:(UIGestureRecognizer *)gesture {
    return [self ready]&&self.dragging<0;
}
- (void)panned:(UIPanGestureRecognizer *)pan {
    NSInteger i=[self.pans indexOfObject:pan];if(i==NSNotFound)return;
    CGPoint point=[pan locationInView:self.container];
    if(pan.state==UIGestureRecognizerStateBegan){
        if(![self ready]||self.dragging>=0)return;
        self.dragging=i;self.offsetX=touchOffsetX[i];self.offsetY=touchOffsetY[i];self.dragStarts++;
    }
    if(self.dragging!=i)return;
    if(pan.state==UIGestureRecognizerStateBegan||pan.state==UIGestureRecognizerStateChanged){
        JoltCircleDrag(&state,(int)i,point.x+self.offsetX,point.y+self.offsetY);self.dragMoves++;[self refresh];
    }else if(pan.state==UIGestureRecognizerStateEnded){
        CGPoint velocity=[pan velocityInView:self.container];JoltCircleRelease(&state,(int)i,velocity.x,velocity.y);
        self.dragging=-1;self.dragEnds++;[self refresh];
    }else if(pan.state==UIGestureRecognizerStateCancelled||pan.state==UIGestureRecognizerStateFailed)[self cancelDrag];
}
- (void)cancelDrag {
    if(self.dragging<0)return;
    JoltCircleRelease(&state,(int)self.dragging,0,0);self.dragging=-1;self.dragCancels++;
}
- (void)setEnabled:(BOOL)enabled {
    if(self.disposed)return;BOOL changed=_enabled!=enabled;_enabled=enabled;
    if(!enabled)[self cancelDrag];else if(changed)JoltCircleWake(&state);
    [self refresh];
}
- (void)backgrounded {self.background=YES;[self cancelDrag];[self refresh];}
- (void)foregrounded {self.background=NO;[self refresh];}
- (void)resize:(double)width height:(double)height {
    if(self.disposed)return;
    self.fits=JoltCircleFits(&state,width,height);
    if(!self.fits){[self cancelDrag];[self refresh];return;}
    if(fabs(width-state.width)>.1||fabs(height-state.height)>.1){[self cancelDrag];JoltCircleResize(&state,width,height);}
    [self apply];[self refresh];
}
- (void)impulse:(NSInteger)index x:(double)x y:(double)y {
    if(![self ready]||index<0||index>=state.count||state.bodies[index].held||!isfinite(x)||!isfinite(y))return;
    JoltCircle *b=&state.bodies[index];b->vx+=x/b->m;b->vy+=y/b->m;JoltCircleLimitVelocity(b);JoltCircleWake(&state);[self refresh];
}
- (void)reset {
    if(self.disposed)return;[self cancelDrag];
    for(int i=0;i<state.count;i++){JoltCircle *b=&state.bodies[i];b->x=initialX[i]*state.width;b->y=initialY[i]*state.height;b->vx=initialVX[i];b->vy=initialVY[i];}
    JoltCircleContacts(&state,false,64);JoltCircleWake(&state);[self apply];[self refresh];
}
- (NSString *)snapshot {
    NSMutableArray *bodies=[NSMutableArray new];
    for(int i=0;i<state.count;i++){JoltCircle b=state.bodies[i];[bodies addObject:@{@"x":@(b.x),@"y":@(b.y),@"vx":@(b.vx),@"vy":@(b.vy),@"radius":@(b.r),@"held":@(b.held)}];}
    NSString *status=self.disposed?@"disposed":!self.enabled?@"paused":self.background||!self.container.window?@"detached":!self.fits?@"invalid-bounds":state.sleeping?@"sleeping":@"running";
    NSDictionary *data=@{@"status":status,@"bodies":bodies,@"frames":@(self.frames),@"steps":@(state.steps),@"contacts":@(state.contacts),@"dragStarts":@(self.dragStarts),@"dragMoves":@(self.dragMoves),@"dragEnds":@(self.dragEnds),@"dragCancels":@(self.dragCancels),@"processingMs":@(self.processingMs),@"droppedMs":@(self.droppedMs),@"clock":[NSNumber numberWithBool:self.link!=nil]};
    return [[NSString alloc]initWithData:[NSJSONSerialization dataWithJSONObject:data options:0 error:nil] encoding:NSUTF8StringEncoding];
}
- (void)dispose {
    if(self.disposed)return;self.enabled=NO;self.disposed=YES;[self cancelDrag];[self refresh];
    [[NSNotificationCenter defaultCenter]removeObserver:self];
    [CATransaction begin];[CATransaction setDisableActions:YES];
    for(int i=0;i<state.count;i++)if(self.views[i]!=NSNull.null){
        UIView *v=self.views[i];v.userInteractionEnabled=originalInteraction[i];if(self.pans[i]!=NSNull.null)[v removeGestureRecognizer:self.pans[i]];
        [v.layer setValue:@(originalX[i]) forKeyPath:@"transform.translation.x"];[v.layer setValue:@(originalY[i]) forKeyPath:@"transform.translation.y"];
    }
    [CATransaction commit];[self.views removeAllObjects];[self.pans removeAllObjects];self.container=nil;[worlds removeObject:self];
}
@end
