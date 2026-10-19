#import "JoltImageEffect.h"
#import <MetalKit/MetalKit.h>
#import <simd/simd.h>

static const char *JoltImageShader = R"METAL(
#include <metal_stdlib>
using namespace metal;
struct Vertex {float4 position [[position]]; float2 uv;};
struct Params {float2 size; float2 origin; float2 displacement; float progress; float amplitude; float radius; float seed; float mode;};
vertex Vertex joltVertex(uint id [[vertex_id]]) {
    float2 p[4]={float2(-1,-1),float2(1,-1),float2(-1,1),float2(1,1)};
    float2 uv[4]={float2(0,1),float2(1,1),float2(0,0),float2(1,0)};
    return {float4(p[id],0,1),uv[id]};
}
fragment float4 joltImage(Vertex in [[stage_in]], constant Params &u [[buffer(0)]],
                         texture2d<float> source [[texture(0)]], texture2d<float> destination [[texture(1)]]) {
    constexpr sampler s(coord::normalized,address::clamp_to_edge,filter::linear);
    float2 p=in.uv*u.size,q=p;
    if(u.mode<1.5) {
        float2 v=p-u.origin; float d=length(v);
        float edge=clamp(min(min(p.x,u.size.x-p.x),min(p.y,u.size.y-p.y))/max(u.amplitude*2.,1.),0.,1.);
        if(u.mode<.5) {
            float wave=d-u.progress*length(u.size);
            float a=sin(wave/max(u.radius*.12,1.))*exp(-pow(wave/max(u.radius,1.),2.))*u.amplitude*sin(u.progress*3.14159265);
            q-=v/max(d,1.)*a*edge;
        } else q-=u.displacement*exp(-d*d/max(u.radius*u.radius,1.))*edge;
        return source.sample(s,q/u.size);
    }
    if(u.progress<=0.) return source.sample(s,in.uv);
    if(u.progress>=1.) return destination.sample(s,in.uv);
    float n=fract(sin(dot(floor(p/3.),float2(12.9898,78.233))+u.seed)*43758.5453);
    float a=smoothstep(n-.08,n+.08,u.progress*1.16-.08);
    return mix(source.sample(s,in.uv),destination.sample(s,in.uv),a);
}
)METAL";

typedef struct {
    vector_float2 size, origin, displacement;
    float progress, amplitude, radius, seed, mode;
} JoltImageParams;

@interface JoltImageEffect () <MTKViewDelegate, UIGestureRecognizerDelegate>
@property(nonatomic, weak) UIImageView *image;
@property(nonatomic, strong) UIImage *original;
@property(nonatomic, strong) MTKView *surface;
@property(nonatomic, strong) id<MTLCommandQueue> queue;
@property(nonatomic, strong) id<MTLRenderPipelineState> pipeline;
@property(nonatomic, strong) id<MTLTexture> sourceTexture, destinationTexture;
@property(nonatomic, strong) UIPanGestureRecognizer *pan;
@property(nonatomic, copy) void (^listener)(BOOL,double);
@property(nonatomic) BOOL originalInteraction, disposed, playing, settling;
@property(nonatomic, readwrite) BOOL paused;
@property(nonatomic, readwrite) double progress;
@property(nonatomic, readwrite) NSUInteger frames;
@property(nonatomic, readwrite) double longestFrame;
@property(nonatomic, readwrite) NSUInteger textureBytes;
@property(nonatomic) double duration, goal, anchor, startProgress, remaining, previousFrame;
@property(nonatomic) vector_float2 settleStart;
@property(nonatomic) JoltImageParams params;
@end

