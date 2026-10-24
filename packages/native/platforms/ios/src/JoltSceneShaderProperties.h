#import "JoltPropertyPlayer.h"
NS_ASSUME_NONNULL_BEGIN
@interface JoltSceneShaderProperties : NSObject
+ (nullable JoltPropertySink *)environment:(NSObject *)scene error:(NSError * _Nullable * _Nullable)error;
+ (nullable JoltPropertySink *)uniform:(NSObject *)target name:(NSString *)name configuration:(NSString *)configuration error:(NSError * _Nullable * _Nullable)error;
+ (NSUInteger)sinkCount;
+ (NSUInteger)writeCount;
@end
NS_ASSUME_NONNULL_END
