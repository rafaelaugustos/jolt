#import "JoltPhotoZoom.h"
#import <QuartzCore/QuartzCore.h>

static double JoltClamp(double v,double lo,double hi){return MAX(lo,MIN(hi,v));}
static double JoltRubber(double v,double lo,double hi,double size){
    double edge=JoltClamp(v,lo,hi),d=v-edge;
    return edge+copysign(size*(1-1/(fabs(d)*.55/MAX(size,1)+1)),d);
}

@interface JoltPhotoZoom () <UIGestureRecognizerDelegate>
@property(nonatomic,weak) UIImageView *image;
@property(nonatomic,weak) UIView *viewport,*backdrop,*chrome;
@property(nonatomic,strong) UIPinchGestureRecognizer *pinch;
@property(nonatomic,strong) UIPanGestureRecognizer *pan;
@property(nonatomic,strong) UITapGestureRecognizer *tap;
@property(nonatomic,strong) CADisplayLink *clock;
@property(nonatomic,copy) void (^onDismiss)(double,double,double,double,double);
@property(nonatomic,copy) void (^onSettled)(double,double,double);
@property(nonatomic) CGAffineTransform original;
@property(nonatomic) BOOL originalInteraction,originalClip,reduced,active,disposed,dismiss,closing;
@property(nonatomic) double minimum,maximum,doubleTap,backdropAlpha,chromeAlpha;
@property(nonatomic,readwrite) double x,y,scale,dismissProgress;
@property(nonatomic,readwrite) BOOL dismissPending;
@property(nonatomic) CGPoint anchor,lastFocus,lastPan,initialTranslation;
@property(nonatomic) CGPoint rawPan;
@property(nonatomic) double pinchFloor;
@property(nonatomic) CGRect content;
@property(nonatomic) CGSize viewportSize,imageSize;
@property(nonatomic) NSInteger mode,touches;
@property(nonatomic) double vx,vy,startTime,startX,startY,startScale,startProgress,targetX,targetY,targetScale;
@end

