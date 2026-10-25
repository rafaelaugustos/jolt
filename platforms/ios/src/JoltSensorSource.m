#import "JoltSensorSource.h"
#import "JoltSensorMath.h"
#import <CoreMotion/CoreMotion.h>
#import <UIKit/UIKit.h>
#import <QuartzCore/QuartzCore.h>

@interface JoltSensorSource () {
    double reference[4], relative[4], output[7], pending[4];
}
@property(nonatomic) BOOL rotation, interfaceCoordinates, enabled, disposed, dirty, rebase, reset, available;
@property(nonatomic) double interval, timestamp, pendingTimestamp, receivedAt, committedAt, processingMs;
@property(nonatomic) NSUInteger samples, frames, callbacks, replayIndex;
@property(nonatomic) NSString *status, *error, *configurationError;
@property(nonatomic) NSMutableArray *nodes;
@property(nonatomic,copy) void (^onState)(void);
@property(nonatomic) NSArray *trace;
@property(nonatomic) double replayStart, replayElapsed, replayOrientation;
- (void)receive:(const double *)values timestamp:(double)timestamp;
- (void)frame:(double)now;
- (void)state:(NSString *)state;
@end

@implementation JoltSensorSource
static NSMutableArray<JoltSensorSource *> *sources;
static CMMotionManager *manager;
static CADisplayLink *sensorDisplayLink;
static BOOL suspended;
static double hardwareInterval;
+ (void)initialize {
    if (self != JoltSensorSource.class) return;
    sources = [NSMutableArray new];
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(background) name:UIApplicationDidEnterBackgroundNotification object:nil];
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(foreground) name:UIApplicationWillEnterForegroundNotification object:nil];
}
+ (void)background {
    suspended=YES;
    for(JoltSensorSource *s in sources) if(s.trace && s.replayStart) { s.replayElapsed=MAX(0,CACurrentMediaTime()*1000-s.replayStart); s.replayStart=0; }
    [self refresh];
}
+ (void)foreground {
    suspended=NO;
    for(JoltSensorSource *s in sources) { s.rebase=YES; s.receivedAt=CACurrentMediaTime()*1000; s.replayStart=0; }
    [self refresh];
}
+ (void)refresh {
    double interval=INFINITY; BOOL ticking=NO;
    for(JoltSensorSource *s in sources) if(s.enabled && !s.disposed && !suspended) {
        if(s.trace) ticking=YES;
        else if(s.available && !s.error) { interval=MIN(interval,s.interval); ticking=YES; }
    }
    if(isfinite(interval)) {
        // Updating a shared rate must not restart Core Motion's arbitrary heading reference.
        if(manager.deviceMotionActive && hardwareInterval!=interval) {
            hardwareInterval=interval; manager.deviceMotionUpdateInterval=interval/1000;
        }
        if(!manager.deviceMotionActive) {
            for(JoltSensorSource *s in sources) if(s.enabled && !s.trace) s.rebase=YES;
            hardwareInterval=interval;
            manager.deviceMotionUpdateInterval=interval/1000;
            [manager startDeviceMotionUpdatesUsingReferenceFrame:CMAttitudeReferenceFrameXArbitraryZVertical toQueue:NSOperationQueue.mainQueue withHandler:^(CMDeviceMotion *motion,NSError *error){
                if(suspended) return;
                if(error) {
                    for(JoltSensorSource *s in [sources copy]) if(s.enabled && !s.trace) { s.error=error.localizedDescription ?: @"motion-access-failed"; [s state:@"error"]; }
                    [self refresh]; return;
                }
                if(!motion) return;
                CMQuaternion q=motion.attitude.quaternion;
                // Core Motion reports reference-to-device attitude; canonical inputs are device-to-reference.
                double rotation[]={-q.x,-q.y,-q.z,q.w};
                double gravity[]={motion.gravity.x*9.80665,motion.gravity.y*9.80665,motion.gravity.z*9.80665};
                for(JoltSensorSource *s in [sources copy]) if(s.enabled && !s.trace && !s.error)
                    [s receive:s.rotation ? rotation : gravity timestamp:motion.timestamp*1000];
            }];
        }
    } else { [manager stopDeviceMotionUpdates]; hardwareInterval=0; }
    if(ticking && !sensorDisplayLink) {
        sensorDisplayLink=[CADisplayLink displayLinkWithTarget:self selector:@selector(tick:)];
        [sensorDisplayLink addToRunLoop:NSRunLoop.mainRunLoop forMode:NSRunLoopCommonModes];
    } else if(!ticking && sensorDisplayLink) { [sensorDisplayLink invalidate]; sensorDisplayLink=nil; }
}
+ (void)tick:(CADisplayLink *)link {
    for(JoltSensorSource *s in [sources copy]) if(s.enabled && !suspended) [s frame:link.timestamp*1000];
}
+ (NSUInteger)activeCount { return manager.deviceMotionActive ? 1 : 0; }
+ (NSUInteger)sourceCount { return sources.count; }
+ (instancetype)create:(NSString *)kind options:(NSString *)options onState:(void (^)(void))onState {
    if(!manager) manager=[CMMotionManager new];
    NSDictionary *config=[NSJSONSerialization JSONObjectWithData:[options dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    JoltSensorSource *s=[self new];
    s.rotation=[kind isEqual:@"rotation"]; s.interfaceCoordinates=[config[@"coordinates"] isEqual:@"interface"];
    s.interval=[config[@"interval"] doubleValue];
    if(s.interval==0) s.interval=1000.0/MAX(60,UIScreen.mainScreen.maximumFramesPerSecond);
    s.interval=MAX(5,MIN(1000,s.interval)); s.timestamp=-1;
    s.available=manager.deviceMotionAvailable; s.nodes=[NSMutableArray new];
    for(int i=0;i<(s.rotation?7:3);i++) [s.nodes addObject:NSNull.null];
    s->reference[3]=s->relative[3]=s->output[6]=1; s.rebase=YES;
    id usage=NSBundle.mainBundle.infoDictionary[@"NSMotionUsageDescription"];
    if(s.available && (![usage isKindOfClass:NSString.class] || ![usage length])) s.configurationError=@"missing-motion-usage-description";
    s.error=s.configurationError;
    s.status=s.error?@"error":(s.available?@"idle":@"unavailable"); s.onState=onState;
    [sources addObject:s]; return s;
}
- (void)connect:(JoltLiveSpring *)node index:(NSInteger)index { if(index>=0 && index<self.nodes.count) self.nodes[index]=node; }
- (void)state:(NSString *)state {
    if([self.status isEqual:state]) return;
    self.status=state;
    if(self.onState) { self.callbacks++; self.onState(); }
}
- (void)setEnabled:(BOOL)enabled paused:(BOOL)paused {
    if(self.disposed) return;
    BOOL changed=self.enabled!=enabled; self.enabled=enabled;
    if(changed) {
        self.dirty=NO; self.committedAt=0; self.rebase=YES;
        if(enabled) { self.receivedAt=CACurrentMediaTime()*1000; self.error=self.configurationError; self.replayStart=0; }
        else if(self.trace && self.replayStart) {
            self.replayElapsed=MAX(0,CACurrentMediaTime()*1000-self.replayStart); self.replayStart=0;
        }
    }
    if(!enabled) [self state:paused?@"paused":(self.available?@"idle":@"unavailable")];
    else if(changed) [self state:self.trace?@"replaying":(self.error?@"error":(self.available?@"starting":@"unavailable"))];
    [JoltSensorSource refresh];
}
- (void)recenter { if(!self.disposed && self.rotation) { self.reset=YES; self.rebase=YES; } }
- (void)replay:(NSString *)trace {
    if(self.disposed) return;
    NSArray *frames=[NSJSONSerialization JSONObjectWithData:[trace dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    if(![frames isKindOfClass:NSArray.class] || frames.count<2) return;
    self.trace=frames; self.replayIndex=0; self.replayStart=0; self.replayElapsed=0; self.error=nil;
    self.reset=YES; self.rebase=YES; self.dirty=NO; self.committedAt=0;
    if(self.enabled) [self state:@"replaying"];
    [JoltSensorSource refresh];
}
- (void)receive:(const double *)values timestamp:(double)timestamp {
    if(!isfinite(timestamp) || timestamp<0) return;
    if(!self.trace && self.timestamp>=0 && timestamp<=self.pendingTimestamp) return;
    int count=self.rotation?4:3;
    for(int i=0;i<count;i++) if(!isfinite(values[i])) return;
    double input[4]={0}; memcpy(input,values,count*sizeof(double));
    if(self.rotation && !JoltSensorNormalize(input)) return;
    memcpy(pending,input,sizeof(input)); self.pendingTimestamp=timestamp; self.samples++; self.dirty=YES;
    self.receivedAt=CACurrentMediaTime()*1000;
}
- (double)orientation {
    if(!self.interfaceCoordinates) return 0;
    if(self.trace) return self.replayOrientation;
    for(UIScene *scene in UIApplication.sharedApplication.connectedScenes) if([scene isKindOfClass:UIWindowScene.class] && scene.activationState==UISceneActivationStateForegroundActive) {
        switch(((UIWindowScene *)scene).interfaceOrientation) {
            case UIInterfaceOrientationLandscapeLeft:return 90;
            case UIInterfaceOrientationLandscapeRight:return 270;
            case UIInterfaceOrientationPortraitUpsideDown:return 180;
            default:return 0;
        }
    }
    return 0;
}
- (void)frame:(double)now {
    if(self.disposed || self.error) return;
    if(self.trace) {
        if(!self.replayStart) self.replayStart=now-self.replayElapsed;
        double elapsed=now-self.replayStart;
        while(self.replayIndex<self.trace.count && [self.trace[self.replayIndex][@"time"] doubleValue]<=elapsed) {
            NSDictionary *sample=self.trace[self.replayIndex++]; NSArray *values=sample[@"values"];
            if(values.count!=(self.rotation?4:3)) continue;
            double input[4]={0}; for(int i=0;i<values.count;i++) input[i]=[values[i] doubleValue];
            self.replayOrientation=[sample[@"orientation"] doubleValue];
            [self receive:input timestamp:[sample[@"time"] doubleValue]];
        }
    } else if(self.available && now-self.receivedAt>MAX(3000,self.interval*3)) {
        self.error=@"no-data"; [self state:@"error"]; [JoltSensorSource refresh]; return;
    }
    if(self.dirty && (!self.committedAt || now-self.committedAt>=self.interval-0.5)) {
        double start=CACurrentMediaTime();
        if(self.rotation) {
            if(self.rebase) {
                if(self.reset) { memset(relative,0,sizeof(relative)); relative[3]=1; }
                double inverse[4]; JoltSensorInverse(relative,inverse); JoltSensorMultiply(pending,inverse,reference);
                self.rebase=NO; self.reset=NO;
            }
            double inverse[4]; JoltSensorInverse(reference,inverse); JoltSensorMultiply(inverse,pending,relative);
            JoltSensorRotation(relative,[self orientation],output+3,output);
        } else JoltSensorVector(pending,[self orientation],output);
        for(int i=0;i<self.nodes.count;i++) if(self.nodes[i]!=NSNull.null) [self.nodes[i] setSensorInput:output[i]];
        self.dirty=NO; self.timestamp=self.pendingTimestamp; self.frames++; self.committedAt=now;
        self.processingMs+=(CACurrentMediaTime()-start)*1000;
        if(!self.trace) [self state:@"active"];
    }
    if(self.trace && self.replayIndex>=self.trace.count && !self.dirty) {
        self.trace=nil; self.replayStart=0; self.replayElapsed=0; self.rebase=YES; self.receivedAt=now; self.error=self.configurationError;
        [self state:self.error?@"error":self.available?@"starting":@"unavailable"]; [JoltSensorSource refresh];
    }
}
- (NSString *)snapshot {
    NSMutableArray *values=[NSMutableArray new];for(int i=0;i<(self.rotation?7:3);i++)[values addObject:@(output[i])];
    NSDictionary *snapshot=@{@"status":self.status,@"available":@(self.available),@"error":self.error?:NSNull.null,@"timestamp":self.timestamp<0?NSNull.null:@(self.timestamp),@"samples":@(self.samples),@"frames":@(self.frames),@"callbacks":@(self.callbacks),@"processingMs":@(self.processingMs),@"interval":@(self.interval),@"values":values};
    return [[NSString alloc]initWithData:[NSJSONSerialization dataWithJSONObject:snapshot options:0 error:nil] encoding:NSUTF8StringEncoding];
}
- (void)dispose {
    if(self.disposed)return; self.disposed=YES;self.enabled=NO;self.status=@"disposed";self.onState=nil;
    self.trace=nil;[self.nodes removeAllObjects];[sources removeObject:self];[JoltSensorSource refresh];
}
@end
