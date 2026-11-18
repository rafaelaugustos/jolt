#import "JoltGestureLink.h"
#import <objc/runtime.h>

@class JoltGestureDelegate;
@interface JoltGestureLink ()
@property(nonatomic, weak) UIGestureRecognizer *first, *second;
@property(nonatomic, copy) NSString *relation;
@property(nonatomic) BOOL disposed;
@end
@interface JoltGestureDelegate : NSObject <UIGestureRecognizerDelegate>
@property(nonatomic, weak) id<UIGestureRecognizerDelegate> previous;
@property(nonatomic, weak) UIGestureRecognizer *recognizer;
@property(nonatomic) NSMutableArray<JoltGestureLink *> *links;
@end
static char JoltGestureDelegateKey;
static JoltGestureDelegate *delegateFor(UIGestureRecognizer *recognizer) {
    JoltGestureDelegate *delegate = objc_getAssociatedObject(recognizer, &JoltGestureDelegateKey);
    if (!delegate) {
        delegate = [JoltGestureDelegate new]; delegate.previous = recognizer.delegate;
        delegate.recognizer = recognizer; delegate.links = [NSMutableArray new];
        objc_setAssociatedObject(recognizer, &JoltGestureDelegateKey, delegate, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
        recognizer.delegate = delegate;
        [recognizer addTarget:delegate action:@selector(changed:)];
    }
    return delegate;
}
static BOOL recognizing(UIGestureRecognizer *recognizer) {
    return recognizer && (recognizer.state == UIGestureRecognizerStateBegan || recognizer.state == UIGestureRecognizerStateChanged || recognizer.state == UIGestureRecognizerStateRecognized);
}
static void cancelRecognizer(UIGestureRecognizer *recognizer) {
    if (recognizer.enabled && (recognizer.numberOfTouches || recognizing(recognizer))) {
        recognizer.enabled = NO; recognizer.enabled = YES;
    }
}
@implementation JoltGestureDelegate
- (BOOL)respondsToSelector:(SEL)selector { return [super respondsToSelector:selector] || [self.previous respondsToSelector:selector]; }
- (id)forwardingTargetForSelector:(SEL)selector { return [self.previous respondsToSelector:selector] ? self.previous : [super forwardingTargetForSelector:selector]; }
- (BOOL)gestureRecognizerShouldBegin:(UIGestureRecognizer *)recognizer {
    for (JoltGestureLink *link in self.links.copy)
        if (!link.disposed && link.second == recognizer && [link.relation isEqual:@"block"] && recognizing(link.first)) return NO;
    return ![self.previous respondsToSelector:_cmd] || [self.previous gestureRecognizerShouldBegin:recognizer];
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)first shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)second {
    for (JoltGestureLink *link in self.links.copy) if (!link.disposed &&
        ((link.first == first && link.second == second) || (link.second == first && link.first == second)))
        return ![link.relation isEqual:@"waitFor"];
    return [self.previous respondsToSelector:_cmd] && [self.previous gestureRecognizer:first shouldRecognizeSimultaneouslyWithGestureRecognizer:second];
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)first shouldRequireFailureOfGestureRecognizer:(UIGestureRecognizer *)second {
    for (JoltGestureLink *link in self.links.copy) if (!link.disposed && link.first == first && link.second == second && [link.relation isEqual:@"waitFor"]) return YES;
    return [self.previous respondsToSelector:_cmd] && [self.previous gestureRecognizer:first shouldRequireFailureOfGestureRecognizer:second];
}
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)first shouldBeRequiredToFailByGestureRecognizer:(UIGestureRecognizer *)second {
    for (JoltGestureLink *link in self.links.copy) if (!link.disposed && link.second == first && link.first == second && [link.relation isEqual:@"waitFor"]) return YES;
    return [self.previous respondsToSelector:_cmd] && [self.previous gestureRecognizer:first shouldBeRequiredToFailByGestureRecognizer:second];
}
- (void)changed:(UIGestureRecognizer *)recognizer {
    if (!recognizing(recognizer)) return;
    for (JoltGestureLink *link in self.links.copy)
        if (!link.disposed && link.first == recognizer && [link.relation isEqual:@"block"]) cancelRecognizer(link.second);
}
@end
@implementation JoltGestureLink
+ (instancetype)connect:(UIGestureRecognizer *)first other:(UIGestureRecognizer *)second relation:(NSString *)relation {
    if (!first || !second || first == second || ![@[@"simultaneous", @"waitFor", @"block"] containsObject:relation])
        [NSException raise:NSInvalidArgumentException format:@"Invalid gesture relationship"];
    JoltGestureLink *link = [self new]; link.first = first; link.second = second; link.relation = relation;
    [delegateFor(first).links addObject:link]; [delegateFor(second).links addObject:link];
    return link;
}
+ (void)detach:(UIGestureRecognizer *)recognizer {
    JoltGestureDelegate *delegate = objc_getAssociatedObject(recognizer, &JoltGestureDelegateKey);
    for (JoltGestureLink *link in delegate.links.copy) [link dispose];
}
- (void)dispose {
    if (self.disposed) return; self.disposed = YES;
    NSArray *recognizers = self.first ? (self.second ? @[self.first, self.second] : @[self.first]) : (self.second ? @[self.second] : @[]);
    for (UIGestureRecognizer *recognizer in recognizers) {
        cancelRecognizer(recognizer);
        JoltGestureDelegate *delegate = objc_getAssociatedObject(recognizer, &JoltGestureDelegateKey);
        [delegate.links removeObject:self];
        if (!delegate.links.count) {
            if (recognizer.delegate == delegate) recognizer.delegate = delegate.previous;
            [recognizer removeTarget:delegate action:@selector(changed:)];
            objc_setAssociatedObject(recognizer, &JoltGestureDelegateKey, nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
        }
    }
    self.first = nil; self.second = nil;
}
@end
