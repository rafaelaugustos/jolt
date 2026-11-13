#import <Foundation/Foundation.h>

/** Validated immutable DAG with reusable sample storage. */
@interface JoltScalarProgram : NSObject
- (instancetype)initWithJSON:(NSString *)json sources:(NSUInteger)sources;
- (void)evaluateValues:(const double *)values velocities:(const double *)velocities;
@property(nonatomic, readonly) double value;
@property(nonatomic, readonly) double velocity;
@end
