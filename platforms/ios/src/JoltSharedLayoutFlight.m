#import "JoltSharedLayoutFlight.h"
#import <QuartzCore/QuartzCore.h>

@interface JoltSharedLayoutFlight () {
    double _pose[6], _velocity[5];
}
@property(nonatomic,weak) UIWindow *host;
@property(nonatomic,weak) UIView *destination;
@property(nonatomic) NSMapTable<UIView *, NSNumber *> *hiddenViews;
@property(nonatomic) UIImage *sourceImage, *targetImage;
@property(nonatomic) CGSize sourceSize, targetSize, viewport;
@property(nonatomic) CGRect targetFrame;
@property(nonatomic) BOOL sourceScales, targetScales, disposed;
@property(nonatomic) NSArray<NSDictionary *> *tracks;
@property(nonatomic) CADisplayLink *clock;
@property(nonatomic) double started, duration;
@property(nonatomic,copy) void (^onEnd)(BOOL);
@end
static NSInteger JoltSharedActive = 0;
static BOOL JoltSharedUnsupported(UIView *view) {
    NSString *name=NSStringFromClass(view.class), *layer=NSStringFromClass(view.layer.class);
    for(NSString *type in @[@"WKWebView",@"SCNView",@"SKView",@"MTKView",@"GLKView",@"UIVisualEffectView"]) if([view isKindOfClass:NSClassFromString(type)])return YES;
    if([view isKindOfClass:UIScrollView.class] || [layer containsString:@"Metal"] || [layer containsString:@"EAGL"] || [layer containsString:@"Player"] || [name containsString:@"Video"])return YES;
    for(UIView *child in view.subviews)if(JoltSharedUnsupported(child))return YES;
    return NO;
}
@implementation JoltSharedLayoutFlight
+ (NSInteger)activeCount { return JoltSharedActive; }
- (CGRect)geometry:(UIView *)view presentation:(BOOL)presentation {
    if(!view || view.window!=self.host || view.bounds.size.width<=0 || view.bounds.size.height<=0)return CGRectNull;
    for(UIView *parent=view.superview;parent;parent=parent.superview)if(parent.hidden)return CGRectNull;
    CALayer *layer=presentation?(view.layer.presentationLayer ?: view.layer):view.layer;
    CALayer *root=layer==view.layer?self.host.layer:(self.host.layer.presentationLayer ?: self.host.layer);
    for(CALayer *p=layer;p;p=p.superlayer) {
        if(fabs(p.opacity-1)>.001 || !CATransform3DIsAffine(p.transform) || !CATransform3DIsAffine(p.sublayerTransform))return CGRectNull;
        CGAffineTransform t=CATransform3DGetAffineTransform(p.transform),s=CATransform3DGetAffineTransform(p.sublayerTransform);
        if(fabs(t.b)>.0001 || fabs(t.c)>.0001 || t.a<=0 || t.d<=0 || fabs(t.a-t.d)>.0001 || fabs(s.b)>.0001 || fabs(s.c)>.0001 || s.a<=0 || s.d<=0 || fabs(s.a-s.d)>.0001)return CGRectNull;
    }
    CGRect rect=[layer convertRect:layer.bounds toLayer:root];
    return isfinite(rect.origin.x) && isfinite(rect.origin.y) && isfinite(rect.size.width) && isfinite(rect.size.height)?rect:CGRectNull;
}
- (BOOL)visibleBounds:(UIView *)view frame:(CGRect)frame {
    if(CGRectIsNull(frame) || !CGRectContainsRect(CGRectInset(self.host.bounds,-.5,-.5),frame))return NO;
    for(UIView *p=view.superview;p;p=p.superview)if(p.clipsToBounds) {
        CGRect clip=[self geometry:p presentation:NO];
        if(CGRectIsNull(clip) || !CGRectContainsRect(CGRectInset(clip,-.5,-.5),frame))return NO;
    }
    return YES;
}
- (UIImage *)snapshot:(UIView *)view budget:(double)budget presentation:(BOOL)presentation {
    CGFloat scale=self.host.screen.scale;
    if(ceil(view.bounds.size.width*scale)*ceil(view.bounds.size.height*scale)>budget || JoltSharedUnsupported(view))return nil;
    BOOL hidden=view.hidden; view.hidden=NO;
    UIGraphicsImageRendererFormat *format=[UIGraphicsImageRendererFormat defaultFormat]; format.scale=scale; format.opaque=NO;
    UIGraphicsImageRenderer *renderer=[[UIGraphicsImageRenderer alloc]initWithSize:view.bounds.size format:format];
    [view layoutIfNeeded]; [view.layer displayIfNeeded];
    CALayer *layer=presentation?(view.layer.presentationLayer ?: view.layer):view.layer;
    UIImage *image=[renderer imageWithActions:^(UIGraphicsImageRendererContext *context) { [layer renderInContext:context.CGContext]; }];
    view.hidden=hidden; return image;
}
- (void)hide:(UIView *)view {
    if(![self.hiddenViews objectForKey:view])[self.hiddenViews setObject:@(view.hidden) forKey:view]; view.hidden=YES;
}
+ (instancetype)capture:(UIView *)view image:(BOOL)image radius:(double)radius maxPixels:(double)maxPixels {
    if(!view.window || view.hidden)return nil;
    JoltSharedLayoutFlight *flight=[[self alloc]initWithFrame:view.window.bounds];
    flight.host=view.window; flight.viewport=view.window.bounds.size; flight.hiddenViews=[NSMapTable weakToStrongObjectsMapTable];
    CGRect rect=[flight geometry:view presentation:YES]; if(![flight visibleBounds:view frame:rect])return nil;
    flight.sourceImage=[flight snapshot:view budget:maxPixels presentation:YES]; if(!flight.sourceImage)return nil;
    flight.sourceSize=rect.size; flight.sourceScales=image;
    flight->_pose[0]=rect.origin.x; flight->_pose[1]=rect.origin.y; flight->_pose[2]=rect.size.width; flight->_pose[3]=rect.size.height; flight->_pose[4]=radius*rect.size.width/view.bounds.size.width;
    flight.opaque=NO; flight.backgroundColor=UIColor.clearColor; flight.userInteractionEnabled=NO; flight.accessibilityElementsHidden=YES;
    [flight hide:view]; [flight.host addSubview:flight]; JoltSharedActive++; return flight;
}
- (double)pixels {
    return (self.sourceImage?CGImageGetWidth(self.sourceImage.CGImage)*CGImageGetHeight(self.sourceImage.CGImage):0)+(self.targetImage?CGImageGetWidth(self.targetImage.CGImage)*CGImageGetHeight(self.targetImage.CGImage):0);
}
- (NSString *)state {
    NSMutableArray *pose=[NSMutableArray new],*velocity=[NSMutableArray new];
    for(int i=0;i<6;i++)[pose addObject:@(_pose[i])]; for(int i=0;i<5;i++)[velocity addObject:@(_velocity[i])];
    return [[NSString alloc]initWithData:[NSJSONSerialization dataWithJSONObject:@{@"pose":pose,@"velocity":velocity} options:0 error:nil] encoding:NSUTF8StringEncoding];
}
- (NSString *)prepare:(UIView *)view image:(BOOL)image radius:(double)radius maxPixels:(double)maxPixels {
    if(self.disposed || (view.hidden && ![self.hiddenViews objectForKey:view]))return nil;
    CGRect rect=[self geometry:view presentation:NO]; if(![self visibleBounds:view frame:rect])return nil;
    UIImage *snapshot=[self snapshot:view budget:maxPixels-self.pixels presentation:NO]; if(!snapshot)return nil;
    self.targetImage=snapshot; self.targetSize=rect.size; self.targetScales=image; self.destination=view; self.targetFrame=rect; [self hide:view];
    return [[NSString alloc]initWithData:[NSJSONSerialization dataWithJSONObject:@[@(rect.origin.x),@(rect.origin.y),@(rect.size.width),@(rect.size.height),@(radius*rect.size.width/view.bounds.size.width)] options:0 error:nil] encoding:NSUTF8StringEncoding];
}
- (BOOL)freeze:(double)maxPixels {
    if(self.disposed)return NO;
    if(self.clock)[self evaluate:CACurrentMediaTime()*1000];
    [self.clock invalidate]; self.clock=nil; self.onEnd=nil;
    CGSize size=CGSizeMake(MAX(.1,_pose[2]),MAX(.1,_pose[3])); CGFloat scale=self.host.screen.scale;
    if(ceil(size.width*scale)*ceil(size.height*scale)+self.pixels>maxPixels)return NO;
    UIGraphicsImageRendererFormat *format=[UIGraphicsImageRendererFormat defaultFormat]; format.scale=scale; format.opaque=NO;
    UIGraphicsImageRenderer *renderer=[[UIGraphicsImageRenderer alloc]initWithSize:size format:format];
    UIImage *image=[renderer imageWithActions:^(UIGraphicsImageRendererContext *context) { CGContextTranslateCTM(context.CGContext,-self->_pose[0],-self->_pose[1]); [self render]; }];
    self.sourceImage=image; self.targetImage=nil; self.sourceSize=size; self.sourceScales=NO; self.destination=nil; _pose[5]=0; [self setNeedsDisplay]; return YES;
}
- (void)play:(NSString *)configuration onEnd:(void (^)(BOOL))onEnd {
    if(self.disposed)return;
    NSDictionary *config=[NSJSONSerialization JSONObjectWithData:[configuration dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    self.tracks=config[@"tracks"]; self.duration=0;
    for(NSDictionary *track in self.tracks)self.duration=MAX(self.duration,[[track[@"times"] lastObject] doubleValue]);
    self.onEnd=onEnd; self.started=CACurrentMediaTime()*1000;
    self.clock=[CADisplayLink displayLinkWithTarget:self selector:@selector(tick:)]; [self.clock addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
}
- (void)evaluate:(double)now {
    double elapsed=MAX(0,now-self.started);
    for(int k=0;k<6;k++) {
        NSArray *times=self.tracks[k][@"times"],*values=self.tracks[k][@"values"]; NSUInteger j=1;
        while(j<times.count-1 && [times[j] doubleValue]<elapsed)j++;
        double span=[times[j] doubleValue]-[times[j-1] doubleValue]; double fraction=span<=0?1:MAX(0,MIN(1,(elapsed-[times[j-1] doubleValue])/span));
        _pose[k]=[values[j-1] doubleValue]+([values[j] doubleValue]-[values[j-1] doubleValue])*fraction;
        if(k<5)_velocity[k]=elapsed>=[times.lastObject doubleValue]||span<=0?0:([values[j] doubleValue]-[values[j-1] doubleValue])*1000/span;
    }
}
- (void)tick:(CADisplayLink *)clock {
    CGRect frame=[self geometry:self.destination presentation:NO]; CGRect target=self.targetFrame;
    if(!CGSizeEqualToSize(self.host.bounds.size,self.viewport) || CGRectIsNull(frame) || fabs(frame.origin.x-target.origin.x)>1 || fabs(frame.origin.y-target.origin.y)>1 || fabs(frame.size.width-target.size.width)>1 || fabs(frame.size.height-target.size.height)>1) { [self end:NO]; return; }
    double now=CACurrentMediaTime()*1000; [self evaluate:now]; [self setNeedsDisplay]; if(now-self.started>=self.duration)[self end:YES];
}
- (void)end:(BOOL)completed { void (^callback)(BOOL)=self.onEnd; self.onEnd=nil; [self.clock invalidate]; self.clock=nil; if(callback)callback(completed); }
- (void)drawImage:(UIImage *)image size:(CGSize)size scales:(BOOL)scales alpha:(CGFloat)alpha box:(CGRect)box blend:(CGBlendMode)blend {
    if(!image || alpha<=0)return;
    CGFloat scale=scales?MAX(box.size.width/size.width,box.size.height/size.height):1;
    CGSize drawn=CGSizeMake(size.width*scale,size.height*scale);
    [image drawInRect:CGRectMake(CGRectGetMidX(box)-drawn.width/2,CGRectGetMidY(box)-drawn.height/2,drawn.width,drawn.height) blendMode:blend alpha:alpha];
}
- (void)render {
    CGRect box=CGRectMake(_pose[0],_pose[1],MAX(.1,_pose[2]),MAX(.1,_pose[3]));
    CGFloat radius=MAX(0,MIN(_pose[4],MIN(box.size.width,box.size.height)/2)); CGContextRef context=UIGraphicsGetCurrentContext(); CGContextSaveGState(context);
    [[UIBezierPath bezierPathWithRoundedRect:box cornerRadius:radius]addClip]; CGFloat mix=MAX(0,MIN(1,_pose[5]));
    CGContextBeginTransparencyLayer(context,NULL);
    [self drawImage:self.sourceImage size:self.sourceSize scales:self.sourceScales alpha:1-mix box:box blend:kCGBlendModeNormal]; [self drawImage:self.targetImage size:self.targetSize scales:self.targetScales alpha:mix box:box blend:kCGBlendModePlusLighter];
    CGContextEndTransparencyLayer(context); CGContextRestoreGState(context);
}
- (void)drawRect:(CGRect)rect { [self render]; }
- (void)dispose {
    if(self.disposed)return; self.disposed=YES; [self.clock invalidate]; self.clock=nil; self.onEnd=nil;
    for(UIView *view in self.hiddenViews)if(view.hidden)view.hidden=[[self.hiddenViews objectForKey:view]boolValue]; [self.hiddenViews removeAllObjects];
    [self removeFromSuperview]; self.sourceImage=nil; self.targetImage=nil; self.destination=nil; JoltSharedActive--;
}
@end
