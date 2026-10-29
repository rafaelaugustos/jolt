#import "JoltScrollHeader.h"
#import <QuartzCore/QuartzCore.h>

@interface JoltScrollHeaderDelegate : NSObject <UITableViewDelegate>
@property(nonatomic) id<UITableViewDelegate> forwarded;
@property(nonatomic) double spacer, rowHeight;
@end
@implementation JoltScrollHeaderDelegate
- (BOOL)respondsToSelector:(SEL)selector { return [super respondsToSelector:selector] || [self.forwarded respondsToSelector:selector]; }
- (id)forwardingTargetForSelector:(SEL)selector { return self.forwarded; }
- (CGFloat)tableView:(UITableView *)tableView heightForRowAtIndexPath:(NSIndexPath *)path { return path.row == 0 ? self.spacer : self.rowHeight; }
- (CGFloat)tableView:(UITableView *)tableView estimatedHeightForRowAtIndexPath:(NSIndexPath *)path { return path.row == 0 ? self.spacer : self.rowHeight; }
@end

@interface JoltScrollHeader ()
@property(nonatomic) JoltScrollHeaderDelegate *proxy;
@property(nonatomic,weak) UITableView *list;
@property(nonatomic) JoltLiveSpring *node;
@property(nonatomic,weak) UIView *title, *toolbarTitle, *toolbar;
@property(nonatomic,weak) UILabel *diagnostic;
@property(nonatomic,copy) void (^onState)(void);
@property(nonatomic) BOOL observing, disposed, titleHidden, toolbarTitleHidden, toolbarTouch;
@property(nonatomic) double handoff, minimumOffset, maximumOffset, range, spacer, rowHeight, offset;
@property(nonatomic) CGFloat estimatedSectionHeaderHeight, estimatedSectionFooterHeight;
@property(nonatomic) NSInteger phase, updates, callbacks;
@end
static NSInteger JoltScrollHeaderActive = 0;
static void *JoltScrollHeaderContext = &JoltScrollHeaderContext;
@implementation JoltScrollHeader
+ (NSInteger)activeCount { return JoltScrollHeaderActive; }
+ (instancetype)attach:(UITableView *)list node:(JoltLiveSpring *)node title:(UIView *)title toolbarTitle:(UIView *)toolbarTitle toolbar:(UIView *)toolbar diagnostic:(UILabel *)diagnostic options:(NSString *)options onState:(void (^)(void))onState {
    if(![list isKindOfClass:UITableView.class]) [NSException raise:NSInvalidArgumentException format:@"scrollHeader requires UITableView"];
    JoltScrollHeader *owner=[self new];owner.list=list;owner.node=node;owner.title=title;owner.toolbarTitle=toolbarTitle;owner.toolbar=toolbar;owner.diagnostic=diagnostic;owner.onState=onState;
    owner.titleHidden=title.accessibilityElementsHidden;owner.toolbarTitleHidden=toolbarTitle.accessibilityElementsHidden;owner.toolbarTouch=toolbar.userInteractionEnabled;owner.phase=-1;owner.offset=NAN;
    owner.proxy=[JoltScrollHeaderDelegate new];owner.proxy.forwarded=list.delegate;
    // Flat lists have no section headers/footers. UIKit's automatic estimates
    // otherwise adjust the scroll anchor during width/safe-area changes.
    owner.estimatedSectionHeaderHeight=list.estimatedSectionHeaderHeight;
    owner.estimatedSectionFooterHeight=list.estimatedSectionFooterHeight;
    list.estimatedSectionHeaderHeight=0;list.estimatedSectionFooterHeight=0;
    [owner configure:options];list.delegate=owner.proxy;[list reloadData];[list layoutIfNeeded];[owner setEnabled:YES];return owner;
}
- (void)configure:(NSString *)options {
    NSDictionary *config=[NSJSONSerialization JSONObjectWithData:[options dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    self.handoff=[config[@"handoff"] doubleValue];self.range=[config[@"range"] doubleValue];self.spacer=[config[@"spacer"] doubleValue];self.rowHeight=[config[@"rowHeight"] doubleValue];
    self.proxy.spacer=self.spacer;self.proxy.rowHeight=self.rowHeight;
    [self.list reloadData];
    if(self.observing)[self update:YES];
}
- (void)setEnabled:(BOOL)enabled {
    if(self.disposed || enabled==self.observing)return;
    self.observing=enabled;
    if(enabled) {
        for(NSString *key in @[@"contentOffset",@"contentSize",@"bounds"]) [self.list addObserver:self forKeyPath:key options:0 context:JoltScrollHeaderContext];
        JoltScrollHeaderActive++;[self update:YES];
    } else {
        for(NSString *key in @[@"contentOffset",@"contentSize",@"bounds"]) [self.list removeObserver:self forKeyPath:key context:JoltScrollHeaderContext];
        JoltScrollHeaderActive--;
    }
}
- (void)observeValueForKeyPath:(NSString *)key ofObject:(id)object change:(NSDictionary *)change context:(void *)context {
    if(context==JoltScrollHeaderContext) [self update:NO];
    else [super observeValueForKeyPath:key ofObject:object change:change context:context];
}
- (void)update:(BOOL)force {
    if(self.disposed || !self.list)return;
    double offset=self.list.contentOffset.y+self.list.adjustedContentInset.top;
    if(!isfinite(offset) || (!force && fabs(offset-self.offset)<.001))return;
    self.offset=offset;self.minimumOffset=MIN(self.minimumOffset,offset);self.maximumOffset=MAX(self.maximumOffset,offset);self.updates++;
    // Existing native value graph applies all derived bindings in one transaction.
    [self.node setTarget:offset];
    BOOL compact=offset>=self.range*self.handoff;
    self.title.accessibilityElementsHidden=self.titleHidden || compact;
    self.toolbarTitle.accessibilityElementsHidden=self.toolbarTitleHidden || !compact;
    self.toolbar.userInteractionEnabled=self.toolbarTouch && compact;
    NSInteger phase=offset<=.5?0:offset>=self.range-.5?2:1;
    if(phase!=self.phase){self.phase=phase;self.callbacks++;if(self.onState)self.onState();}
    if(self.diagnostic)self.diagnostic.text=[NSString stringWithFormat:@"y %.0f · range %.0f · native %ld · JS %ld",offset,self.range,(long)self.updates,(long)self.callbacks];
}
- (NSString *)snapshot {
    NSArray *rows=self.list.indexPathsForVisibleRows;
    NSInteger first=rows.count?((NSIndexPath *)rows.firstObject).row:0;
    NSDictionary *value=@{@"minimumOffset":@(self.minimumOffset),@"maximumOffset":@(self.maximumOffset),@"offset":@(isfinite(self.offset)?self.offset:0),@"phase":@[@"expanded",@"between",@"collapsed"][MAX(0,self.phase)],@"updates":@(self.updates),@"callbacks":@(self.callbacks),@"first":@(first),@"visible":@(rows.count),@"total":@([self.list numberOfRowsInSection:0])};
    return [[NSString alloc]initWithData:[NSJSONSerialization dataWithJSONObject:value options:0 error:nil] encoding:NSUTF8StringEncoding];
}
- (void)scroll:(double)offset animated:(BOOL)animated {
    if(self.disposed || !isfinite(offset))return;
    UIEdgeInsets inset=self.list.adjustedContentInset;
    double maximum=MAX(0,self.list.contentSize.height+inset.top+inset.bottom-self.list.bounds.size.height);
    [self.list setContentOffset:CGPointMake(self.list.contentOffset.x,MIN(maximum,MAX(0,offset))-inset.top) animated:animated];
    if(!animated)[self update:YES];
}
- (void)dispose {
    if(self.disposed)return;[self setEnabled:NO];self.disposed=YES;
    self.title.accessibilityElementsHidden=self.titleHidden;self.toolbarTitle.accessibilityElementsHidden=self.toolbarTitleHidden;self.toolbar.userInteractionEnabled=self.toolbarTouch;
    if(self.list.delegate==self.proxy)self.list.delegate=self.proxy.forwarded;
    if(self.list.estimatedSectionHeaderHeight==0)self.list.estimatedSectionHeaderHeight=self.estimatedSectionHeaderHeight;
    if(self.list.estimatedSectionFooterHeight==0)self.list.estimatedSectionFooterHeight=self.estimatedSectionFooterHeight;
    self.proxy=nil;self.node=nil;self.onState=nil;
}
@end
