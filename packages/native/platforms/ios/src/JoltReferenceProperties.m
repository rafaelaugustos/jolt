#import "JoltReferenceProperties.h"
#import <MapKit/MapKit.h>
#import <SceneKit/SceneKit.h>

static double longitude(double value) { return fmod(fmod(value+180,360)+360,360)-180; }
@interface JoltMapCoordinateSink : JoltPropertySink @end
@implementation JoltMapCoordinateSink
- (NSArray<NSNumber *> *)read {
    CLLocationCoordinate2D p=[(id<MKAnnotation>)self.target coordinate];
    return @[@(p.latitude),@(p.longitude)];
}
- (void)write:(NSArray<NSNumber *> *)values {
    id<MKAnnotation> target=(id)self.target;
    if(target) target.coordinate=CLLocationCoordinate2DMake(MAX(-90,MIN(90,values[0].doubleValue)),longitude(values[1].doubleValue));
}
@end
@interface JoltMapCameraSink : JoltPropertySink @end
@implementation JoltMapCameraSink
- (NSArray<NSNumber *> *)read {
    MKMapCamera *camera=[(MKMapView *)self.target camera];
    return @[@(camera.centerCoordinate.latitude),@(camera.centerCoordinate.longitude),@(camera.altitude),@(camera.pitch),@(camera.heading)];
}
- (void)write:(NSArray<NSNumber *> *)values {
    MKMapView *map=(id)self.target;
    if(!map) return;
    MKMapCamera *camera=[map.camera copy];
    camera.centerCoordinate=CLLocationCoordinate2DMake(MAX(-90,MIN(90,values[0].doubleValue)),longitude(values[1].doubleValue));
    camera.altitude=MAX(1,values[2].doubleValue); camera.pitch=MAX(0,MIN(80,values[3].doubleValue)); camera.heading=values[4].doubleValue;
    [map setCamera:camera animated:NO];
}
@end
@interface JoltScenePoseSink : JoltPropertySink @end
@implementation JoltScenePoseSink
- (NSArray<NSNumber *> *)read {
    SCNNode *node=(id)self.target;
    SCNNode *presented=node.presentationNode ?: node;
    SCNVector3 p=presented.position; SCNQuaternion q=presented.orientation;
    return @[@(p.x),@(p.y),@(p.z),@(q.x),@(q.y),@(q.z),@(q.w)];
}
- (void)write:(NSArray<NSNumber *> *)values {
    SCNNode *node=(id)self.target; if(!node) return;
    [SCNTransaction begin]; [SCNTransaction setDisableActions:YES];
    node.position=SCNVector3Make(values[0].floatValue,values[1].floatValue,values[2].floatValue);
    double x=values[3].doubleValue,y=values[4].doubleValue,z=values[5].doubleValue,w=values[6].doubleValue;
    double norm=sqrt(x*x+y*y+z*z+w*w);
    node.orientation=norm>0?SCNVector4Make(x/norm,y/norm,z/norm,w/norm):SCNVector4Make(0,0,0,1);
    [SCNTransaction commit];
}
@end
@implementation JoltReferenceProperties
+ (JoltPropertySink *)mapCoordinate:(NSObject *)annotation {
    NSParameterAssert([annotation conformsToProtocol:@protocol(MKAnnotation)] && [annotation respondsToSelector:@selector(setCoordinate:)]);
    return [[JoltMapCoordinateSink alloc] initWithTarget:annotation dimensions:2];
}
+ (JoltPropertySink *)mapCamera:(NSObject *)mapView {
    NSParameterAssert([mapView isKindOfClass:MKMapView.class]);
    return [[JoltMapCameraSink alloc] initWithTarget:mapView dimensions:5];
}
+ (JoltPropertySink *)scenePose:(NSObject *)node {
    NSParameterAssert([node isKindOfClass:SCNNode.class]);
    return [[JoltScenePoseSink alloc] initWithTarget:node dimensions:7];
}
@end
