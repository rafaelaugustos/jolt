#import "JoltScrollSource.h"
#import "JoltLiveSpring.h"
#import <QuartzCore/QuartzCore.h>

@implementation JoltScrollSource {
    __weak UIScrollView *_source;
    JoltLiveSpring *_node;
    void(^_changed)(void);
    BOOL _horizontal, _enabled, _observing, _disposed;
    double _offset, _previousTime;
    CGSize _size;
    NSUInteger _updates, _callbacks;
    BOOL _profiling;
    double _minimum, _maximum;
    NSMutableData *_costStorage;
    NSUInteger _costCount;
}
static NSUInteger active;
static void *ScrollSourceContext=&ScrollSourceContext;
+ (instancetype)attach:(UIScrollView *)source node:(JoltLiveSpring *)node horizontal:(BOOL)horizontal changed:(void(^)(void))changed {
    if (![source isKindOfClass:UIScrollView.class]) [NSException raise:NSInvalidArgumentException format:@"Expected a ScrollView, ListView or CollectionView"];
    JoltScrollSource *input=[self new]; input->_source=source; input->_node=node; input->_horizontal=horizontal; input->_changed=[changed copy];
    [input setEnabled:YES]; return input;
}
+ (NSUInteger)activeCount { return active; }
- (void)setEnabled:(BOOL)enabled {
    if(_disposed || _enabled==enabled)return;
    _enabled=enabled;
    if(enabled) {
        for(NSString *key in @[@"contentOffset",@"contentSize",@"adjustedContentInset",@"bounds"])
            [_source addObserver:self forKeyPath:key options:0 context:ScrollSourceContext];
        active++; [self refresh];
    } else {
        for(NSString *key in @[@"contentOffset",@"contentSize",@"adjustedContentInset",@"bounds"])
            [_source removeObserver:self forKeyPath:key context:ScrollSourceContext];
        active--; [_node setDataInput:_offset velocity:0];
    }
}
- (void)setObserving:(BOOL)observing { _observing=observing; }
- (void)observeValueForKeyPath:(NSString *)path ofObject:(id)object change:(NSDictionary *)change context:(void *)context {
    if(context!=ScrollSourceContext) { [super observeValueForKeyPath:path ofObject:object change:change context:context]; return; }
    if([path isEqualToString:@"bounds"] && CGSizeEqualToSize(_size,_source.bounds.size))return;
    [self update:![path isEqualToString:@"contentOffset"]];
}
- (void)update:(BOOL)force {
    UIScrollView *source=_source;
    if(_disposed || !_enabled || !source)return;
    double started=_profiling&&!force?CACurrentMediaTime():0;
    _size=source.bounds.size;
    UIEdgeInsets inset=source.adjustedContentInset;
    double next=_horizontal ? source.contentOffset.x+inset.left : source.contentOffset.y+inset.top;
    if(!isfinite(next) || (!force && next==_offset))return;
    double now=CACurrentMediaTime()*1000;
    double velocity=force || _previousTime==0 || now<=_previousTime || now-_previousTime>100 ? 0 : (next-_offset)*1000/(now-_previousTime);
    _offset=next; _previousTime=now; _updates++; [_node setDataInput:next velocity:velocity];
    _minimum=MIN(_minimum,next);_maximum=MAX(_maximum,next);
    if(_observing && _changed) { _callbacks++; _changed(); }
    if(started && _costCount<256)((double *)_costStorage.mutableBytes)[_costCount++]=(CACurrentMediaTime()-started)*1000;
}
- (void)setProfiling:(BOOL)enabled { _profiling=enabled;_costStorage=enabled?[NSMutableData dataWithLength:256*sizeof(double)]:nil;_costCount=0;_minimum=_maximum=_offset; }
- (void)refresh { [self update:YES]; }
- (NSString *)snapshot {
    NSMutableArray *costs=[NSMutableArray arrayWithCapacity:_costCount];
    const double *samples=_costStorage.bytes;
    for(NSUInteger i=0;i<_costCount;i++)[costs addObject:@(samples[i])];
    NSData *data=[NSJSONSerialization dataWithJSONObject:@{@"offset":@(_offset),@"updates":@(_updates),@"callbacks":@(_callbacks),@"minimum":@(_minimum),@"maximum":@(_maximum),@"producerMs":costs} options:0 error:nil];
    return [[NSString alloc]initWithData:data encoding:NSUTF8StringEncoding];
}
- (void)dispose { if(_disposed)return; [self setEnabled:NO]; _disposed=YES; _changed=nil; _node=nil; _source=nil; }
- (void)dealloc { [self dispose]; }
@end
