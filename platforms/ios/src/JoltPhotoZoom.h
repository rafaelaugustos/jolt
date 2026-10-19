#import <UIKit/UIKit.h>
NS_ASSUME_NONNULL_BEGIN
@interface JoltPhotoZoom : NSObject
+ (instancetype)attachImage:(UIImageView *)image viewport:(UIView *)viewport
                    minimum:(double)minimum maximum:(double)maximum doubleTap:(double)doubleTap
                    dismiss:(BOOL)dismiss reduced:(BOOL)reduced
                   backdrop:(nullable UIView *)backdrop chrome:(nullable UIView *)chrome
                  onDismiss:(void (^)(double,double,double,double,double))onDismiss
                  onSettled:(void (^)(double,double,double))onSettled;
@property(nonatomic, readonly) double x;
@property(nonatomic, readonly) double y;
@property(nonatomic, readonly) double scale;
@property(nonatomic, readonly) double dismissProgress;
@property(nonatomic, readonly) BOOL dismissPending;
- (void)zoom:(double)scale focusX:(double)x focusY:(double)y animated:(BOOL)animated;
- (void)reset:(BOOL)animated;
- (void)requestDismiss;
- (void)setReduced:(BOOL)reduced;
- (void)setActive:(BOOL)active;
- (void)layout;
- (void)stop;
@end
NS_ASSUME_NONNULL_END
