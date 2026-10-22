#import <Foundation/Foundation.h>
NS_ASSUME_NONNULL_BEGIN

/** Subclass in compiled Objective-C/Swift. Targets are weak; writes run on the main thread. */
@interface JoltPropertySink : NSObject
- (instancetype)initWithTarget:(NSObject *)target dimensions:(NSUInteger)dimensions;
+ (instancetype)scalarTarget:(NSObject *)target keyPath:(NSString *)keyPath;
@property(nonatomic, weak, readonly, nullable) NSObject *target;
@property(nonatomic, readonly) NSUInteger dimensions;
@property(nonatomic, readonly) BOOL alive;
@property(nonatomic, readonly) BOOL compiled;
- (NSArray<NSNumber *> *)read;
- (void)write:(NSArray<NSNumber *> *)values;
- (void)dispose;
@end

@interface JoltPropertyPlayer : NSObject
+ (instancetype)startSink:(JoltPropertySink *)sink times:(NSArray<NSNumber *> *)times
                   values:(NSArray<NSNumber *> *)values finalValue:(NSArray<NSNumber *> *)finalValue
                 duration:(double)duration delay:(double)delay repeat:(double)repeat reverse:(BOOL)reverse
               completion:(void (^)(BOOL))completion;
@property(nonatomic, readonly) double elapsed;
@property(nonatomic, readonly) NSUInteger frames;
+ (NSUInteger)activeCount;
- (void)control:(double)elapsed paused:(BOOL)paused;
- (void)cancel;
@end
NS_ASSUME_NONNULL_END
