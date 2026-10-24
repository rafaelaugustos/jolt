#import "JoltSceneProbe.h"
#import <SceneKit/SceneKit.h>
@protocol JoltProbeSink
@property(nonatomic, readonly) BOOL alive;
- (void)dispose;
@end
@protocol JoltProbeFactory
+ (id<JoltProbeSink>)sceneLightIntensity:(NSObject *)light;
+ (id<JoltProbeSink>)sceneFieldOfView:(NSObject *)camera;
+ (id<JoltProbeSink>)environment:(NSObject *)scene error:(NSError **)error;
+ (id<JoltProbeSink>)uniform:(NSObject *)target name:(NSString *)name configuration:(NSString *)configuration error:(NSError **)error;
@end
static id<JoltProbeSink> weakEnvironment, weakUniform;
@implementation JoltSceneProbe
+ (NSObject *)customProgramMaterial {
    SCNMaterial *material = [SCNMaterial material];
    SCNProgram *program = [SCNProgram program];
    program.vertexFunctionName = @"shaderVertex";
    program.fragmentFunctionName = @"shaderFragment";
    material.program = program;
    return material;
}
+ (BOOL)beginWeakShaderTargets {
    @autoreleasepool {
        SCNScene *scene = [SCNScene scene];
        SCNMaterial *material = [SCNMaterial material];
        material.shaderModifiers = @{SCNShaderModifierEntryPointFragment: @"#pragma arguments\nfloat amount;\n#pragma body\n_output.color.r=amount;"};
        [material setValue:@0 forKey:@"amount"];
        Class<JoltProbeFactory> factory = (id)NSClassFromString(@"JoltSceneShaderProperties");
        weakEnvironment = [factory environment:scene error:NULL];
        weakUniform = [factory uniform:material name:@"amount" configuration:@"{\"type\":\"float\",\"low\":0,\"high\":1}" error:NULL];
        if (!weakEnvironment.alive || !weakUniform.alive) return NO;
        [SCNTransaction flush];
    }
    return YES;
}
+ (BOOL)finishWeakShaderTargets {
    BOOL released = !weakEnvironment.alive && !weakUniform.alive;
    [weakEnvironment dispose]; [weakUniform dispose];
    weakEnvironment = nil; weakUniform = nil;
    return released;
}

+ (double)meanLuminance:(NSObject *)view {
    CGImageRef image = [(SCNView *)view snapshot].CGImage;
    unsigned char pixels[32 * 32 * 4] = {0};
    CGColorSpaceRef color = CGColorSpaceCreateDeviceRGB();
    CGContextRef context = CGBitmapContextCreate(pixels,32,32,8,32*4,color,kCGImageAlphaPremultipliedLast);
    CGContextDrawImage(context,CGRectMake(0,0,32,32),image);
    double total=0;
    for(int i=0;i<32*32;i++) total+=pixels[i*4]*.2126+pixels[i*4+1]*.7152+pixels[i*4+2]*.0722;
    CGContextRelease(context); CGColorSpaceRelease(color);
    return total/(32*32*255);
}

+ (BOOL)weakCameraReleased {
    id<JoltProbeSink> sink;
    @autoreleasepool {
        SCNCamera *camera = [SCNCamera camera];
        sink = [(Class<JoltProbeFactory>)NSClassFromString(@"JoltReferenceProperties") sceneFieldOfView:camera];
        if (!sink.alive) return NO;
    }
    BOOL released = !sink.alive;
    [sink dispose];
    return released;
}
+ (BOOL)weakTargetReleased {
    id<JoltProbeSink> sink;
    @autoreleasepool {
        SCNLight *light = [SCNLight light];
        sink = [(Class<JoltProbeFactory>)NSClassFromString(@"JoltReferenceProperties") sceneLightIntensity:light];
        if (!sink.alive) return NO;
    }
    BOOL released = !sink.alive;
    [sink dispose];
    return released;
}
@end
