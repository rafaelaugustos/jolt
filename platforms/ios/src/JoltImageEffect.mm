#import "JoltImageEffect.h"
#import <MetalKit/MetalKit.h>
#import <simd/simd.h>
#import <AVFoundation/AVFoundation.h>
#import "JoltLiveSpring.h"
#import <mach/mach.h>

static const char *JoltImageShader = R"METAL(
#include <metal_stdlib>
using namespace metal;
struct Vertex {float4 position [[position]]; float2 uv;};
struct Params {float2 size; float2 origin; float2 displacement; float progress; float amplitude; float radius; float seed; float mode; float blend; float count; float video; float4 videoRect; float4 videoTransform;};
vertex Vertex joltVertex(uint id [[vertex_id]]) {
    float2 p[4]={float2(-1,-1),float2(1,-1),float2(-1,1),float2(1,1)};
    float2 uv[4]={float2(0,1),float2(1,1),float2(0,0),float2(1,0)};
    return {float4(p[id],0,1),uv[id]};
}
float4 imageSample(texture2d<float> tex, float2 uv, constant Params &u) {
    constexpr sampler s(coord::normalized,address::clamp_to_edge,filter::linear);
    if(u.video>.5) {
        uv=(uv-u.videoRect.xy)/u.videoRect.zw;
        if(any(uv<0.) || any(uv>1.))return float4(0);
        float2 v=uv-.5;
        uv=float2(u.videoTransform.x*v.x+u.videoTransform.z*v.y,u.videoTransform.y*v.x+u.videoTransform.w*v.y)+.5;
    }
    return tex.sample(s,uv);
}
float shapeDistance(float2 p,float4 shape,float radius,float kind,float2 size) {
    float2 halfSize=kind>.5?float2(radius*min(size.x,size.y)):shape.zw*size*.5;
    float r=kind>.5?halfSize.x:min(radius*min(size.x,size.y),min(halfSize.x,halfSize.y));
    float2 q=abs(p-shape.xy*size)-halfSize+r;
    return length(max(q,0.))+min(max(q.x,q.y),0.)-r;
}
fragment float4 joltImage(Vertex in [[stage_in]], constant Params &u [[buffer(0)]],
                         texture2d<float> source [[texture(0)]], texture2d<float> destination [[texture(1)]], constant float4 *shapes [[buffer(1)]]) {
    constexpr sampler s(coord::normalized,address::clamp_to_edge,filter::linear);
    float2 p=in.uv*u.size,q=p;
    if(u.mode>2.5) {
        float d=1e9;
        for(int i=0;i<int(u.count);i++) {
            float4 shape=mix(shapes[i*3],shapes[i*3+1],u.progress), meta=shapes[i*3+2];
            float next=shapeDistance(p,shape,mix(meta.x,meta.y,u.progress),meta.z,u.size);
            float h=u.blend>0.?max(u.blend-abs(d-next),0.)/u.blend:0.;
            d=min(d,next)-h*h*u.blend*.25;
        }
        return imageSample(source,in.uv,u)*(1.-smoothstep(-.75,.75,d));
    }
    if(u.mode<1.5) {
        float2 v=p-u.origin; float d=length(v);
        float edge=clamp(min(min(p.x,u.size.x-p.x),min(p.y,u.size.y-p.y))/max(u.amplitude*2.,1.),0.,1.);
        if(u.mode<.5) {
            float wave=d-u.progress*length(u.size);
            float a=sin(wave/max(u.radius*.12,1.))*exp(-pow(wave/max(u.radius,1.),2.))*u.amplitude*sin(u.progress*3.14159265);
            q-=v/max(d,1.)*a*edge;
        } else q-=u.displacement*exp(-d*d/max(u.radius*u.radius,1.))*edge;
        return imageSample(source,q/u.size,u);
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
    float progress, amplitude, radius, seed, mode, blend, count, video;
    vector_float4 videoRect, videoTransform;
} JoltImageParams;

@interface JoltImageEffect () <MTKViewDelegate, UIGestureRecognizerDelegate> {
    double _frameIntervals[512];
    vector_float4 _maskShapes[24];
    CVMetalTextureCacheRef _videoCache;
    CVMetalTextureRef _videoTexture;
    dispatch_semaphore_t _inflight;
    NSUInteger _frameIntervalCount, _frameIntervalCursor;
}
@property(nonatomic, weak) UIImageView *image;
@property(nonatomic, strong) UIImage *original, *destinationImage;
@property(nonatomic) NSMutableArray<JoltLiveSpringBinding *> *inputBindings;
@property(nonatomic) NSMutableArray<JoltImageScrollBinding *> *scrollBindings;
@property(nonatomic) AVPlayer *player;
@property(nonatomic) AVPlayerItemVideoOutput *videoOutput;
@property(nonatomic) id videoEndObserver;
@property(nonatomic) BOOL videoPaused, suspended, looping, videoGeometryRead, videoHasFrame;
@property(nonatomic) NSString *videoError;
@property(nonatomic) CGAffineTransform videoTransform;
@property(nonatomic, readwrite) NSUInteger nativeParameterWrites, resizeCount, peakTextureBytes, videoFrames;
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
@property(nonatomic, readwrite) double longestFrame, renderCpuMs, renderGpuMs;
@property(nonatomic, readwrite) NSUInteger textureBytes;
@property(nonatomic) double duration, goal, anchor, startProgress, remaining, previousFrame;
@property(nonatomic) vector_float2 settleStart;
@property(nonatomic) JoltImageParams params;
@end

@implementation JoltImageEffect
+ (NSUInteger)processMemoryBytes {
    task_vm_info_data_t info={};mach_msg_type_number_t count=TASK_VM_INFO_COUNT;
    return task_info(mach_task_self(),TASK_VM_INFO,(task_info_t)&info,&count)==KERN_SUCCESS?info.phys_footprint:0;
}
- (NSArray<NSNumber *> *)frameIntervalsMs {
    NSMutableArray<NSNumber *> *result=[NSMutableArray arrayWithCapacity:_frameIntervalCount];
    NSUInteger start=(_frameIntervalCursor+512-_frameIntervalCount)%512;
    for(NSUInteger i=0;i<_frameIntervalCount;i++) [result addObject:@(_frameIntervals[(start+i)%512]*1000)];
    return result;
}
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
    effect.image=view; effect.original=view.image; effect.destinationImage=destination;
    effect.inputBindings=[NSMutableArray new]; effect.scrollBindings=[NSMutableArray new]; effect->_inflight=dispatch_semaphore_create(3); effect.originalInteraction=view.userInteractionEnabled;
    effect.listener=listener; effect.pipeline=cached; effect.queue=[device newCommandQueue];
    effect.duration=duration/1000.; effect.goal=1; effect.paused=YES;
    effect.params=(JoltImageParams){ {(float)w,(float)h}, {(float)(x*scale),(float)(y*scale)}, {0,0}, 0,
        (float)(amplitude*scale),(float)(radius*scale),(float)seed,(float)mode };
    effect.sourceTexture=[effect texture:view.image device:device width:w height:h];
    effect.destinationTexture=mode==2?[effect texture:destination device:device width:w height:h]:effect.sourceTexture;
    if(!effect.sourceTexture || !effect.destinationTexture) return nil;
    effect.textureBytes=w*h*4*(mode==2?2:1); effect.peakTextureBytes=effect.textureBytes;
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

- (UIImageView *)targetView { return self.disposed?nil:self.image; }
- (void)releaseBinding:(JoltLiveSpringBinding *)binding { [self.inputBindings removeObject:binding]; }
- (void)retainBinding:(JoltLiveSpringBinding *)binding { [self.inputBindings addObject:binding]; }
- (void)updateClock {
    BOOL active=!self.suspended && ((!self.paused && self.playing) || (self.player && !self.videoPaused && !self.videoError));
    self.surface.enableSetNeedsDisplay=!active; self.surface.paused=!active;
}
- (void)setSuspended:(BOOL)value {
    _suspended=value;self.previousFrame=0;
    if(value)[self.player pause]; else if(!self.videoPaused)[self.player play];
    [self updateClock];
}
- (BOOL)resize {
    if(self.disposed) return NO;
    UIImageView *view=self.image;
    CGFloat scale=view.window.screen.scale ?: UIScreen.mainScreen.scale;
    NSUInteger w=ceil(view.bounds.size.width*scale),h=ceil(view.bounds.size.height*scale);
    if(!w || !h || w*h>4194304) return NO;
    id<MTLTexture> source=self.player?self.sourceTexture:[self texture:self.original device:self.surface.device width:w height:h];
    id<MTLTexture> destination=self.params.mode==2?[self texture:self.destinationImage device:self.surface.device width:w height:h]:source;
    if(!source || !destination)return NO;
    // Commit only after both textures are ready; no intermediate blank frame.
    self.peakTextureBytes=MAX(self.peakTextureBytes,self.textureBytes+w*h*4*(self.params.mode==2?2:1));
    self.sourceTexture=source;self.destinationTexture=destination;
    JoltImageParams p=self.params;p.size=(vector_float2){(float)w,(float)h};self.params=p;
    self.surface.frame=view.bounds;self.surface.drawableSize=CGSizeMake(w,h);
    self.textureBytes=(source.width*source.height+(source==destination?0:destination.width*destination.height))*4;
    self.resizeCount++; [self updateVideoGeometry]; [self.surface draw]; return YES;
}
- (void)configureMask:(NSString *)configuration {
    NSDictionary *config=[NSJSONSerialization JSONObjectWithData:[configuration dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    NSArray *shapes=config[@"shapes"];
    if(![shapes isKindOfClass:NSArray.class] || !shapes.count || shapes.count>8)return;
    memset(_maskShapes,0,sizeof(_maskShapes));
    for(NSUInteger i=0;i<shapes.count;i++) {
        NSDictionary *shape=shapes[i],*a=shape[@"from"],*b=shape[@"to"];
        _maskShapes[i*3]=(vector_float4){[a[@"x"] floatValue],[a[@"y"] floatValue],[a[@"width"] floatValue],[a[@"height"] floatValue]};
        _maskShapes[i*3+1]=(vector_float4){[b[@"x"] floatValue],[b[@"y"] floatValue],[b[@"width"] floatValue],[b[@"height"] floatValue]};
        _maskShapes[i*3+2]=(vector_float4){[a[@"radius"] floatValue],[b[@"radius"] floatValue],[shape[@"kind"] isEqual:@"circle"]?1.f:0.f,0};
    }
    JoltImageParams p=self.params;p.count=shapes.count;p.blend=[config[@"blend"] ?: @16 floatValue]*self.image.window.screen.scale;self.params=p;
    [self.surface draw];
}
- (void)setParameter:(NSString *)parameter value:(double)value {
    if(self.disposed || self.suspended || !isfinite(value))return;
    JoltImageParams p=self.params; CGFloat scale=self.image.window.screen.scale ?: UIScreen.mainScreen.scale;
    if([parameter isEqual:@"progress"]) { if(p.mode==1)return;value=MAX(0,MIN(1,value));self.playing=NO;[self updateClock];if(p.progress==value)return;self.progress=value;p.progress=value; }
    else if([parameter isEqual:@"amplitude"]) {float next=MAX(0,MIN(64,value))*scale;if(p.amplitude==next)return;p.amplitude=next;}
    else if([parameter isEqual:@"radius"]) {float next=MAX(.001,value)*scale;if(p.radius==next)return;p.radius=next;}
    else if([parameter isEqual:@"originX"]) {float next=value*scale;if(p.origin.x==next)return;p.origin.x=next;}
    else if([parameter isEqual:@"originY"]) {float next=value*scale;if(p.origin.y==next)return;p.origin.y=next;}
    else return;
    self.params=p;self.nativeParameterWrites++;[self updateClock];[self.surface draw];
}
- (void)clearVideo {
    [self.player pause];
    if(self.videoEndObserver)[NSNotificationCenter.defaultCenter removeObserver:self.videoEndObserver];
    self.videoEndObserver=nil;
    if(self.videoOutput)[self.player.currentItem removeOutput:self.videoOutput];
    [self.player replaceCurrentItemWithPlayerItem:nil];self.player=nil;self.videoOutput=nil;
    if(_videoTexture){CFRelease(_videoTexture);_videoTexture=NULL;}
    if(_videoCache){CVMetalTextureCacheFlush(_videoCache,0);CFRelease(_videoCache);_videoCache=NULL;}
    JoltImageParams p=self.params;p.video=0;self.params=p;self.videoError=nil;self.videoHasFrame=NO;
}
- (BOOL)setVideo:(NSString *)path loop:(BOOL)loop paused:(BOOL)paused {
    if(self.disposed || (path && ![[NSFileManager defaultManager] fileExistsAtPath:path]))return NO;
    // Prepare the replacement before releasing the current player.
    AVPlayerItem *item=path?[AVPlayerItem playerItemWithURL:[NSURL fileURLWithPath:path]]:nil;
    AVPlayerItemVideoOutput *output=item?[[AVPlayerItemVideoOutput alloc] initWithPixelBufferAttributes:@{(NSString *)kCVPixelBufferPixelFormatTypeKey:@(kCVPixelFormatType_32BGRA),(NSString *)kCVPixelBufferMetalCompatibilityKey:@YES}]:nil;
    CVMetalTextureCacheRef cache=NULL;
    if(item && CVMetalTextureCacheCreate(kCFAllocatorDefault,NULL,self.surface.device,NULL,&cache)!=kCVReturnSuccess)return NO;
    JoltImageParams previous=self.params;
    [self clearVideo];
    if(item && previous.video>0){JoltImageParams p=self.params;p.video=previous.video;p.videoRect=previous.videoRect;p.videoTransform=previous.videoTransform;self.params=p;}
    if(!item){[self resize];[self updateClock];return YES;}
    _videoCache=cache;self.videoOutput=output;[item addOutput:output];
    self.player=[AVPlayer playerWithPlayerItem:item];self.player.muted=YES;
    self.videoPaused=paused;self.looping=loop;self.videoTransform=CGAffineTransformIdentity;self.videoGeometryRead=NO;
    __weak JoltImageEffect *weakSelf=self;
    self.videoEndObserver=[NSNotificationCenter.defaultCenter addObserverForName:AVPlayerItemDidPlayToEndTimeNotification object:item queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *note){
        JoltImageEffect *effect=weakSelf;if(!effect)return;
        if(effect.looping){[effect.player seekToTime:kCMTimeZero toleranceBefore:kCMTimeZero toleranceAfter:kCMTimeZero completionHandler:^(BOOL done){if(done && !effect.disposed && !effect.suspended && !effect.videoPaused)[effect.player play];}];}
        else {effect.videoPaused=YES;[effect updateClock];}
    }];
    if(!paused && !self.suspended)[self.player play];[self updateClock];return YES;
}
- (void)pauseVideo { self.videoPaused=YES;self.previousFrame=0;[self.player pause];[self updateClock]; }
- (void)playVideo { if(self.disposed)return;self.videoPaused=NO;self.previousFrame=0;if(!self.suspended)[self.player play];[self updateClock]; }
- (double)videoTime { double time=CMTimeGetSeconds(self.player.currentTime);return isfinite(time)?time:0; }
- (NSString *)videoStatus {
    if(self.videoError)return self.videoError;
    if(!self.player)return @"none";
    if(self.player.currentItem.status==AVPlayerItemStatusFailed)return @"failed";
    return self.videoPaused?@"paused":self.player.currentItem.status==AVPlayerItemStatusReadyToPlay?@"playing":@"waiting";
}
- (void)updateVideoGeometry {
    if(!self.params.video)return;
    JoltImageParams p=self.params;
    float iw=self.sourceTexture.width,ih=self.sourceTexture.height;
    CGAffineTransform transform=self.videoTransform;
    if(fabs(transform.b)>.5){float swap=iw;iw=ih;ih=swap;}
    float w=p.size.x,h=p.size.y;
    UIViewContentMode mode=self.image.contentMode;
    float factor=mode==UIViewContentModeScaleAspectFill?MAX(w/iw,h/ih):MIN(w/iw,h/ih);
    BOOL unscaled=mode==UIViewContentModeCenter || mode==UIViewContentModeTopLeft;
    float dw=mode==UIViewContentModeScaleToFill?w:unscaled?iw:iw*factor;
    float dh=mode==UIViewContentModeScaleToFill?h:unscaled?ih:ih*factor;
    p.videoRect=(vector_float4){mode==UIViewContentModeTopLeft?0:(w-dw)/2/w,mode==UIViewContentModeTopLeft?0:(h-dh)/2/h,dw/w,dh/h};
    CGAffineTransform inverse=CGAffineTransformInvert(transform);
    p.videoTransform=(vector_float4){(float)inverse.a,(float)inverse.b,(float)inverse.c,(float)inverse.d};self.params=p;
}
- (void)updateVideo {
    if(!self.player || self.suspended || (self.videoPaused && self.videoHasFrame))return;
    if(self.player.currentItem.status==AVPlayerItemStatusFailed){self.videoError=@"failed";[self.player pause];[self updateClock];return;}
    CMTime time=[self.videoOutput itemTimeForHostTime:CACurrentMediaTime()];
    if(![self.videoOutput hasNewPixelBufferForItemTime:time])return;
    CVPixelBufferRef buffer=[self.videoOutput copyPixelBufferForItemTime:time itemTimeForDisplay:NULL];
    if(!buffer)return;
    size_t w=CVPixelBufferGetWidth(buffer),h=CVPixelBufferGetHeight(buffer);
    if(w*h>4194304){CVPixelBufferRelease(buffer);self.videoError=@"pixel-budget";[self.player pause];[self updateClock];return;}
    CVMetalTextureRef texture=NULL;
    CVReturn result=CVMetalTextureCacheCreateTextureFromImage(kCFAllocatorDefault,_videoCache,buffer,NULL,MTLPixelFormatBGRA8Unorm,w,h,0,&texture);
    CVPixelBufferRelease(buffer);
    if(result!=kCVReturnSuccess || !texture)return;
    if(_videoTexture)CFRelease(_videoTexture);_videoTexture=texture;
    self.sourceTexture=CVMetalTextureGetTexture(texture);self.destinationTexture=self.sourceTexture;
    self.textureBytes=w*h*4;self.peakTextureBytes=MAX(self.peakTextureBytes,self.textureBytes*4);self.videoFrames++;self.videoHasFrame=YES;
    JoltImageParams p=self.params;p.video=1;self.params=p;
    if(!self.videoGeometryRead) {
        AVAssetTrack *track=[[self.player.currentItem.asset tracksWithMediaType:AVMediaTypeVideo] firstObject];
        if(track){self.videoTransform=track.preferredTransform;self.videoGeometryRead=YES;}
    }
    [self updateVideoGeometry];
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
    [self updateClock];
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
    if(self.player && !self.videoPaused && !self.suspended) self.surface.paused=NO;
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
    for(JoltLiveSpringBinding *binding in [self.inputBindings copy]) [binding cancel]; [self.inputBindings removeAllObjects];
    for(JoltImageScrollBinding *binding in [self.scrollBindings copy]) [binding cancel]; [self.scrollBindings removeAllObjects];
    [self clearVideo];
    self.sourceTexture=nil;self.destinationTexture=nil;self.original=nil;self.destinationImage=nil;self.queue=nil;
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
        self.playing=NO; [self updateClock];
        if(!self.settling && self.params.mode!=3 && self.listener) self.listener(YES,self.progress);
    }
}
- (void)drawInMTKView:(MTKView *)view {
    if(self.disposed) return;
    double now=CACurrentMediaTime();
    if(self.previousFrame>0 && (self.playing || (self.player && !self.videoPaused))) {
        double interval=now-self.previousFrame;
        self.longestFrame=MAX(self.longestFrame,interval);
        _frameIntervals[_frameIntervalCursor]=interval;
        _frameIntervalCursor=(_frameIntervalCursor+1)%512;
        _frameIntervalCount=MIN(_frameIntervalCount+1,512);
    }
    self.previousFrame=now;self.frames++;
    [self advance:now];
    if(self.disposed || self.suspended) return;
    [self updateVideo];
    MTLRenderPassDescriptor *pass=view.currentRenderPassDescriptor;
    id<CAMetalDrawable> drawable=view.currentDrawable;
    if(!pass || !drawable || dispatch_semaphore_wait(_inflight,DISPATCH_TIME_NOW)!=0) return;
    id<MTLCommandBuffer> command=[self.queue commandBuffer];
    dispatch_semaphore_t gate=_inflight;
    CVMetalTextureRef frame=_videoTexture; if(frame)CFRetain(frame);
    __weak JoltImageEffect *weakSelf=self;
    [command addCompletedHandler:^(id<MTLCommandBuffer> buffer){
        double gpu=MAX(0,buffer.GPUEndTime-buffer.GPUStartTime)*1000;
        if(frame)CFRelease(frame);dispatch_semaphore_signal(gate);
        dispatch_async(dispatch_get_main_queue(), ^{JoltImageEffect *effect=weakSelf;if(effect && !effect.disposed)effect.renderGpuMs+=gpu;});
    }];
    id<MTLRenderCommandEncoder> encoder=[command renderCommandEncoderWithDescriptor:pass];
    [encoder setRenderPipelineState:self.pipeline];
    JoltImageParams params=self.params;
    [encoder setFragmentBytes:&params length:sizeof(params) atIndex:0];
    [encoder setFragmentBytes:_maskShapes length:sizeof(_maskShapes) atIndex:1];
    [encoder setFragmentTexture:self.sourceTexture atIndex:0];
    [encoder setFragmentTexture:self.destinationTexture atIndex:1];
    [encoder drawPrimitives:MTLPrimitiveTypeTriangleStrip vertexStart:0 vertexCount:4];
    [encoder endEncoding]; [command presentDrawable:drawable]; [command commit];
    self.renderCpuMs+=(CACurrentMediaTime()-now)*1000;
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

@interface JoltImageScrollBinding ()
@property(nonatomic,weak) JoltImageEffect *effect;
@property(nonatomic,weak) UIScrollView *scroll;
@property(nonatomic) NSString *parameter;
@property(nonatomic) double start,end,low,high;
@property(nonatomic) BOOL horizontal,observing;
@end
@implementation JoltImageScrollBinding
+ (instancetype)attachEffect:(JoltImageEffect *)effect scroll:(UIScrollView *)scroll parameter:(NSString *)parameter configuration:(NSString *)configuration {
    JoltImageScrollBinding *binding=[self new];binding.effect=effect;binding.scroll=scroll;binding.parameter=parameter;
    NSDictionary *config=[NSJSONSerialization JSONObjectWithData:[configuration dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    NSArray *range=config[@"range"],*output=config[@"output"] ?: @[@0,@1];
    binding.start=[range[0] doubleValue];binding.end=[range[1] doubleValue];binding.low=[output[0] doubleValue];binding.high=[output[1] doubleValue];binding.horizontal=[config[@"axis"] isEqual:@"x"];
    [scroll addObserver:binding forKeyPath:@"contentOffset" options:NSKeyValueObservingOptionInitial|NSKeyValueObservingOptionNew context:NULL];binding.observing=YES;
    [effect.scrollBindings addObject:binding];return binding;
}
- (void)observeValueForKeyPath:(NSString *)keyPath ofObject:(id)object change:(NSDictionary *)change context:(void *)context {
    double offset=self.horizontal?self.scroll.contentOffset.x:self.scroll.contentOffset.y;
    double t=MAX(0,MIN(1,(offset-self.start)/(self.end-self.start)));
    [self.effect setParameter:self.parameter value:self.low+(self.high-self.low)*t];
}
- (void)cancel {
    if(self.observing){[self.scroll removeObserver:self forKeyPath:@"contentOffset"];self.observing=NO;}
    [self.effect.scrollBindings removeObject:self];self.effect=nil;self.scroll=nil;
}
- (void)dealloc { if(self.observing)[self.scroll removeObserver:self forKeyPath:@"contentOffset"]; }
@end
