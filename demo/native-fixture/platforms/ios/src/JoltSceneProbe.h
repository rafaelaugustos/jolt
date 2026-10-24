#import <UIKit/UIKit.h>
@interface JoltSceneProbe : NSObject
+ (BOOL)weakTargetReleased;
+ (BOOL)weakCameraReleased;
+ (double)meanLuminance:(NSObject *)view;
+ (NSObject *)customProgramMaterial;
+ (BOOL)beginWeakShaderTargets;
+ (BOOL)finishWeakShaderTargets;
@end
