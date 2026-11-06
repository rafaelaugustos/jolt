#import "JoltBatchDrawing.h"
static NSInteger JoltBatchLive = 0;
@interface JoltBatchItem : NSObject
@property(nonatomic, copy) NSString *style;
@property(nonatomic, strong) UIBezierPath *path;
@end
@implementation JoltBatchItem
@end
@interface JoltBatchDrawing ()
@property(nonatomic, weak) UIView *target;
@property(nonatomic, strong) NSDictionary<NSString *, JoltBatchItem *> *items;
@property(nonatomic, strong) NSArray<JoltBatchItem *> *order;
@property(nonatomic, strong) NSDictionary<NSString *, NSDictionary *> *styles;
@property(nonatomic) CGRect viewBox;
@property(nonatomic) BOOL disposed;
@property(nonatomic, copy, readwrite) NSString *lastError;
@end
@implementation JoltBatchDrawing
+ (NSInteger)liveCount { return JoltBatchLive; }
+ (instancetype)attach:(UIView *)view {
    JoltBatchDrawing *surface = [self layer];
    surface.target = view;
    surface.name = @"jolt:drawing";
    surface.contentsScale = view.window.screen.scale ?: UIScreen.mainScreen.scale;
    surface.masksToBounds = YES;
    surface.needsDisplayOnBoundsChange = YES;
    surface.items = @{}; surface.styles = @{}; surface.order = @[];
    surface.viewBox = CGRectMake(0,0,1,1);
    [view.layer addSublayer:surface];
    JoltBatchLive++;
    [surface resize];
    return surface;
}
- (id<CAAction>)actionForKey:(NSString *)event { return (id<CAAction>)[NSNull null]; }
- (BOOL)apply:(NSString *)program {
    if (self.disposed || program.length > 2097152) { self.lastError = @"Drawing is disposed or exceeds payload budget"; return NO; }
    @try {
        NSError *error;
        NSDictionary *o = [NSJSONSerialization JSONObjectWithData:[program dataUsingEncoding:NSUTF8StringEncoding] options:0 error:&error];
        if (!o) { self.lastError = error.localizedDescription; return NO; }
        NSArray *list = o[@"items"], *sequence = o[@"order"], *paint = o[@"styles"], *b = o[@"viewBox"];
        if (list.count > 1024 || sequence.count > 1024 || paint.count > 64 || b.count != 4) @throw [NSException exceptionWithName:@"JoltDrawing" reason:@"Drawing item/style budget exceeded" userInfo:nil];
        NSMutableDictionary *items = [self.items mutableCopy], *styles = [NSMutableDictionary new];
        NSMutableArray *order = [NSMutableArray new];
        for (NSDictionary *style in paint) styles[style[@"id"]] = style;
        for (NSDictionary *item in list) {
            NSString *commands = item[@"commands"]; NSArray<NSNumber *> *v = item[@"points"];
            if (commands.length > 256 || v.count > 1536) @throw [NSException exceptionWithName:@"JoltDrawing" reason:@"Drawing geometry budget exceeded" userInfo:nil];
            UIBezierPath *path = [UIBezierPath bezierPath]; NSUInteger i = 0;
            for (NSUInteger c = 0; c < commands.length; c++) {
                switch ([commands characterAtIndex:c]) {
                    case 'M': [path moveToPoint:CGPointMake(v[i].doubleValue,v[i+1].doubleValue)]; i+=2; break;
                    case 'L': [path addLineToPoint:CGPointMake(v[i].doubleValue,v[i+1].doubleValue)]; i+=2; break;
                    case 'C': [path addCurveToPoint:CGPointMake(v[i+4].doubleValue,v[i+5].doubleValue) controlPoint1:CGPointMake(v[i].doubleValue,v[i+1].doubleValue) controlPoint2:CGPointMake(v[i+2].doubleValue,v[i+3].doubleValue)]; i+=6; break;
                    case 'Q': [path addQuadCurveToPoint:CGPointMake(v[i+2].doubleValue,v[i+3].doubleValue) controlPoint:CGPointMake(v[i].doubleValue,v[i+1].doubleValue)]; i+=4; break;
                    case 'Z': [path closePath]; break;
                    default: @throw [NSException exceptionWithName:@"JoltDrawing" reason:@"Invalid drawing command" userInfo:nil];
                }
            }
            if(i != v.count) @throw [NSException exceptionWithName:@"JoltDrawing" reason:@"Invalid drawing points" userInfo:nil];
            JoltBatchItem *value = [JoltBatchItem new]; value.style = item[@"style"]; value.path = path;
            items[item[@"id"]] = value;
        }
        NSMutableDictionary *retained = [NSMutableDictionary new];
        for (NSString *key in sequence) {
            JoltBatchItem *item = items[key];
            if (!item || !styles[item.style] || retained[key]) @throw [NSException exceptionWithName:@"JoltDrawing" reason:@"Invalid drawing identity/style" userInfo:nil];
            [order addObject:item]; retained[key] = item;
        }
        CGRect box = CGRectMake([b[0] doubleValue],[b[1] doubleValue],[b[2] doubleValue],[b[3] doubleValue]);
        if (box.size.width <= 0 || box.size.height <= 0) @throw [NSException exceptionWithName:@"JoltDrawing" reason:@"Invalid drawing viewBox" userInfo:nil];
        self.items = retained; self.styles = styles; self.order = order; self.viewBox = box;
        self.lastError = nil;
        [self setNeedsDisplay];
        return YES;
    } @catch (NSException *exception) { self.lastError = exception.reason; return NO; }
}
static void color(CGContextRef context, uint32_t value, BOOL fill) {
    CGFloat r=((value>>16)&255)/255.0, g=((value>>8)&255)/255.0, b=(value&255)/255.0, a=((value>>24)&255)/255.0;
    if(fill) CGContextSetRGBFillColor(context,r,g,b,a); else CGContextSetRGBStrokeColor(context,r,g,b,a);
}
- (void)drawInContext:(CGContextRef)context {
    if (self.disposed || self.bounds.size.width <= 0 || self.bounds.size.height <= 0) return;
    CGRect b = self.bounds, box = self.viewBox;
    CGFloat scale = MIN(b.size.width/box.size.width,b.size.height/box.size.height);
    CGContextSaveGState(context); CGContextClipToRect(context,b);
    CGContextTranslateCTM(context,CGRectGetMidX(b)-box.size.width*scale/2,CGRectGetMidY(b)-box.size.height*scale/2);
    CGContextScaleCTM(context,scale,scale); CGContextTranslateCTM(context,-box.origin.x,-box.origin.y);
    for (JoltBatchItem *item in self.order) {
        NSDictionary *s = self.styles[item.style];
        color(context,[s[@"fill"] unsignedIntValue],YES); color(context,[s[@"stroke"] unsignedIntValue],NO);
        CGContextSetLineWidth(context,[s[@"width"] doubleValue]);
        CGContextSetLineCap(context,[s[@"cap"] isEqual:@"round"]?kCGLineCapRound:[s[@"cap"] isEqual:@"square"]?kCGLineCapSquare:kCGLineCapButt);
        CGContextSetLineJoin(context,[s[@"join"] isEqual:@"round"]?kCGLineJoinRound:[s[@"join"] isEqual:@"bevel"]?kCGLineJoinBevel:kCGLineJoinMiter);
        BOOL evenodd = [s[@"rule"] isEqual:@"evenodd"];
        CGContextAddPath(context,item.path.CGPath);
        if ([s[@"width"] doubleValue] > 0) CGContextDrawPath(context,evenodd?kCGPathEOFillStroke:kCGPathFillStroke);
        else if(evenodd) CGContextEOFillPath(context); else CGContextFillPath(context);
    }
    CGContextRestoreGState(context);
}
- (void)resize { if (!self.disposed && self.target) self.frame = self.target.bounds; }
- (void)dispose {
    if(self.disposed)return;
    self.disposed=YES; JoltBatchLive--;
    [self removeFromSuperlayer]; self.target=nil; self.items=@{}; self.styles=@{}; self.order=@[]; self.contents=nil;
}
@end
