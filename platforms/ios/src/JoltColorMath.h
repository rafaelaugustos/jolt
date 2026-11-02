#ifndef JOLT_COLOR_MATH_H
#define JOLT_COLOR_MATH_H
#include <math.h>
#include <stdint.h>

/* Matches core/color.ts. Stops are converted once, never on the frame path. */
typedef struct { double l, a, b, alpha; uint32_t argb; } JoltColorStop;
static inline double JoltColorClamp(double n) { return fmax(0, fmin(1, n)); }
static inline double JoltColorLinear(double n) { return n <= .04045 ? n / 12.92 : pow((n + .055) / 1.055, 2.4); }
static inline uint32_t JoltColorByte(double n) {
    double encoded = n <= .0031308 ? 12.92 * n : 1.055 * pow(n, 1 / 2.4) - .055;
    return (uint32_t)floor(JoltColorClamp(encoded) * 255 + .5);
}
static inline JoltColorStop JoltColorDecode(uint32_t value) {
    double r = JoltColorLinear(((value >> 16) & 255) / 255.0);
    double g = JoltColorLinear(((value >> 8) & 255) / 255.0);
    double b = JoltColorLinear((value & 255) / 255.0);
    double l = cbrt(.4122214708*r + .5363325363*g + .0514459929*b);
    double m = cbrt(.2119034982*r + .6806995451*g + .1073969566*b);
    double s = cbrt(.0883024619*r + .2817188376*g + .6299787005*b);
    return (JoltColorStop){ .2104542553*l + .793617785*m - .0040720468*s,
        1.9779984951*l - 2.428592205*m + .4505937099*s,
        .0259040371*l + .7827717662*m - .808675766*s, (value >> 24)/255.0, value };
}
static inline uint32_t JoltColorMix(JoltColorStop a, JoltColorStop b, double progress) {
    double p = JoltColorClamp(progress);
    if (p == 0) return a.argb;
    if (p == 1) return b.argb;
    double alpha = a.alpha + (b.alpha-a.alpha)*p;
    if (alpha <= 0) return 0;
    double wa = a.alpha*(1-p)/alpha, wb = b.alpha*p/alpha;
    double L = a.l*wa + b.l*wb, A = a.a*wa + b.a*wb, B = a.b*wa + b.b*wb;
    double l = L+.3963377774*A+.2158037573*B, m = L-.1055613458*A-.0638541728*B, s = L-.0894841775*A-1.291485548*B;
    l=l*l*l; m=m*m*m; s=s*s*s;
    return ((uint32_t)floor(alpha*255+.5)<<24) |
        (JoltColorByte(4.0767416621*l-3.3077115913*m+.2309699292*s)<<16) |
        (JoltColorByte(-1.2684380046*l+2.6097574011*m-.3413193965*s)<<8) |
        JoltColorByte(-.0041960863*l-.7034186147*m+1.707614701*s);
}
#endif
