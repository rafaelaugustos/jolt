#import "JoltLivePaint.h"
#import <QuartzCore/QuartzCore.h>

static NSMapTable<UIView *, JoltLivePaint *> *surfaces;
static UIColor *paintColor(double value) {
    uint32_t c = (uint32_t)value;
    return [UIColor colorWithRed:((c>>16)&255)/255.0 green:((c>>8)&255)/255.0 blue:(c&255)/255.0 alpha:(c>>24)/255.0];
}
static NSArray<NSString *> *corners(void) { return @[@"borderTopLeftRadius",@"borderTopRightRadius",@"borderBottomRightRadius",@"borderBottomLeftRadius"]; }
static NSArray<NSString *> *sides(void) { return @[@"borderTopWidth",@"borderRightWidth",@"borderBottomWidth",@"borderLeftWidth"]; }
static CGPathRef rounded(CGRect rect, const double *x, const double *y) {
    CGMutablePathRef p=CGPathCreateMutable();
    double l=CGRectGetMinX(rect),r=CGRectGetMaxX(rect),t=CGRectGetMinY(rect),b=CGRectGetMaxY(rect), k=.5522847498307936;
    CGPathMoveToPoint(p,NULL,l+x[0],t); CGPathAddLineToPoint(p,NULL,r-x[1],t);
    CGPathAddCurveToPoint(p,NULL,r-x[1]+k*x[1],t,r,t+y[1]-k*y[1],r,t+y[1]);
    CGPathAddLineToPoint(p,NULL,r,b-y[2]); CGPathAddCurveToPoint(p,NULL,r,b-y[2]+k*y[2],r-x[2]+k*x[2],b,r-x[2],b);
    CGPathAddLineToPoint(p,NULL,l+x[3],b); CGPathAddCurveToPoint(p,NULL,l+x[3]-k*x[3],b,l,b-y[3]+k*y[3],l,b-y[3]);
    CGPathAddLineToPoint(p,NULL,l,t+y[0]); CGPathAddCurveToPoint(p,NULL,l,t+y[0]-k*y[0],l+x[0]-k*x[0],t,l+x[0],t);
    CGPathCloseSubpath(p); return p;
}
@interface JoltLivePaint ()
@property(nonatomic,weak) UIView *view;
@property(nonatomic) NSDictionary *base;
@property(nonatomic) NSMutableDictionary<NSString *,NSNumber *> *values;
@property(nonatomic) NSMapTable<NSString *,id> *owners;
@property(nonatomic) CAShapeLayer *clip;
@property(nonatomic) CALayer *border;
@property(nonatomic) NSArray<CAShapeLayer *> *edges;
@property(nonatomic) CALayer *previousMask;
@property(nonatomic,weak) CALayer *coreBorder;
@property(nonatomic) float coreOpacity;
@end
@implementation JoltLivePaint
+ (void)configure:(UIView *)view config:(NSString *)config border:(CALayer *)border {
    if (!surfaces) surfaces=[NSMapTable weakToStrongObjectsMapTable];
    JoltLivePaint *paint=[surfaces objectForKey:view];
    if (!paint) { paint=[self new];paint.view=view;paint.values=[NSMutableDictionary new];paint.owners=[NSMapTable strongToWeakObjectsMapTable];[surfaces setObject:paint forKey:view]; }
    [paint configure:config border:border];
}
+ (void)refresh:(UIView *)view config:(NSString *)config border:(CALayer *)border {
    JoltLivePaint *paint=[surfaces objectForKey:view]; if (paint) { [paint configure:config border:border]; [paint draw]; }
}
- (void)configure:(NSString *)config border:(CALayer *)border {
    self.base=[NSJSONSerialization JSONObjectWithData:[config dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    if (self.coreBorder!=border) { if(self.coreBorder.opacity==0)self.coreBorder.opacity=self.coreOpacity; self.coreBorder=border;self.coreOpacity=border.opacity; }
}
+ (instancetype)acquire:(UIView *)view property:(NSString *)property owner:(id)owner {
    JoltLivePaint *paint=[surfaces objectForKey:view];
    if (!paint) [NSException raise:NSInvalidArgumentException format:@"Live paint needs a configured surface"];
    [paint.owners setObject:owner forKey:property]; return paint;
}
- (void)write:(double)value property:(NSString *)property owner:(id)owner {
    if ([self.owners objectForKey:property]!=owner) return;
    self.values[property]=@(value);[self draw];
}
- (void)restoreGeometry {
    UIView *view=self.view;
    BOOL owned=self.clip && view.layer.mask==self.clip;
    if (view.layer.mask==self.clip) view.layer.mask=self.previousMask;
    [self.border removeFromSuperlayer];self.border=nil;self.clip=nil;self.edges=nil;self.previousMask=nil;
    if (self.coreBorder.opacity==0) self.coreBorder.opacity=self.coreOpacity;
    if (owned) {
        NSArray *r=self.base[@"radii"], *w=self.base[@"widths"];
        BOOL uniformRadius=YES, uniformWidth=YES;
        for(int i=1;i<4;i++){uniformRadius &= [r[i] isEqual:r[0]];uniformWidth &= [w[i] isEqual:w[0]];}
        view.layer.cornerRadius=uniformRadius?[r[0] doubleValue]:0;
        view.layer.borderWidth=uniformWidth?[w[0] doubleValue]:0;
    }
}
- (void)releaseProperty:(NSString *)property owner:(id)owner {
    if ([self.owners objectForKey:property]!=owner) return;
    [self.owners removeObjectForKey:property];[self.values removeObjectForKey:property];
    if (!self.owners.count) { [self restoreGeometry];[surfaces removeObjectForKey:self.view]; }
    else [self draw];
}
- (void)draw {
    UIView *view=self.view;if(!view)return;
    [CATransaction begin];[CATransaction setDisableActions:YES];
    NSNumber *background=self.values[@"backgroundColor"],*color=self.values[@"borderColor"],*text=self.values[@"color"];
    if(background)view.layer.backgroundColor=paintColor(background.doubleValue).CGColor;
    if(text) {
        UIColor *tint=paintColor(text.doubleValue);
        if([view isKindOfClass:UILabel.class])((UILabel *)view).textColor=tint;
        else if([view isKindOfClass:UIButton.class])[(UIButton *)view setTitleColor:tint forState:UIControlStateNormal];
    }
    BOOL geometry=self.values[@"borderRadius"]||self.values[@"borderWidth"];
    for(NSString *key in corners())geometry|=self.values[key]!=nil;
    for(NSString *key in sides())geometry|=self.values[key]!=nil;
    if(!geometry) {
        if(self.clip)[self restoreGeometry];
        if(color) {view.layer.borderColor=paintColor(color.doubleValue).CGColor;if([self.coreBorder isKindOfClass:CAShapeLayer.class])((CAShapeLayer *)self.coreBorder).fillColor=paintColor(color.doubleValue).CGColor;}
        [CATransaction commit];return;
    }
    CGRect bounds=view.bounds;double width=bounds.size.width,height=bounds.size.height;
    double radii[4],widths[4],rx[4],ry[4];
    for(int i=0;i<4;i++) {
        radii[i]=MAX(0,[self.values[corners()[i]] ?: self.values[@"borderRadius"] ?: self.base[@"radii"][i] doubleValue]);
        widths[i]=MAX(0,[self.values[sides()[i]] ?: self.values[@"borderWidth"] ?: self.base[@"widths"][i] doubleValue]);
    }
    double cap=1;
    double sums[]={radii[0]+radii[1],radii[3]+radii[2],radii[0]+radii[3],radii[1]+radii[2]};
    for(int i=0;i<4;i++)if(sums[i]>0)cap=MIN(cap,(i<2?width:height)/sums[i]);
    for(int i=0;i<4;i++)radii[i]*=cap;
    widths[0]=MIN(widths[0],height/2);widths[2]=MIN(widths[2],height/2);widths[1]=MIN(widths[1],width/2);widths[3]=MIN(widths[3],width/2);
    rx[0]=MAX(0,radii[0]-widths[3]);ry[0]=MAX(0,radii[0]-widths[0]);
    rx[1]=MAX(0,radii[1]-widths[1]);ry[1]=MAX(0,radii[1]-widths[0]);
    rx[2]=MAX(0,radii[2]-widths[1]);ry[2]=MAX(0,radii[2]-widths[2]);
    rx[3]=MAX(0,radii[3]-widths[3]);ry[3]=MAX(0,radii[3]-widths[2]);
    CGPathRef outer=rounded(bounds,radii,radii),inner=rounded(UIEdgeInsetsInsetRect(bounds,UIEdgeInsetsMake(widths[0],widths[3],widths[2],widths[1])),rx,ry);
    if(!self.clip) {
        self.clip=[CAShapeLayer layer];self.border=[CALayer layer];self.border.name=@"jolt:live-paint";
        NSMutableArray *edges=[NSMutableArray new];
        for(int i=0;i<4;i++){CAShapeLayer *edge=[CAShapeLayer layer];CAShapeLayer *mask=[CAShapeLayer layer];mask.fillRule=kCAFillRuleEvenOdd;edge.mask=mask;[self.border addSublayer:edge];[edges addObject:edge];}self.edges=edges;
    }
    if(view.layer.mask!=self.clip){self.previousMask=view.layer.mask;view.layer.mask=self.clip;}
    self.clip.frame=bounds;self.clip.path=outer;
    view.layer.cornerRadius=(radii[0]==radii[1] && radii[0]==radii[2] && radii[0]==radii[3])?radii[0]:0;
    view.layer.borderWidth=0;
    self.coreBorder.opacity=0;
    if(self.border.superlayer!=view.layer)[view.layer addSublayer:self.border];
    self.border.frame=bounds;
    CGMutablePathRef ring=CGPathCreateMutable();CGPathAddPath(ring,NULL,outer);CGPathAddPath(ring,NULL,inner);
    CGPoint p[]={CGPointMake(0,0),CGPointMake(width,0),CGPointMake(width,height),CGPointMake(0,height)};
    for(int i=0;i<4;i++){
        CAShapeLayer *edge=self.edges[i];edge.frame=bounds;edge.fillColor=paintColor([color ?: self.base[@"colors"][i] doubleValue]).CGColor;
        CGMutablePathRef wedge=CGPathCreateMutable();CGPathMoveToPoint(wedge,NULL,p[i].x,p[i].y);CGPathAddLineToPoint(wedge,NULL,p[(i+1)%4].x,p[(i+1)%4].y);CGPathAddLineToPoint(wedge,NULL,width/2,height/2);CGPathCloseSubpath(wedge);edge.path=wedge;
        ((CAShapeLayer *)edge.mask).frame=bounds;((CAShapeLayer *)edge.mask).path=ring;CGPathRelease(wedge);
    }
    CGPathRelease(ring);CGPathRelease(outer);CGPathRelease(inner);[CATransaction commit];
}
@end
