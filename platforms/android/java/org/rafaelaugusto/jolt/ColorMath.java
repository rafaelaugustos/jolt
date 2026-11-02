package org.rafaelaugusto.jolt;

/** Premultiplied OKLab; the same scalar/color contract as core/color.ts. */
public final class ColorMath {
    private ColorMath() {}
    public static final class Stop {
        final double l, a, b, alpha;
        final long argb;
        public Stop(long value) {
            argb = value & 0xffffffffL;
            alpha = (argb >>> 24) / 255.0;
            double r = linear(((argb >>> 16) & 255) / 255.0);
            double g = linear(((argb >>> 8) & 255) / 255.0);
            double blue = linear((argb & 255) / 255.0);
            double L = Math.cbrt(.4122214708*r + .5363325363*g + .0514459929*blue);
            double M = Math.cbrt(.2119034982*r + .6806995451*g + .1073969566*blue);
            double S = Math.cbrt(.0883024619*r + .2817188376*g + .6299787005*blue);
            l = .2104542553*L + .793617785*M - .0040720468*S;
            a = 1.9779984951*L - 2.428592205*M + .4505937099*S;
            b = .0259040371*L + .7827717662*M - .808675766*S;
        }
    }
    private static double clamp(double n) { return Math.max(0, Math.min(1,n)); }
    private static double linear(double n) { return n <= .04045 ? n/12.92 : Math.pow((n+.055)/1.055, 2.4); }
    private static long channel(double n) {
        double encoded = n <= .0031308 ? 12.92*n : 1.055*Math.pow(n,1/2.4)-.055;
        return Math.round(clamp(encoded)*255);
    }
    public static long mix(Stop a, Stop b, double progress) {
        double p=clamp(progress);
        if (p==0) return a.argb;
        if (p==1) return b.argb;
        double alpha=a.alpha+(b.alpha-a.alpha)*p;
        if (alpha<=0) return 0;
        double wa=a.alpha*(1-p)/alpha, wb=b.alpha*p/alpha;
        double L=a.l*wa+b.l*wb, A=a.a*wa+b.a*wb, B=a.b*wa+b.b*wb;
        double l=L+.3963377774*A+.2158037573*B, m=L-.1055613458*A-.0638541728*B, s=L-.0894841775*A-1.291485548*B;
        l=l*l*l; m=m*m*m; s=s*s*s;
        return (Math.round(alpha*255)<<24) |
            (channel(4.0767416621*l-3.3077115913*m+.2309699292*s)<<16) |
            (channel(-1.2684380046*l+2.6097574011*m-.3413193965*s)<<8) |
            channel(-.0041960863*l-.7034186147*m+1.707614701*s);
    }
}
