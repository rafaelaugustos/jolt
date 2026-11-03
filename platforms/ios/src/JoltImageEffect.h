#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN
@class JoltLiveSpringBinding;
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
@property(nonatomic, readonly) NSArray<NSNumber *> *frameIntervalsMs;
@property(nonatomic, readonly) NSUInteger textureBytes;
@property(nonatomic, readonly) NSUInteger nativeParameterWrites, resizeCount, peakTextureBytes, videoFrames;
@property(nonatomic, readonly) double videoTime, renderCpuMs, renderGpuMs;
+ (NSUInteger)processMemoryBytes;
@property(nonatomic, readonly) NSString *videoStatus;
@property(nonatomic, readonly, nullable) UIImageView *targetView;
- (BOOL)resize;
- (void)configureMask:(NSString *)configuration;
- (void)setParameter:(NSString *)parameter value:(double)value;
- (void)releaseBinding:(JoltLiveSpringBinding *)binding;
- (void)retainBinding:(JoltLiveSpringBinding *)binding;
- (void)setSuspended:(BOOL)suspended;
- (BOOL)setVideo:(nullable NSString *)path loop:(BOOL)loop paused:(BOOL)paused;
- (void)pauseVideo;
- (void)playVideo;
- (void)play:(double)endpoint;
- (void)pause;
- (void)resume;
- (void)seek:(double)progress;
- (void)finish:(double)endpoint;
- (void)stop;
- (void)stopPreservingImage;
@end
@interface JoltImageScrollBinding : NSObject
+ (instancetype)attachEffect:(JoltImageEffect *)effect scroll:(UIScrollView *)scroll parameter:(NSString *)parameter configuration:(NSString *)configuration;
- (void)cancel;
@end
NS_ASSUME_NONNULL_END
