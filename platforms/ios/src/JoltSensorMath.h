// Canonical sensor math: device-to-reference Hamilton quaternions, xyzw.
#ifndef JOLT_SENSOR_MATH_H
#define JOLT_SENSOR_MATH_H
#include <math.h>
#include <stdbool.h>
#include <string.h>
static inline bool JoltSensorNormalize(double *q) {
    double length = 0;
    for (int i = 0; i < 4; i++) { if (!isfinite(q[i])) return false; length += q[i]*q[i]; }
    length = sqrt(length);
    if (!isfinite(length) || length < 1e-8) return false;
    for (int i = 0; i < 4; i++) q[i] /= length;
    return true;
}
static inline void JoltSensorMultiply(const double *a, const double *b, double *result) {
    double q[] = { a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
        a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
        a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
        a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2] };
    memcpy(result, q, sizeof(q));
}
static inline void JoltSensorInverse(const double *q, double *result) {
    for (int i=0;i<4;i++) result[i] = i == 3 ? q[i] : -q[i];
}
static inline void JoltSensorVector(const double *v, double degrees, double *out) {
    double a = degrees*M_PI/180, c=cos(a), s=sin(a);
    out[0]=c*v[0]+s*v[1]; out[1]=-s*v[0]+c*v[1]; out[2]=v[2];
}
static inline void JoltSensorRotation(const double *q, double degrees, const double *previous, double *out) {
    double r[4]; JoltSensorVector(q, degrees, r); r[3]=q[3];
    double dot=0; for(int i=0;i<4;i++) dot += r[i]*previous[i];
    if(dot < 0) for(int i=0;i<4;i++) r[i]=-r[i];
    double x=r[0], y=r[1], z=r[2], w=r[3];
    out[0]=atan2(2*(w*x+y*z), 1-2*(x*x+y*y));
    out[1]=asin(fmax(-1,fmin(1,2*(w*y-z*x))));
    out[2]=atan2(2*(w*z+x*y),1-2*(y*y+z*z));
    memcpy(out+3,r,sizeof(r));
}
#endif
