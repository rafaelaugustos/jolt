#import "JoltSharedLayoutFlight.h"
#import <QuartzCore/QuartzCore.h>

@interface JoltSharedLayoutFlight () {
    double _pose[14], _velocity[14], _interactiveStart[14], _interactiveEnd[14];
}
@property(nonatomic) BOOL navigationImage, clippedImage, fading;
@property(nonatomic) UIImage *pageImage;
@property(nonatomic) CGRect pageFrame;
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
static BOOL JoltSharedUnsupportedContent(UIView *view, BOOL allowScrolling) {
    NSString *name=NSStringFromClass(view.class), *layer=NSStringFromClass(view.layer.class);
    for(NSString *type in @[@"WKWebView",@"SCNView",@"SKView",@"MTKView",@"GLKView",@"UIVisualEffectView"]) if([view isKindOfClass:NSClassFromString(type)])return YES;
    if((!allowScrolling && [view isKindOfClass:UIScrollView.class]) || [layer containsString:@"Metal"] || [layer containsString:@"EAGL"] || [layer containsString:@"Player"] || [name containsString:@"Video"])return YES;
    for(UIView *child in view.subviews)if(JoltSharedUnsupportedContent(child, allowScrolling))return YES;
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
// Preserve both the full image pose and the viewport clipping at a drag handoff.
- (CGRect)visibleClip:(UIView *)view frame:(CGRect)frame {
    if(CGRectIsNull(frame))return CGRectNull;
    CGRect clip=CGRectIntersection(frame,self.host.bounds);
    for(UIView *p=view.superview;p;p=p.superview)if(p.clipsToBounds) {
        CGRect parent=[self geometry:p presentation:NO];if(CGRectIsNull(parent))return CGRectNull;
        clip=CGRectIntersection(clip,parent);
    }
    return CGRectIsEmpty(clip)?CGRectNull:clip;
}
- (UIImage *)snapshot:(UIView *)view budget:(double)budget presentation:(BOOL)presentation {
    CGFloat scale=self.host.screen.scale;
    if(ceil(view.bounds.size.width*scale)*ceil(view.bounds.size.height*scale)>budget || JoltSharedUnsupportedContent(view, NO))return nil;
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

// Use the decoded image, not a cropped view snapshot: preserve content when
// aspectFill thumbnails open into aspectFit details (and vice versa).
- (NSArray *)navigationGeometry:(UIImageView *)view radius:(double)radius presentation:(BOOL)presentation {
    if(![view isKindOfClass:UIImageView.class] || !view.image || view.image.images.count || view.image.renderingMode==UIImageRenderingModeAlwaysTemplate ||
       (view.contentMode!=UIViewContentModeScaleAspectFit && view.contentMode!=UIViewContentModeScaleAspectFill))return nil;
    CGRect rect=[self geometry:view presentation:presentation];
    CGRect clip=self.clippedImage?[self visibleClip:view frame:rect]:rect;
    if(self.clippedImage?CGRectIsNull(clip):![self visibleBounds:view frame:rect])return nil;
    CGSize image=view.image.size;
    if(image.width<=0 || image.height<=0)return nil;
    double scale=view.contentMode==UIViewContentModeScaleAspectFill?MAX(rect.size.width/image.width,rect.size.height/image.height):MIN(rect.size.width/image.width,rect.size.height/image.height);
    double w=image.width*scale,h=image.height*scale;
    NSMutableArray *pose=[@[@(rect.origin.x),@(rect.origin.y),@(rect.size.width),@(rect.size.height),@(radius*rect.size.width/view.bounds.size.width),@((rect.size.width-w)/2),@((rect.size.height-h)/2),@(w),@(h)] mutableCopy];
    if(self.clippedImage)[pose addObjectsFromArray:@[@(clip.origin.x),@(clip.origin.y),@(clip.size.width),@(clip.size.height)]];
    return pose;
}
+ (instancetype)captureNavigationImage:(UIView *)view radius:(double)radius maxPixels:(double)maxPixels {
    return [self captureNavigationImage:view radius:radius maxPixels:maxPixels clipped:NO];
}
+ (instancetype)captureClippedNavigationImage:(UIView *)view radius:(double)radius maxPixels:(double)maxPixels {
    return [self captureNavigationImage:view radius:radius maxPixels:maxPixels clipped:YES];
}
+ (instancetype)captureNavigationImage:(UIView *)view radius:(double)radius maxPixels:(double)maxPixels clipped:(BOOL)clipped {
    if(!view.window || view.hidden)return nil;
    JoltSharedLayoutFlight *flight=[[self alloc]initWithFrame:view.window.bounds];
    flight.host=view.window; flight.viewport=view.window.bounds.size; flight.hiddenViews=[NSMapTable weakToStrongObjectsMapTable];
    flight.clippedImage=clipped;
    NSArray *pose=[flight navigationGeometry:(UIImageView *)view radius:radius presentation:YES]; if(!pose)return nil;
    UIImage *image=((UIImageView *)view).image;
    if(!image.CGImage || (double)CGImageGetWidth(image.CGImage)*CGImageGetHeight(image.CGImage)>maxPixels)return nil;
    flight.navigationImage=YES; flight.sourceImage=image;
    for(int i=0;i<pose.count;i++)flight->_pose[i<5?i:i+1]=[pose[i] doubleValue];
    flight.opaque=NO; flight.backgroundColor=UIColor.clearColor; flight.userInteractionEnabled=NO; flight.accessibilityElementsHidden=YES;
    [flight hide:view]; [flight.host addSubview:flight]; JoltSharedActive++; return flight;
}
- (NSString *)prepareNavigationImage:(UIView *)view radius:(double)radius maxPixels:(double)maxPixels {
    if(self.disposed || !self.navigationImage || view.hidden)return nil;
    NSArray *pose=[self navigationGeometry:(UIImageView *)view radius:radius presentation:NO]; if(!pose)return nil;
    UIImage *image=((UIImageView *)view).image;
    if(!image.CGImage || (double)CGImageGetWidth(image.CGImage)*CGImageGetHeight(image.CGImage)+self.pixels>maxPixels)return nil;
    // Both endpoints must describe the same aspect ratio; unsupported swaps fall back.
    if(fabs(image.size.width/image.size.height-self.sourceImage.size.width/self.sourceImage.size.height)>.001)return nil;
    self.targetImage=image; self.destination=view; self.targetFrame=[self geometry:view presentation:NO]; [self hide:view];
    return [[NSString alloc]initWithData:[NSJSONSerialization dataWithJSONObject:pose options:0 error:nil] encoding:NSUTF8StringEncoding];
}

- (BOOL)holdPage:(UIView *)page maxPixels:(double)maxPixels {
    if(self.disposed || self.pageImage || page.window!=self.host || JoltSharedUnsupportedContent(page, YES))return NO;
    CGRect frame=[self geometry:page presentation:YES];if(CGRectIsNull(frame))return NO;
    CGFloat scale=self.host.screen.scale;
    if(ceil(page.bounds.size.width*scale)*ceil(page.bounds.size.height*scale)+self.pixels>maxPixels)return NO;
    // Visible page only: UITableView/UIScrollView layers render their realized cells.
    UIGraphicsImageRendererFormat *format=[UIGraphicsImageRendererFormat defaultFormat];format.scale=scale;format.opaque=NO;
    UIGraphicsImageRenderer *renderer=[[UIGraphicsImageRenderer alloc]initWithSize:page.bounds.size format:format];
    self.pageImage=[renderer imageWithActions:^(UIGraphicsImageRendererContext *context){[page.layer renderInContext:context.CGContext];}];
    self.pageFrame=frame;return self.pageImage!=nil;
}
- (void)fade:(double)duration onEnd:(void (^)(BOOL))onEnd {
    if(self.disposed){if(onEnd)onEnd(NO);return;}
    [self.clock invalidate];self.fading=YES;self.duration=MAX(1,MIN(500,duration));self.started=CACurrentMediaTime()*1000;self.onEnd=onEnd;
    self.clock=[CADisplayLink displayLinkWithTarget:self selector:@selector(tick:)];[self.clock addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
}
- (double)pixels {
    return (self.pageImage?CGImageGetWidth(self.pageImage.CGImage)*CGImageGetHeight(self.pageImage.CGImage):0)+(self.sourceImage?CGImageGetWidth(self.sourceImage.CGImage)*CGImageGetHeight(self.sourceImage.CGImage):0)+(self.targetImage?CGImageGetWidth(self.targetImage.CGImage)*CGImageGetHeight(self.targetImage.CGImage):0);
}
- (NSString *)state {
    NSMutableArray *pose=[NSMutableArray new],*velocity=[NSMutableArray new];
    for(int i=0;i<(self.navigationImage?(self.clippedImage?14:10):6);i++)[pose addObject:@(_pose[i])]; for(int i=0;i<(self.navigationImage?(self.clippedImage?14:10):5);i++)[velocity addObject:@(_velocity[i])];
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
- (BOOL)beginInteractive:(NSString *)geometry {
    if(self.disposed || self.clock || !geometry)return NO;
    NSArray *target=[NSJSONSerialization JSONObjectWithData:[geometry dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    if(![target isKindOfClass:NSArray.class] || target.count!=(self.navigationImage?(self.clippedImage?13:9):5))return NO;
    for(id value in target)if(![value isKindOfClass:NSNumber.class] || !isfinite([value doubleValue]))return NO;
    for(int i=0;i<14;i++) { _interactiveStart[i]=_pose[i]; _interactiveEnd[i]=_pose[i]; }
    for(int i=0;i<target.count;i++)_interactiveEnd[i<5?i:i+1]=[target[i] doubleValue];
    _interactiveEnd[5]=1;
    return YES;
}
- (void)updateInteractive:(double)progress {
    if(self.disposed)return;
    double p=MAX(0,MIN(1,isfinite(progress)?progress:0));
    for(int i=0;i<14;i++)_pose[i]=_interactiveStart[i]+(_interactiveEnd[i]-_interactiveStart[i])*p;
    [self setNeedsDisplay];
}
- (BOOL)destinationIsStable {
    if(self.disposed || !self.destination || self.destination.window!=self.host)return NO;
    // Page opacity is intentionally animated by the transition; compare geometry only.
    CGRect current=[self.destination convertRect:self.destination.bounds toView:self.host], target=self.targetFrame;
    return fabs(current.origin.x-target.origin.x)<=1 && fabs(current.origin.y-target.origin.y)<=1 && fabs(current.size.width-target.size.width)<=1 && fabs(current.size.height-target.size.height)<=1;
}
- (void)evaluate:(double)now {
    double elapsed=MAX(0,now-self.started);
    for(int k=0;k<(self.navigationImage?(self.clippedImage?14:10):6);k++) {
        NSArray *times=self.tracks[k][@"times"],*values=self.tracks[k][@"values"]; NSUInteger j=1;
        while(j<times.count-1 && [times[j] doubleValue]<elapsed)j++;
        double span=[times[j] doubleValue]-[times[j-1] doubleValue]; double fraction=span<=0?1:MAX(0,MIN(1,(elapsed-[times[j-1] doubleValue])/span));
        _pose[k]=[values[j-1] doubleValue]+([values[j] doubleValue]-[values[j-1] doubleValue])*fraction;
        if(k!=5)_velocity[k]=elapsed>=[times.lastObject doubleValue]||span<=0?0:([values[j] doubleValue]-[values[j-1] doubleValue])*1000/span;
    }
}
- (void)tick:(CADisplayLink *)clock {
    if(self.fading){double p=MIN(1,(CACurrentMediaTime()*1000-self.started)/self.duration);self.alpha=1-p;if(p>=1)[self end:YES];return;}
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
    if(self.pageImage)[self.pageImage drawInRect:self.pageFrame blendMode:kCGBlendModeNormal alpha:1-MAX(0,MIN(1,_pose[5]))];
    CGRect box=CGRectMake(_pose[0],_pose[1],MAX(.1,_pose[2]),MAX(.1,_pose[3]));
    CGFloat radius=MAX(0,MIN(_pose[4],MIN(box.size.width,box.size.height)/2)); CGContextRef context=UIGraphicsGetCurrentContext(); CGContextSaveGState(context);
    [[UIBezierPath bezierPathWithRoundedRect:box cornerRadius:radius]addClip]; CGFloat mix=MAX(0,MIN(1,_pose[5]));
    if(self.navigationImage) {
        if(self.clippedImage)CGContextClipToRect(context,CGRectMake(_pose[10],_pose[11],MAX(0,_pose[12]),MAX(0,_pose[13])));
        CGRect content=CGRectMake(box.origin.x+_pose[6],box.origin.y+_pose[7],MAX(.1,_pose[8]),MAX(.1,_pose[9]));
        [self.sourceImage drawInRect:content]; CGContextRestoreGState(context); return;
    }
    CGContextBeginTransparencyLayer(context,NULL);
    [self drawImage:self.sourceImage size:self.sourceSize scales:self.sourceScales alpha:1-mix box:box blend:kCGBlendModeNormal]; [self drawImage:self.targetImage size:self.targetSize scales:self.targetScales alpha:mix box:box blend:kCGBlendModePlusLighter];
    CGContextEndTransparencyLayer(context); CGContextRestoreGState(context);
}
- (void)drawRect:(CGRect)rect { [self render]; }
- (void)dispose {
    if(self.disposed)return; self.disposed=YES; [self.clock invalidate]; self.clock=nil; self.onEnd=nil;
    for(UIView *view in self.hiddenViews)if(view.hidden)view.hidden=[[self.hiddenViews objectForKey:view]boolValue]; [self.hiddenViews removeAllObjects];
    [self removeFromSuperview]; self.sourceImage=nil; self.targetImage=nil; self.pageImage=nil; self.destination=nil; JoltSharedActive--;
}
@end
