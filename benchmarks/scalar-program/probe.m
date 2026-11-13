#import <Foundation/Foundation.h>
#import "JoltScalarProgram.h"
int main(int argc, const char **argv) {
    @autoreleasepool {
        NSData *data=[NSData dataWithContentsOfFile:[NSString stringWithUTF8String:argv[1]]];
        NSArray *fixtures=[NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
        for (NSDictionary *fixture in fixtures) {
            NSArray *sources=fixture[@"sources"];
            double values[sources.count], velocities[sources.count];
            for(NSUInteger i=0; i<sources.count; i++) { values[i]=[sources[i][@"value"] doubleValue]; velocities[i]=[sources[i][@"velocity"] doubleValue]; }
            NSData *json=[NSJSONSerialization dataWithJSONObject:fixture[@"program"] options:0 error:nil];
            JoltScalarProgram *program=[[JoltScalarProgram alloc] initWithJSON:[[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding] sources:sources.count];
            [program evaluateValues:values velocities:velocities];
            printf("%.17g,%.17g\n",program.value,program.velocity);
        }
    }
    return 0;
}
