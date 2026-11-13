#import "JoltScalarProgram.h"
#import <math.h>

typedef NS_ENUM(NSUInteger, ScalarOp) { Input, Constant, Map, Add, Sub, Mul, Div, Min, Max, Clamp, Abs, Sin, Cos, Velocity };
typedef struct {
    ScalarOp op;
    NSUInteger a, b, count;
    BOOL hasB, clamp;
    double constant, maximum, value, velocity;
    double *input, *output;
} ScalarNode;
@implementation JoltScalarProgram {
    ScalarNode *_nodes;
    NSUInteger _count;
}
- (instancetype)initWithJSON:(NSString *)json sources:(NSUInteger)sources {
    if (!(self = [super init])) return nil;
    NSArray *list = [NSJSONSerialization JSONObjectWithData:[json dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    if (![list isKindOfClass:NSArray.class] || !list.count || list.count > 1024)
        [NSException raise:NSInvalidArgumentException format:@"Scalar graph size"];
    NSArray *names = @[@"input", @"constant", @"map", @"add", @"sub", @"mul", @"div", @"min", @"max", @"clamp", @"abs", @"sin", @"cos", @"velocity"];
    _count = list.count; _nodes = calloc(_count, sizeof(ScalarNode));
    for (NSUInteger i=0; i<_count; i++) {
        NSDictionary *jsonNode = list[i]; ScalarNode *node = &_nodes[i];
        node->op = [names indexOfObject:jsonNode[@"op"]];
        node->a = [jsonNode[@"a"] unsignedIntegerValue]; node->b = [jsonNode[@"b"] unsignedIntegerValue];
        node->hasB = jsonNode[@"b"] != nil;
        node->constant = [jsonNode[@"value"] doubleValue]; node->maximum = [jsonNode[@"maximum"] doubleValue];
        if (node->op == NSNotFound || (node->op != Constant && node->a >= (node->op == Input ? sources : i)) || (node->hasB && node->b >= i))
            [NSException raise:NSInvalidArgumentException format:@"Cyclic or unknown scalar graph"];
        if (node->op == Map) {
            NSArray *input = jsonNode[@"input"], *output = jsonNode[@"output"];
            if (input.count < 2 || input.count != output.count) [NSException raise:NSInvalidArgumentException format:@"Scalar map size"];
            node->count = input.count; node->clamp = [jsonNode[@"clamp"] boolValue];
            node->input = calloc(node->count, sizeof(double)); node->output = calloc(node->count, sizeof(double));
            for (NSUInteger k=0; k<node->count; k++) { node->input[k]=[input[k] doubleValue]; node->output[k]=[output[k] doubleValue]; }
        }
    }
    return self;
}
- (void)dealloc {
    for (NSUInteger i=0; i<_count; i++) { free(_nodes[i].input); free(_nodes[i].output); }
    free(_nodes);
}
- (void)evaluateValues:(const double *)values velocities:(const double *)velocities {
    for (NSUInteger i=0; i<_count; i++) {
        ScalarNode *node = &_nodes[i];
        BOOL reads=node->op!=Input && node->op!=Constant;
        double x=reads?_nodes[node->a].value:0, xv=reads?_nodes[node->a].velocity:0;
        double y=node->hasB?_nodes[node->b].value:0, yv=node->hasB?_nodes[node->b].velocity:0;
        double value=0, velocity=0;
        switch (node->op) {
            case Input: value=values[node->a]; velocity=velocities[node->a]; break;
            case Constant: value=node->constant; break;
            case Map: {
                if (node->clamp && x<=node->input[0]) { value=node->output[0]; break; }
                if (node->clamp && x>=node->input[node->count-1]) { value=node->output[node->count-1]; break; }
                NSUInteger k=0; while(k<node->count-2 && x>node->input[k+1]) k++;
                double slope=(node->output[k+1]-node->output[k])/(node->input[k+1]-node->input[k]);
                value=node->output[k]+(x-node->input[k])*slope; velocity=xv*slope; break;
            }
            case Add: value=x+y; velocity=xv+yv; break;
            case Sub: value=x-y; velocity=xv-yv; break;
            case Mul: value=x*y; velocity=xv*y+x*yv; break;
            case Div: if(y!=0) { value=x/y; velocity=(xv*y-x*yv)/(y*y); } break;
            case Min: value=fmin(x,y); velocity=x<y?xv:x>y?yv:0; break;
            case Max: value=fmax(x,y); velocity=x>y?xv:x<y?yv:0; break;
            case Clamp: value=fmin(node->maximum,fmax(y,x)); velocity=x<=y||x>=node->maximum?0:xv; break;
            case Abs: value=fabs(x); velocity=(x<0?-1:x>0?1:0)*xv; break;
            case Sin: value=sin(x); velocity=cos(x)*xv; break;
            case Cos: value=cos(x); velocity=-sin(x)*xv; break;
            case Velocity: value=xv; break;
        }
        node->velocity=isfinite(value)&&isfinite(velocity)?velocity:0;
        node->value=isfinite(value)?value:0;
    }
}
- (double)value { return _nodes[_count-1].value; }
- (double)velocity { return _nodes[_count-1].velocity; }
@end