@implementation JoltPhotoZoom
+ (instancetype)attachImage:(UIImageView *)image viewport:(UIView *)viewport
                    minimum:(double)minimum maximum:(double)maximum doubleTap:(double)doubleTap
                    dismiss:(BOOL)dismiss reduced:(BOOL)reduced backdrop:(UIView *)backdrop chrome:(UIView *)chrome
                  onDismiss:(void (^)(double,double,double,double,double))onDismiss
                  onSettled:(void (^)(double,double,double))onSettled {
    JoltPhotoZoom *z=[JoltPhotoZoom new];
    z.image=image;z.viewport=viewport;z.backdrop=backdrop;z.chrome=chrome;
    z.minimum=minimum;z.maximum=maximum;z.doubleTap=doubleTap;z.dismiss=dismiss;z->_reduced=reduced;z.active=YES;
    z.onDismiss=onDismiss;z.onSettled=onSettled;
    z.original=image.transform;z.originalInteraction=viewport.userInteractionEnabled;z.originalClip=viewport.clipsToBounds;
    z.backdropAlpha=backdrop?backdrop.alpha:1;z.chromeAlpha=chrome?chrome.alpha:1;z.scale=minimum;
    z.pan=[[UIPanGestureRecognizer alloc] initWithTarget:z action:@selector(panned:)];
    z.pinch=[[UIPinchGestureRecognizer alloc] initWithTarget:z action:@selector(pinched:)];
    z.tap=[[UITapGestureRecognizer alloc] initWithTarget:z action:@selector(tapped:)];
    z.tap.numberOfTapsRequired=2;z.pan.delegate=z;z.pinch.delegate=z;z.tap.delegate=z;
    [viewport addGestureRecognizer:z.pan];[viewport addGestureRecognizer:z.pinch];[viewport addGestureRecognizer:z.tap];
    viewport.userInteractionEnabled=YES;viewport.clipsToBounds=YES;
    [z measure];[z apply];
    return z;
}
- (void)measure {
    self.viewportSize=self.viewport.bounds.size;self.imageSize=self.image.bounds.size;
    CGSize intrinsic=self.image.image.size;
    double iw=self.imageSize.width,ih=self.imageSize.height,dw=intrinsic.width,dh=intrinsic.height;
    if(dw<=0 || dh<=0){dw=iw;dh=ih;}
    UIViewContentMode fit=self.image.contentMode;
    double factor=fit==UIViewContentModeScaleAspectFill?MAX(iw/dw,ih/dh):MIN(iw/dw,ih/dh);
    if(fit==UIViewContentModeScaleToFill){dw=iw;dh=ih;}
    else if(fit!=UIViewContentModeCenter && fit!=UIViewContentModeTopLeft){dw*=factor;dh*=factor;}
    CGPoint pivot=CGPointMake(self.image.layer.anchorPoint.x*iw,self.image.layer.anchorPoint.y*ih);
    self.anchor=CGPointMake(self.image.layer.position.x+self.original.tx,self.image.layer.position.y+self.original.ty);
    double ox=fit==UIViewContentModeTopLeft?0:(iw-dw)/2,oy=fit==UIViewContentModeTopLeft?0:(ih-dh)/2;
    double left=MAX(0,ox),top=MAX(0,oy),right=MIN(iw,ox+dw),bottom=MIN(ih,oy+dh);
    self.content=CGRectMake((left-pivot.x)*self.original.a,(top-pivot.y)*self.original.d,(right-left)*self.original.a,(bottom-top)*self.original.d);
}
- (CGRect)boundsFor:(double)scale {
    double loX=self.viewportSize.width-self.anchor.x-CGRectGetMaxX(self.content)*scale;
    double hiX=-self.anchor.x-CGRectGetMinX(self.content)*scale;
    double loY=self.viewportSize.height-self.anchor.y-CGRectGetMaxY(self.content)*scale;
    double hiY=-self.anchor.y-CGRectGetMinY(self.content)*scale;
    if(loX>hiX)loX=hiX=(loX+hiX)/2;
    if(loY>hiY)loY=hiY=(loY+hiY)/2;
    return CGRectMake(loX,loY,hiX-loX,hiY-loY);
}
- (void)apply {
    self.image.transform=CGAffineTransformMake(self.original.a*self.scale,0,0,self.original.d*self.scale,self.original.tx+self.x,self.original.ty+self.y);
    self.backdrop.alpha=self.backdropAlpha*(1-self.dismissProgress);
    self.chrome.alpha=self.chromeAlpha*(1-self.dismissProgress);
}
- (void)zoom:(double)value focusX:(double)fx focusY:(double)fy animated:(BOOL)animated {
    if(self.disposed || self.dismissPending)return;
    [self cancelAnimation];double next=JoltClamp(value,self.minimum,self.maximum);
    double x=fx-self.anchor.x-(fx-self.anchor.x-self.x)*next/self.scale;
    double y=fy-self.anchor.y-(fy-self.anchor.y-self.y)*next/self.scale;
    CGRect b=[self boundsFor:next];
    [self springX:JoltClamp(x,CGRectGetMinX(b),CGRectGetMaxX(b)) y:JoltClamp(y,CGRectGetMinY(b),CGRectGetMaxY(b)) scale:next vx:0 vy:0 animated:animated close:NO];
}
- (void)reset:(BOOL)animated {
    if(self.disposed)return;
    self.dismissPending=NO;self.mode=0;CGRect b=[self boundsFor:self.minimum];
    [self springX:JoltClamp(0,CGRectGetMinX(b),CGRectGetMaxX(b)) y:JoltClamp(0,CGRectGetMinY(b),CGRectGetMaxY(b)) scale:self.minimum vx:0 vy:0 animated:animated close:NO];
}
- (void)requestDismiss {
    if(self.disposed || self.dismissPending || !self.dismiss)return;
    CGRect b=[self boundsFor:self.minimum];
    [self springX:JoltClamp(0,CGRectGetMinX(b),CGRectGetMaxX(b)) y:JoltClamp(0,CGRectGetMinY(b),CGRectGetMaxY(b)) scale:self.minimum vx:0 vy:0 animated:YES close:YES];
}
- (void)setReduced:(BOOL)reduced { _reduced=reduced;if(reduced){if(self.dismissPending)[self reset:NO];else [self settle:NO];} }
- (void)setActive:(BOOL)active {
    _active=active;self.pan.enabled=active;self.pinch.enabled=active;self.tap.enabled=active;
    if(!active){[self cancelAnimation];self.dismissPending=NO;[self reset:NO];}
}
- (void)layout {
    if(self.disposed)return;
    if(CGSizeEqualToSize(self.viewportSize,self.viewport.bounds.size) && CGSizeEqualToSize(self.imageSize,self.image.bounds.size))return;
    [self cancelAnimation];self.dismissPending=NO;[self measure];self.vx=0;self.vy=0;self.mode=0;[self settle:NO];
}
- (void)stop {
    if(self.disposed)return;
    self.disposed=YES;[self cancelAnimation];
    [self.viewport removeGestureRecognizer:self.pan];[self.viewport removeGestureRecognizer:self.pinch];[self.viewport removeGestureRecognizer:self.tap];
    self.viewport.userInteractionEnabled=self.originalInteraction;self.viewport.clipsToBounds=self.originalClip;
    self.image.transform=self.original;self.backdrop.alpha=self.backdropAlpha;self.chrome.alpha=self.chromeAlpha;
    self.onDismiss=nil;self.onSettled=nil;
}
- (void)cancelAnimation { [self.clock invalidate];self.clock=nil;self.closing=NO; }
- (void)springX:(double)x y:(double)y scale:(double)scale vx:(double)vx vy:(double)vy animated:(BOOL)animated close:(BOOL)close {
    [self cancelAnimation];
    if(!animated || self.reduced){
        self.x=x;self.y=y;self.scale=scale;self.dismissProgress=0;[self apply];
        if(close)[self emitDismiss:0];else if(self.onSettled)self.onSettled(x,y,scale);
        return;
    }
    self.startX=self.x;self.startY=self.y;self.startScale=self.scale;self.startProgress=self.dismissProgress;
    self.targetX=x;self.targetY=y;self.targetScale=scale;self.vx=vx;self.vy=vy;self.closing=close;
    self.startTime=CACurrentMediaTime();self.clock=[CADisplayLink displayLinkWithTarget:self selector:@selector(tick:)];
    self.clock.preferredFramesPerSecond=MIN(120,self.viewport.window.screen.maximumFramesPerSecond);
    [self.clock addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
}
- (void)tick:(CADisplayLink *)clock {
    double t=MIN(.55,MAX(0,CACurrentMediaTime()-self.startTime)),decay=exp(-16*t);
    self.x=self.targetX+((self.startX-self.targetX)+(self.vx+16*(self.startX-self.targetX))*t)*decay;
    self.y=self.targetY+((self.startY-self.targetY)+(self.vy+16*(self.startY-self.targetY))*t)*decay;
    self.scale=self.targetScale+(self.startScale-self.targetScale)*(1+16*t)*decay;
    self.dismissProgress=self.startProgress*(1+16*t)*decay;
    if(t>=.55){self.x=self.targetX;self.y=self.targetY;self.scale=self.targetScale;self.dismissProgress=0;}
    [self apply];
    if(t>=.55){BOOL close=self.closing;[self cancelAnimation];if(close)[self emitDismiss:0];else if(self.onSettled)self.onSettled(self.x,self.y,self.scale);}
}
- (void)settle:(BOOL)animated {
    if(self.disposed)return;
    double s=JoltClamp(self.scale,self.minimum,self.maximum);CGRect b=[self boundsFor:s];
    double x=JoltClamp(self.x+self.vx*.12,CGRectGetMinX(b),CGRectGetMaxX(b));
    double y=JoltClamp(self.y+self.vy*.12,CGRectGetMinY(b),CGRectGetMaxY(b));
    if(self.mode==2){s=self.minimum;b=[self boundsFor:s];x=JoltClamp(0,CGRectGetMinX(b),CGRectGetMaxX(b));y=JoltClamp(0,CGRectGetMinY(b),CGRectGetMaxY(b));}
    [self springX:x y:y scale:s vx:self.vx vy:self.vy animated:animated close:NO];
}
- (void)emitDismiss:(double)velocity {
    if(self.disposed || self.dismissPending)return;
    self.dismissPending=YES;
    if(self.onDismiss)self.onDismiss(self.x,self.y,self.scale,velocity,self.dismissProgress);
}
- (void)pinched:(UIPinchGestureRecognizer *)gesture {
    if(self.disposed || self.dismissPending)return;
    CGPoint focus=[gesture locationInView:self.viewport];
    if(gesture.state==UIGestureRecognizerStateBegan){
        [self cancelAnimation];self.mode=1;self.pinchFloor=MIN(self.minimum,self.scale);self.lastFocus=focus;gesture.scale=1;
    } else if(gesture.state==UIGestureRecognizerStateChanged){
        double next=JoltClamp(self.scale*gesture.scale,self.pinchFloor,self.maximum);
        self.x=focus.x-self.anchor.x-(self.lastFocus.x-self.anchor.x-self.x)*next/self.scale;
        self.y=focus.y-self.anchor.y-(self.lastFocus.y-self.anchor.y-self.y)*next/self.scale;
        self.scale=next;self.lastFocus=focus;gesture.scale=1;
        self.dismissProgress=JoltClamp((self.minimum-self.scale)/(self.minimum*.15),0,1);
        [self rebasePan];[self apply];
    } else if(gesture.state==UIGestureRecognizerStateEnded || gesture.state==UIGestureRecognizerStateCancelled){
        self.lastPan=[self.pan translationInView:self.viewport];self.touches=self.pan.numberOfTouches;
        self.vx=0;self.vy=0;
        if(self.pan.state!=UIGestureRecognizerStateChanged && self.pan.state!=UIGestureRecognizerStateBegan)[self settle:YES];
    }
}
- (void)panned:(UIPanGestureRecognizer *)gesture {
    if(self.disposed || self.dismissPending)return;
    CGPoint translation=[gesture translationInView:self.viewport];
    if(gesture.state==UIGestureRecognizerStateBegan){
        [self cancelAnimation];self.vx=0;self.vy=0;self.lastPan=CGPointZero;self.touches=gesture.numberOfTouches;
        [self rebasePan];
        self.mode=self.scale<=self.minimum+.001 && self.pinch.state!=UIGestureRecognizerStateBegan && self.pinch.state!=UIGestureRecognizerStateChanged?2:1;
    }
    if(gesture.state==UIGestureRecognizerStateBegan || gesture.state==UIGestureRecognizerStateChanged){
        if(self.pinch.state==UIGestureRecognizerStateBegan || self.pinch.state==UIGestureRecognizerStateChanged || self.touches!=gesture.numberOfTouches){
            self.lastPan=translation;self.touches=gesture.numberOfTouches;[self rebasePan];return;
        }
        double dx=translation.x-self.lastPan.x,dy=translation.y-self.lastPan.y;
        self.lastPan=translation;
        if(self.mode==2){
            self.x+=dx*.4;self.y+=dy;self.dismissProgress=JoltClamp(fabs(self.y)/MAX(self.viewportSize.height*.5,1),0,1);
            self.scale=self.minimum*(1-self.dismissProgress*.15);
        }else{
            CGRect b=[self boundsFor:self.scale];
            self.rawPan=CGPointMake(self.rawPan.x+dx,self.rawPan.y+dy);
            self.x=JoltRubber(self.rawPan.x,CGRectGetMinX(b),CGRectGetMaxX(b),self.viewportSize.width);
            self.y=JoltRubber(self.rawPan.y,CGRectGetMinY(b),CGRectGetMaxY(b),self.viewportSize.height);
        }
        [self apply];
    }else if(gesture.state==UIGestureRecognizerStateEnded || gesture.state==UIGestureRecognizerStateCancelled || gesture.state==UIGestureRecognizerStateFailed){
        CGPoint velocity=[gesture velocityInView:self.viewport];self.vx=velocity.x;self.vy=velocity.y;
        BOOL commit=gesture.state==UIGestureRecognizerStateEnded && self.mode==2 &&
            (self.dismissProgress>.35 || (fabs(velocity.y)>1000 && velocity.y*self.y>0));
        if(commit)[self emitDismiss:velocity.y];
        else if(self.pinch.state!=UIGestureRecognizerStateChanged && self.pinch.state!=UIGestureRecognizerStateBegan)[self settle:YES];
    }
}
- (void)tapped:(UITapGestureRecognizer *)gesture {
    if(gesture.state!=UIGestureRecognizerStateEnded || self.dismissPending)return;
    CGPoint point=[gesture locationInView:self.viewport];
    [self zoom:self.scale>self.minimum+.01?self.minimum:MIN(self.maximum,self.doubleTap) focusX:point.x focusY:point.y animated:YES];
}
- (void)rebasePan {
    CGRect b=[self boundsFor:self.scale];
    double ex=JoltClamp(self.x,CGRectGetMinX(b),CGRectGetMaxX(b)),ey=JoltClamp(self.y,CGRectGetMinY(b),CGRectGetMaxY(b));
    double dx=self.x-ex,dy=self.y-ey;
    self.rawPan=CGPointMake(ex+dx/(.55*MAX(.001,1-fabs(dx)/MAX(1,self.viewportSize.width))),
                           ey+dy/(.55*MAX(.001,1-fabs(dy)/MAX(1,self.viewportSize.height))));
}
- (BOOL)gestureRecognizerShouldBegin:(UIGestureRecognizer *)gesture {
    if(self.disposed || !self.active || self.dismissPending)return NO;
    if(gesture==self.pan && self.scale<=self.minimum+.001){
        CGPoint velocity=[self.pan velocityInView:self.viewport];
        return self.dismiss && fabs(velocity.y)>fabs(velocity.x)*1.2;
    }
    return YES;
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)one shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)other {
    return (one==self.pan && other==self.pinch)||(one==self.pinch && other==self.pan);
}
@end
