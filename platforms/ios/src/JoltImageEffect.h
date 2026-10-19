#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN
@interface JoltImageEffect : NSObject
+ (nullable instancetype)createWithView:(UIImageView *)view
                          destination:(nullable UIImage *)destination
                                 mode:(NSInteger)mode
                              originX:(double)x originY:(double)y
                            amplitude:(double)amplitude radius:(double)radius
                             duration:(double)duration seed:(double)seed
                             listener:(void (^)(BOOL, double))listener;
@property(nonatomic, readonly) double progress;
@property(nonatomic, readonly) BOOL paused;
@property(nonatomic, readonly) NSUInteger frames;
@property(nonatomic, readonly) double longestFrame;
@property(nonatomic, readonly) NSUInteger textureBytes;
- (void)play:(double)endpoint;
- (void)pause;
- (void)resume;
- (void)seek:(double)progress;
- (void)finish:(double)endpoint;
- (void)stop;
- (void)stopPreservingImage;
@end
NS_ASSUME_NONNULL_END
