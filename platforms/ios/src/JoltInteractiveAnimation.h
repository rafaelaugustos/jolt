#import <UIKit/UIKit.h>
NS_ASSUME_NONNULL_BEGIN

/** Native sampled playback for opt-in interactive views. No UIKit method replacement. */
@interface JoltInteractiveAnimation : NSObject
+ (instancetype)startView:(UIView *)view layers:(NSArray<CALayer *> *)layers keyPath:(NSString *)keyPath
                  values:(NSArray<NSNumber *> *)values times:(NSArray<NSNumber *> *)times
                duration:(double)duration delay:(double)delay repeat:(double)repeat
                 reverse:(BOOL)reverse finalValue:(double)finalValue
               startedAt:(double)startedAt completion:(void (^)(BOOL))completion;
+ (void)syncView:(UIView *)view excluding:(nullable NSString *)keyPath;
+ (nullable NSNumber *)valueForView:(UIView *)view keyPath:(NSString *)keyPath;
+ (NSUInteger)activeCount;
@property(nonatomic, readonly) double elapsed;
- (void)control:(double)elapsed paused:(BOOL)paused;
- (void)cancel;
@end
NS_ASSUME_NONNULL_END
