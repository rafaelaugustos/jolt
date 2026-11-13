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
    _size=source.bounds.size;
    UIEdgeInsets inset=source.adjustedContentInset;
    double next=_horizontal ? source.contentOffset.x+inset.left : source.contentOffset.y+inset.top;
    if(!isfinite(next) || (!force && next==_offset))return;
    double now=CACurrentMediaTime()*1000;
    double velocity=force || _previousTime==0 || now<=_previousTime || now-_previousTime>100 ? 0 : (next-_offset)*1000/(now-_previousTime);
    _offset=next; _previousTime=now; _updates++; [_node setDataInput:next velocity:velocity];
    if(_observing && _changed) { _callbacks++; _changed(); }
}
- (void)refresh { [self update:YES]; }
- (NSString *)snapshot { return [NSString stringWithFormat:@"{\"offset\":%.17g,\"updates\":%lu,\"callbacks\":%lu}",_offset,(unsigned long)_updates,(unsigned long)_callbacks]; }
- (void)dispose { if(_disposed)return; [self setEnabled:NO]; _disposed=YES; _changed=nil; _node=nil; _source=nil; }
- (void)dealloc { [self dispose]; }
@end