@implementation JoltImageEffect
+ (instancetype)createWithView:(UIImageView *)view destination:(UIImage *)destination mode:(NSInteger)mode
                       originX:(double)x originY:(double)y amplitude:(double)amplitude radius:(double)radius
                      duration:(double)duration seed:(double)seed listener:(void (^)(BOOL,double))listener {
    if(!view.image.CGImage || view.image.images.count || view.image.renderingMode==UIImageRenderingModeAlwaysTemplate || !view.window) return nil;
    CGFloat scale=view.window.screen.scale;
    NSUInteger w=(NSUInteger)ceil(view.bounds.size.width*scale),h=(NSUInteger)ceil(view.bounds.size.height*scale);
    if(!w || !h || w*h>4194304 || (mode==2 && !destination.CGImage)) return nil;
    id<MTLDevice> device=MTLCreateSystemDefaultDevice();
    if(!device) return nil;
    static id<MTLRenderPipelineState> cached;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        NSError *error=nil;
        id<MTLLibrary> library=[device newLibraryWithSource:[NSString stringWithUTF8String:JoltImageShader] options:nil error:&error];
        MTLRenderPipelineDescriptor *descriptor=[MTLRenderPipelineDescriptor new];
        descriptor.vertexFunction=[library newFunctionWithName:@"joltVertex"];
        descriptor.fragmentFunction=[library newFunctionWithName:@"joltImage"];
        descriptor.colorAttachments[0].pixelFormat=MTLPixelFormatBGRA8Unorm;
        if(library) cached=[device newRenderPipelineStateWithDescriptor:descriptor error:&error];
        if(error) NSLog(@"Jolt image shader unavailable: %@",error.localizedDescription);
    });
    if(!cached) return nil;
    JoltImageEffect *effect=[JoltImageEffect new];
    effect.image=view; effect.original=view.image; effect.originalInteraction=view.userInteractionEnabled;
    effect.listener=listener; effect.pipeline=cached; effect.queue=[device newCommandQueue];
    effect.duration=duration/1000.; effect.goal=1; effect.paused=YES;
    effect.params=(JoltImageParams){ {(float)w,(float)h}, {(float)(x*scale),(float)(y*scale)}, {0,0}, 0,
        (float)(amplitude*scale),(float)(radius*scale),(float)seed,(float)mode };
    effect.sourceTexture=[effect texture:view.image device:device width:w height:h];
    effect.destinationTexture=mode==2?[effect texture:destination device:device width:w height:h]:effect.sourceTexture;
    if(!effect.sourceTexture || !effect.destinationTexture) return nil;
    effect.textureBytes=w*h*4*(mode==2?2:1);
    MTKView *surface=[[MTKView alloc] initWithFrame:view.bounds device:device];
    surface.opaque=NO; surface.backgroundColor=UIColor.clearColor;
    surface.clearColor=MTLClearColorMake(0,0,0,0);
    surface.userInteractionEnabled=NO; surface.accessibilityElementsHidden=YES;
    surface.colorPixelFormat=MTLPixelFormatBGRA8Unorm;
    surface.autoResizeDrawable=NO; surface.drawableSize=CGSizeMake(w,h);
    surface.preferredFramesPerSecond=MIN(120,view.window.screen.maximumFramesPerSecond);
    surface.paused=YES; surface.enableSetNeedsDisplay=YES;
    surface.delegate=effect; effect.surface=surface;
    [view addSubview:surface];
    // Draw the identity frame before suppressing the original raster.
    [surface draw]; view.image=nil;
    if(mode==1) {
        effect.pan=[[UIPanGestureRecognizer alloc] initWithTarget:effect action:@selector(drag:)];
        effect.pan.delegate=effect; effect.pan.cancelsTouchesInView=NO;
        view.userInteractionEnabled=YES; [view addGestureRecognizer:effect.pan];
    }
    return effect;
}
- (id<MTLTexture>)texture:(UIImage *)image device:(id<MTLDevice>)device width:(NSUInteger)w height:(NSUInteger)h {
    if(!image.CGImage) return nil;
    NSMutableData *data=[NSMutableData dataWithLength:w*h*4];
    CGColorSpaceRef space=CGColorSpaceCreateDeviceRGB();
    CGContextRef context=CGBitmapContextCreate(data.mutableBytes,w,h,8,w*4,space,kCGImageAlphaPremultipliedLast|kCGBitmapByteOrder32Big);
    CGColorSpaceRelease(space);
    if(!context) return nil;
    CGContextTranslateCTM(context,0,h); CGContextScaleCTM(context,1,-1);
    CGFloat iw=image.size.width,ih=image.size.height;
    UIViewContentMode mode=self.image.contentMode;
    CGFloat factor=mode==UIViewContentModeScaleAspectFill?MAX(w/iw,h/ih):MIN(w/iw,h/ih);
    BOOL unscaled=mode==UIViewContentModeCenter || mode==UIViewContentModeTopLeft;
    CGFloat dw=mode==UIViewContentModeScaleToFill?w:unscaled?iw*self.image.window.screen.scale:iw*factor;
    CGFloat dh=mode==UIViewContentModeScaleToFill?h:unscaled?ih*self.image.window.screen.scale:ih*factor;
    CGFloat left=mode==UIViewContentModeTopLeft?0:(w-dw)/2,top=mode==UIViewContentModeTopLeft?0:(h-dh)/2;
    UIGraphicsPushContext(context); [image drawInRect:CGRectMake(left,top,dw,dh)]; UIGraphicsPopContext();
    CGContextRelease(context);
    MTLTextureDescriptor *descriptor=[MTLTextureDescriptor texture2DDescriptorWithPixelFormat:MTLPixelFormatRGBA8Unorm width:w height:h mipmapped:NO];
    descriptor.usage=MTLTextureUsageShaderRead;
    id<MTLTexture> texture=[device newTextureWithDescriptor:descriptor];
    [texture replaceRegion:MTLRegionMake2D(0,0,w,h) mipmapLevel:0 withBytes:data.bytes bytesPerRow:w*4];
    return texture;
}
- (void)play:(double)endpoint {
    if(self.disposed || self.params.mode==1) return;
    self.goal=endpoint; self.startProgress=self.progress; self.remaining=MAX(.001,self.duration*fabs(endpoint-self.progress));
    self.anchor=CACurrentMediaTime(); self.playing=YES; self.settling=NO; self.paused=NO;
    self.previousFrame=0; self.surface.enableSetNeedsDisplay=NO; self.surface.paused=NO;
}
- (void)pause {
    if(self.disposed) return;
    [self advance:CACurrentMediaTime()]; self.paused=YES;
    self.surface.paused=YES; self.surface.enableSetNeedsDisplay=YES;
}
- (void)resume {
    if(self.disposed || !self.paused) return;
    if(self.params.mode==1) {
        self.paused=NO;
        if(self.settling && self.playing) {
            self.settleStart=self.params.displacement;self.anchor=CACurrentMediaTime();
            self.remaining=MIN(.6,self.duration);self.previousFrame=0;
            self.surface.enableSetNeedsDisplay=NO;self.surface.paused=NO;
        }
        return;
    }
    [self play:self.goal];
}
- (void)seek:(double)value {
    if(self.disposed || self.params.mode==1) return;
    BOOL hold=self.paused; self.progress=value;
    JoltImageParams p=self.params;p.progress=value;self.params=p;
    [self.surface draw];
    if(!hold) [self play:self.goal];
}
- (void)finish:(double)endpoint {
    if(self.disposed || self.params.mode==1) return;
    self.progress=endpoint; self.playing=NO;
    self.surface.paused=YES;
    if(self.listener) self.listener(YES,endpoint);
}
- (void)stop {
    [self detach:YES];
}
- (void)stopPreservingImage {
    [self detach:NO];
}
- (void)detach:(BOOL)restoreImage {
    if(self.disposed) return;
    self.disposed=YES; self.surface.paused=YES; self.surface.delegate=nil;
    [self.surface removeFromSuperview]; self.surface=nil;
    if(self.pan) { [self.image removeGestureRecognizer:self.pan];self.image.userInteractionEnabled=self.originalInteraction;self.pan=nil; }
    if(restoreImage && !self.image.image) self.image.image=self.original;
    self.sourceTexture=nil;self.destinationTexture=nil;self.original=nil;self.queue=nil;
    self.textureBytes=0; self.listener=nil;
}
- (void)advance:(double)now {
    if(!self.playing || self.paused || self.disposed) return;
    double t=MIN(1,MAX(0,(now-self.anchor)/self.remaining));
    JoltImageParams p=self.params;
    if(self.settling) p.displacement=self.settleStart*(float)(exp(-8*t)*(1-t));
    else {self.progress=self.startProgress+(self.goal-self.startProgress)*t;p.progress=self.progress;}
    self.params=p;
    if(t>=1) {
        self.playing=NO;self.surface.paused=YES;self.surface.enableSetNeedsDisplay=YES;
        if(!self.settling && self.listener) self.listener(YES,self.progress);
    }
}
- (void)drawInMTKView:(MTKView *)view {
    if(self.disposed) return;
    double now=CACurrentMediaTime();
    if(self.previousFrame>0 && self.playing) self.longestFrame=MAX(self.longestFrame,now-self.previousFrame);
    self.previousFrame=now;self.frames++;
    [self advance:now];
    if(self.disposed) return;
    MTLRenderPassDescriptor *pass=view.currentRenderPassDescriptor;
    id<CAMetalDrawable> drawable=view.currentDrawable;
    if(!pass || !drawable) return;
    id<MTLCommandBuffer> command=[self.queue commandBuffer];
    id<MTLRenderCommandEncoder> encoder=[command renderCommandEncoderWithDescriptor:pass];
    [encoder setRenderPipelineState:self.pipeline];
    JoltImageParams params=self.params;
    [encoder setFragmentBytes:&params length:sizeof(params) atIndex:0];
    [encoder setFragmentTexture:self.sourceTexture atIndex:0];
    [encoder setFragmentTexture:self.destinationTexture atIndex:1];
    [encoder drawPrimitives:MTLPrimitiveTypeTriangleStrip vertexStart:0 vertexCount:4];
    [encoder endEncoding]; [command presentDrawable:drawable]; [command commit];
}
- (void)mtkView:(MTKView *)view drawableSizeWillChange:(CGSize)size {}
- (void)drag:(UIPanGestureRecognizer *)gesture {
    if(self.disposed || self.paused) return;
    CGFloat scale=self.image.window.screen.scale;
    JoltImageParams p=self.params;
    if(gesture.state==UIGestureRecognizerStateBegan) {
        self.playing=NO;self.surface.paused=YES;self.surface.enableSetNeedsDisplay=YES;
        CGPoint position=[gesture locationInView:self.image],translation=[gesture translationInView:self.image];
        p.origin=(vector_float2){(float)((position.x-translation.x)*scale),(float)((position.y-translation.y)*scale)};
    }
    if(gesture.state==UIGestureRecognizerStateBegan || gesture.state==UIGestureRecognizerStateChanged) {
        CGPoint delta=[gesture translationInView:self.image];
        double length=hypot(delta.x,delta.y)*scale;
        double factor=length==0?0:p.amplitude*tanh(length/MAX(p.amplitude,1))/length;
        p.displacement=(vector_float2){(float)(delta.x*scale*factor),(float)(delta.y*scale*factor)};
        self.params=p;[self.surface draw];
    } else if(gesture.state==UIGestureRecognizerStateEnded || gesture.state==UIGestureRecognizerStateCancelled || gesture.state==UIGestureRecognizerStateFailed) {
        self.settleStart=p.displacement;self.anchor=CACurrentMediaTime();self.remaining=MIN(.6,self.duration);
        self.playing=YES;self.settling=YES;self.surface.enableSetNeedsDisplay=NO;self.surface.paused=NO;
    }
}
@end
