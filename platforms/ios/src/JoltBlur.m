#import "JoltBlur.h"
#import <QuartzCore/QuartzCore.h>

@interface JoltBlur ()
@property(nonatomic,weak) UIView *host;
@property(nonatomic) UIVisualEffectView *surface;
@property(nonatomic) UIViewPropertyAnimator *material;
@property(nonatomic) CADisplayLink *clock;
@property(nonatomic) NSArray<NSNumber *> *times, *values;
@property(nonatomic) double amount, duration, delay, repeats, anchor, offset;
@property(nonatomic) BOOL reverse, disposed, paused;
@property(nonatomic) NSUInteger frames;
@end
static NSInteger JoltBlurLive=0, JoltBlurActive=0;
@implementation JoltBlur
+ (NSInteger)liveCount { return JoltBlurLive; }
+ (NSInteger)activeCount { return JoltBlurActive; }
+ (instancetype)attach:(UIView *)view options:(NSString *)options {
    NSDictionary *o=[NSJSONSerialization JSONObjectWithData:[options dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    JoltBlur *b=[self new];b.host=view;
    UIBlurEffectStyle style=[o[@"style"] isEqual:@"light"]?UIBlurEffectStyleLight:[o[@"style"] isEqual:@"dark"]?UIBlurEffectStyleDark:UIBlurEffectStyleSystemMaterial;
    b.surface=[[UIVisualEffectView alloc]initWithEffect:nil];
    b.surface.userInteractionEnabled=NO;b.surface.accessibilityElementsHidden=YES;
    b.surface.accessibilityIdentifier=@"jolt:blur";
    b.surface.autoresizingMask=UIViewAutoresizingFlexibleWidth|UIViewAutoresizingFlexibleHeight;
    b.surface.clipsToBounds=YES;[view addSubview:b.surface];[b resize];
    UIVisualEffectView *surface=b.surface;
    b.material=[[UIViewPropertyAnimator alloc]initWithDuration:1 curve:UIViewAnimationCurveLinear animations:^{surface.effect=[UIBlurEffect effectWithStyle:style];}];
    b.material.scrubsLinearly=YES;b.material.pausesOnCompletion=YES;
    [b.material startAnimation];[b.material pauseAnimation];
    [b paint:[o[@"amount"] doubleValue]];JoltBlurLive++;return b;
}
- (void)resize {
    self.surface.frame=self.host.bounds;
    self.surface.layer.cornerRadius=self.host.layer.cornerRadius;
}
- (void)apply:(double)value {
    self.amount=MIN(1,MAX(0,value));self.material.fractionComplete=self.amount;
    // Keep alpha at 1: changing effect-view alpha compromises its backdrop capture.
    self.surface.hidden=self.amount==0;self.frames++;
}
- (void)cancel {
    if(self.clock){[self.clock invalidate];self.clock=nil;JoltBlurActive--;}
    self.times=nil;self.values=nil;
}
- (void)paint:(double)value {
    if(self.disposed)return;[self cancel];[self apply:value];
}
- (void)play:(NSString *)program {
    if(self.disposed)return;[self cancel];
    NSDictionary *p=[NSJSONSerialization JSONObjectWithData:[program dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    self.times=p[@"times"];self.values=p[@"values"];self.duration=[p[@"duration"] doubleValue];self.delay=[p[@"delay"] doubleValue];self.repeats=[p[@"repeat"] doubleValue];self.reverse=[p[@"reverse"] boolValue];
    self.offset=0;self.anchor=CACurrentMediaTime();self.paused=NO;[self advance:0];
    self.clock=[CADisplayLink displayLinkWithTarget:self selector:@selector(tick:)];
    [self.clock addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];JoltBlurActive++;
}
- (void)advance:(double)elapsed {
    if(!self.times.count)return;
    double t=MAX(0,elapsed-self.delay), fraction;
    if(self.duration<=0)fraction=elapsed<self.delay?0:(self.reverse && self.repeats>=0 && ((NSInteger)self.repeats%2==1)?0:1);
    else if(self.repeats>=0 && t>=self.duration*(self.repeats+1))fraction=self.reverse && ((NSInteger)self.repeats%2==1)?0:1;
    else { double cycles=t/self.duration;long long cycle=(long long)floor(cycles);fraction=cycles-cycle;if(self.reverse && cycle%2==1)fraction=1-fraction; }
    NSUInteger low=0,high=self.times.count-1;
    while(high-low>1){NSUInteger mid=(low+high)/2;if(self.times[mid].doubleValue<=fraction)low=mid;else high=mid;}
    double span=self.times[high].doubleValue-self.times[low].doubleValue;
    double mix=span>0?MIN(1,MAX(0,(fraction-self.times[low].doubleValue)/span)):1;
    [self apply:self.values[low].doubleValue+(self.values[high].doubleValue-self.values[low].doubleValue)*mix];
}
- (void)tick:(CADisplayLink *)link {
    double elapsed=self.offset+(CACurrentMediaTime()-self.anchor)*1000;
    [self advance:elapsed];
    if(self.repeats>=0 && elapsed>=self.delay+self.duration*(self.repeats+1))[self cancel];
}
- (void)control:(double)time paused:(BOOL)paused {
    if(!self.clock)return;
    self.offset=time;self.anchor=CACurrentMediaTime();self.paused=paused;self.clock.paused=paused;[self advance:time];
}
- (NSString *)snapshot {
    NSDictionary *s=@{@"backend":@"ios-material",@"amount":@(self.amount),@"appliedAmount":@(self.material?self.material.fractionComplete:0),@"attached":@(!self.disposed),@"nativeAnimations":@(self.clock?1:0),@"frames":@(self.frames),@"width":@(self.surface.bounds.size.width),@"height":@(self.surface.bounds.size.height)};
    return [[NSString alloc]initWithData:[NSJSONSerialization dataWithJSONObject:s options:0 error:nil] encoding:NSUTF8StringEncoding];
}
- (void)dispose {
    if(self.disposed)return;[self cancel];self.disposed=YES;JoltBlurLive--;
    [self.material stopAnimation:YES];self.material=nil;[self.surface removeFromSuperview];self.surface=nil;
}
@end
