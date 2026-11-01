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
@property(nonatomic,weak) UIView *header, *title, *toolbarTitle, *toolbar;
@property(nonatomic,weak) UILabel *diagnostic;
@property(nonatomic,copy) void (^onState)(void);
@property(nonatomic) BOOL observing, disposed, headerHidden, titleHidden, toolbarTitleHidden, toolbarHidden, toolbarTouch, titleElement, toolbarTitleElement;
@property(nonatomic) double handoff, minimumOffset, maximumOffset, range, spacer, rowHeight, offset;
@property(nonatomic) CGFloat estimatedSectionHeaderHeight, estimatedSectionFooterHeight;
@property(nonatomic) NSInteger phase, accessibilityPhase, updates, callbacks;
@property(nonatomic) BOOL refreshEnabled, reduced, pullEligible, panObserving;
@property(nonatomic) double refreshThreshold, pull;
@property(nonatomic) NSInteger refreshState, refreshRequests;
@property(nonatomic) UIView *refreshIndicator;
@property(nonatomic) CAShapeLayer *refreshRing;
@property(nonatomic) NSMapTable<UITableViewCell *,NSNumber *> *coveredRows;
@end
static NSInteger JoltScrollHeaderActive = 0;
static void *JoltScrollHeaderContext = &JoltScrollHeaderContext;
@implementation JoltScrollHeader
+ (NSInteger)activeCount { return JoltScrollHeaderActive; }
+ (instancetype)attach:(UITableView *)list node:(JoltLiveSpring *)node header:(UIView *)header title:(UIView *)title toolbarTitle:(UIView *)toolbarTitle toolbar:(UIView *)toolbar diagnostic:(UILabel *)diagnostic options:(NSString *)options onState:(void (^)(void))onState {
    if(![list isKindOfClass:UITableView.class]) [NSException raise:NSInvalidArgumentException format:@"scrollHeader requires UITableView"];
    JoltScrollHeader *owner=[self new];owner.list=list;owner.node=node;owner.title=title;owner.toolbarTitle=toolbarTitle;owner.toolbar=toolbar;owner.diagnostic=diagnostic;owner.onState=onState;
    owner.titleHidden=title.accessibilityElementsHidden;owner.toolbarTitleHidden=toolbarTitle.accessibilityElementsHidden;owner.toolbarTouch=toolbar.userInteractionEnabled;owner.phase=-1;owner.offset=NAN;
    owner.toolbarHidden=toolbar.accessibilityElementsHidden;owner.titleElement=title.isAccessibilityElement;owner.toolbarTitleElement=toolbarTitle.isAccessibilityElement;owner.accessibilityPhase=-1;
    owner.coveredRows=[NSMapTable weakToStrongObjectsMapTable];
    owner.header=header;owner.headerHidden=header.accessibilityElementsHidden;
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
    self.handoff=[config[[config[@"reduced"] boolValue]?@"handoff":@"focusHandoff"] doubleValue];self.range=[config[@"range"] doubleValue];self.spacer=[config[@"spacer"] doubleValue];self.rowHeight=[config[@"rowHeight"] doubleValue];
    self.proxy.spacer=self.spacer;self.proxy.rowHeight=self.rowHeight;
    self.reduced=[config[@"reduced"] boolValue];self.refreshEnabled=[config[@"refresh"] boolValue];self.refreshThreshold=[config[@"refreshThreshold"] doubleValue];
    if(self.refreshEnabled && !self.refreshIndicator){
        if(self.list.refreshControl) [NSException raise:NSInvalidArgumentException format:@"scrollHeader cannot replace an app-owned refresh control"];
        self.refreshIndicator=[[UIView alloc]initWithFrame:CGRectMake(0,0,36,36)];
        self.refreshIndicator.backgroundColor=[UIColor colorWithRed:.957 green:.941 blue:.906 alpha:1];
        self.refreshIndicator.layer.cornerRadius=18;self.refreshIndicator.userInteractionEnabled=NO;
        self.refreshIndicator.accessibilityElementsHidden=YES;self.refreshIndicator.hidden=YES;
        self.refreshRing=[CAShapeLayer layer];self.refreshRing.frame=self.refreshIndicator.bounds;
        self.refreshRing.path=[UIBezierPath bezierPathWithArcCenter:CGPointMake(18,18) radius:11 startAngle:-M_PI_2 endAngle:M_PI*1.5 clockwise:YES].CGPath;
        self.refreshRing.fillColor=UIColor.clearColor.CGColor;
        self.refreshRing.strokeColor=[UIColor colorWithRed:.098 green:.239 blue:.204 alpha:1].CGColor;
        self.refreshRing.lineWidth=3;self.refreshRing.lineCap=kCALineCapRound;
        [self.refreshIndicator.layer addSublayer:self.refreshRing];
        [self.list.superview addSubview:self.refreshIndicator];
    }
    [self updateRefreshIndicator];
    [self.list reloadData];
    if(self.observing)[self update:YES];
}
- (void)setEnabled:(BOOL)enabled {
    if(self.disposed || enabled==self.observing)return;
    self.observing=enabled;
    if(enabled) {
        for(NSString *key in @[@"contentOffset",@"contentSize",@"bounds"]) [self.list addObserver:self forKeyPath:key options:0 context:JoltScrollHeaderContext];
        if(self.refreshEnabled){[self.list.panGestureRecognizer addTarget:self action:@selector(refreshPan:)];self.panObserving=YES;}
        JoltScrollHeaderActive++;[self update:YES];
    } else {
        for(NSString *key in @[@"contentOffset",@"contentSize",@"bounds"]) [self.list removeObserver:self forKeyPath:key context:JoltScrollHeaderContext];
        if(self.panObserving){[self.list.panGestureRecognizer removeTarget:self action:@selector(refreshPan:)];self.panObserving=NO;}
        self.pullEligible=NO;self.pull=0;if(self.refreshState!=3)[self changeRefreshState:0];
        JoltScrollHeaderActive--;
    }
    [self updateRefreshIndicator];
}
- (void)observeValueForKeyPath:(NSString *)key ofObject:(id)object change:(NSDictionary *)change context:(void *)context {
    if(context==JoltScrollHeaderContext) [self update:NO];
    else [super observeValueForKeyPath:key ofObject:object change:change context:context];
}
- (void)update:(BOOL)force {
    if(self.disposed || !self.list)return;
    double offset=self.list.contentOffset.y+self.list.adjustedContentInset.top;
    if(!isfinite(offset) || (!force && fabs(offset-self.offset)<.001))return;
    self.offset=offset;
    if(self.refreshEnabled && self.pullEligible && self.refreshState!=3){
        self.pull=MAX(0,-offset);
        [self changeRefreshState:self.pull>=self.refreshThreshold?2:self.pull>0?1:0];
    }
    [self updateRefreshIndicator];
    self.minimumOffset=MIN(self.minimumOffset,offset);self.maximumOffset=MAX(self.maximumOffset,offset);self.updates++;
    BOOL compact=offset>=self.range*self.handoff;
    UIView *outgoing=compact?self.title:self.toolbarTitle, *incoming=compact?self.toolbarTitle:self.title;
    // Inspect focus only at a semantic boundary while VoiceOver is running.
    // An unrelated row/control never triggers a title handoff.
    BOOL transfer=NO;
    if(self.accessibilityPhase>=0 && self.accessibilityPhase!=(compact?1:0) && UIAccessibilityIsVoiceOverRunning()) {
        id focused=UIAccessibilityFocusedElement(UIAccessibilityNotificationVoiceOverIdentifier);
        transfer=focused==outgoing || ([focused isKindOfClass:UIView.class] && [(UIView *)focused isDescendantOfView:compact?self.header:self.toolbar]);
    }
    // Existing native value graph applies all derived bindings in one transaction.
    [self.node setTarget:offset];
    [self updateAccessibleRows];
    if(self.accessibilityPhase!=(compact?1:0)) {
        self.accessibilityPhase=compact?1:0;
        self.header.accessibilityElementsHidden=self.headerHidden || compact;
        self.title.accessibilityElementsHidden=self.titleHidden || compact;
        self.title.isAccessibilityElement=self.titleElement && !compact;
        self.toolbarTitle.accessibilityElementsHidden=self.toolbarTitleHidden || !compact;
        self.toolbarTitle.isAccessibilityElement=self.toolbarTitleElement && compact;
        self.toolbar.accessibilityElementsHidden=self.toolbarHidden || !compact;
        self.toolbar.userInteractionEnabled=self.toolbarTouch && compact;
        if(transfer && incoming.isAccessibilityElement && !incoming.accessibilityElementsHidden && !(compact?self.toolbarHidden:self.headerHidden)) {
            // Let the current accessibility scroll/activation finish first.
            // UIKit can otherwise replace a synchronous handoff with its own
            // fallback focus after the outgoing element becomes hidden.
            __weak JoltScrollHeader *weakSelf=self;
            NSInteger expected=self.accessibilityPhase;
            dispatch_async(dispatch_get_main_queue(), ^{
                JoltScrollHeader *owner=weakSelf;
                if(!owner || owner.disposed || !owner.observing || owner.accessibilityPhase!=expected || !UIAccessibilityIsVoiceOverRunning())return;
                UIView *target=expected?owner.toolbarTitle:owner.title;
                if(target.isAccessibilityElement && !target.accessibilityElementsHidden)
                    UIAccessibilityPostNotification(UIAccessibilityLayoutChangedNotification,target);
            });
        }
    }
    NSInteger phase=offset<=.5?0:offset>=self.range-.5?2:1;
    if(phase!=self.phase){self.phase=phase;self.callbacks++;if(self.onState)self.onState();}
    if(self.diagnostic)self.diagnostic.text=[NSString stringWithFormat:@"y %.0f · range %.0f · native %ld · JS %ld",offset,self.range,(long)self.updates,(long)self.callbacks];
}
- (void)updateAccessibleRows {
    NSArray<UITableViewCell *> *visible=self.list.visibleCells;
    for(UITableViewCell *cell in self.coveredRows.keyEnumerator.allObjects) {
        if(![visible containsObject:cell]){NSInteger saved=[[self.coveredRows objectForKey:cell] integerValue];cell.accessibilityElementsHidden=(saved&1)!=0;cell.isAccessibilityElement=(saved&2)!=0;[self.coveredRows removeObjectForKey:cell];}
    }
    double edge=self.spacer-MIN(self.range,MAX(0,self.offset));
    for(UITableViewCell *cell in visible) {
        NSIndexPath *path=[self.list indexPathForCell:cell];
        BOOL hidden=path.row==0 || CGRectGetMaxY(cell.frame)-self.list.contentOffset.y<=edge+.5;
        NSNumber *saved=[self.coveredRows objectForKey:cell];
        if(hidden){
            if(!saved)[self.coveredRows setObject:@((cell.accessibilityElementsHidden?1:0)|(cell.isAccessibilityElement?2:0)) forKey:cell];
            if(!cell.accessibilityElementsHidden)cell.accessibilityElementsHidden=YES;
            if(cell.isAccessibilityElement)cell.isAccessibilityElement=NO;
        } else if(saved){cell.accessibilityElementsHidden=(saved.integerValue&1)!=0;cell.isAccessibilityElement=(saved.integerValue&2)!=0;[self.coveredRows removeObjectForKey:cell];}
    }
}
- (NSString *)snapshot {
    NSArray *rows=self.list.indexPathsForVisibleRows;
    NSInteger first=rows.count?((NSIndexPath *)rows.firstObject).row:0;
    NSDictionary *value=@{@"minimumOffset":@(self.minimumOffset),@"maximumOffset":@(self.maximumOffset),@"offset":@(isfinite(self.offset)?self.offset:0),@"phase":@[@"expanded",@"between",@"collapsed"][MAX(0,self.phase)],@"refresh":@[@"idle",@"pulling",@"armed",@"refreshing"][self.refreshState],@"refreshRequests":@(self.refreshRequests),@"updates":@(self.updates),@"callbacks":@(self.callbacks),@"first":@(first),@"visible":@(rows.count),@"total":@([self.list numberOfRowsInSection:0])};
    return [[NSString alloc]initWithData:[NSJSONSerialization dataWithJSONObject:value options:0 error:nil] encoding:NSUTF8StringEncoding];
}
- (void)scroll:(double)offset animated:(BOOL)animated {
    if(self.disposed || !isfinite(offset))return;
    UIEdgeInsets inset=self.list.adjustedContentInset;
    double maximum=MAX(0,self.list.contentSize.height+inset.top+inset.bottom-self.list.bounds.size.height);
    [self.list setContentOffset:CGPointMake(self.list.contentOffset.x,MIN(maximum,MAX(0,offset))-inset.top) animated:animated];
    if(!animated)[self update:YES];
}
- (void)changeRefreshState:(NSInteger)state {
    if(self.refreshState==state)return;
    self.refreshState=state;if(state==3)self.refreshRequests++;
    [self updateRefreshIndicator];self.callbacks++;if(self.onState)self.onState();
}
- (void)setRefreshing:(BOOL)value {
    if(self.disposed || (value && (!self.observing || !self.refreshEnabled)))return;
    self.pullEligible=NO;self.pull=0;[self changeRefreshState:value?3:0];
}
- (void)refreshPan:(UIPanGestureRecognizer *)pan {
    if(self.disposed || !self.observing || !self.refreshEnabled || self.refreshState==3)return;
    if(pan.state==UIGestureRecognizerStateBegan){
        self.pullEligible=self.offset<=.5;
    } else if(pan.state==UIGestureRecognizerStateEnded){
        BOOL trigger=self.pullEligible && self.pull>=self.refreshThreshold;
        self.pullEligible=NO;self.pull=0;[self changeRefreshState:0];
        if(trigger)[self setRefreshing:YES];
    } else if(pan.state==UIGestureRecognizerStateCancelled || pan.state==UIGestureRecognizerStateFailed){
        self.pullEligible=NO;self.pull=0;[self changeRefreshState:0];
    }
}
- (void)updateRefreshIndicator {
    if(!self.refreshIndicator)return;
    BOOL visible=self.observing && self.refreshState>0;
    self.refreshIndicator.hidden=!visible;
    if(!visible){[self.refreshRing removeAnimationForKey:@"refresh"];return;}
    UIView *host=self.list.superview;
    self.refreshIndicator.center=CGPointMake(CGRectGetMidX(self.list.frame),CGRectGetMinY(self.list.frame)+(self.refreshState==3?32:MIN(60,self.pull)*.6+16));
    [host bringSubviewToFront:self.refreshIndicator];
    [CATransaction begin];[CATransaction setDisableActions:YES];
    self.refreshRing.strokeEnd=self.refreshState==3?.75:MAX(.08,MIN(1,self.pull/self.refreshThreshold)*.92);
    [CATransaction commit];
    if(self.refreshState==3 && !self.reduced){
        if(![self.refreshRing animationForKey:@"refresh"]){
            CABasicAnimation *spin=[CABasicAnimation animationWithKeyPath:@"transform.rotation.z"];
            spin.fromValue=@0;spin.toValue=@(M_PI*2);spin.duration=.9;spin.repeatCount=HUGE_VALF;
            [self.refreshRing addAnimation:spin forKey:@"refresh"];
        }
    } else [self.refreshRing removeAnimationForKey:@"refresh"];
}
- (void)dispose {
    if(self.disposed)return;[self setRefreshing:NO];[self setEnabled:NO];self.disposed=YES;
    [self.refreshRing removeAllAnimations];[self.refreshIndicator removeFromSuperview];self.refreshIndicator=nil;self.refreshRing=nil;
    self.title.accessibilityElementsHidden=self.titleHidden;self.toolbarTitle.accessibilityElementsHidden=self.toolbarTitleHidden;self.toolbar.userInteractionEnabled=self.toolbarTouch;
    self.title.isAccessibilityElement=self.titleElement;self.toolbarTitle.isAccessibilityElement=self.toolbarTitleElement;self.toolbar.accessibilityElementsHidden=self.toolbarHidden;
    self.header.accessibilityElementsHidden=self.headerHidden;
    for(UITableViewCell *cell in self.coveredRows.keyEnumerator.allObjects){NSInteger saved=[[self.coveredRows objectForKey:cell] integerValue];cell.accessibilityElementsHidden=(saved&1)!=0;cell.isAccessibilityElement=(saved&2)!=0;}[self.coveredRows removeAllObjects];
    if(self.list.delegate==self.proxy)self.list.delegate=self.proxy.forwarded;
    if(self.list.estimatedSectionHeaderHeight==0)self.list.estimatedSectionHeaderHeight=self.estimatedSectionHeaderHeight;
    if(self.list.estimatedSectionFooterHeight==0)self.list.estimatedSectionFooterHeight=self.estimatedSectionFooterHeight;
    self.proxy=nil;self.node=nil;self.onState=nil;
}
@end
