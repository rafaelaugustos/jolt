package org.rafaelaugusto.jolt;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONException;

/** Immutable DAG; storage is allocated at setup, never during a frame. */
final class ScalarProgram {
    private final String[] operations;
    private final int[] a, b;
    private final double[] constants, maximum, values, velocities;
    private final double[][] input, output;
    private final boolean[] clamp;
    ScalarProgram(String json, int sources) {
        try {
            JSONArray list = new JSONArray(json);
            int count = list.length();
            if (count < 1 || count > 1024) throw new IllegalArgumentException("Scalar graph size");
            operations = new String[count]; a = new int[count]; b = new int[count];
            constants = new double[count]; maximum = new double[count]; values = new double[count]; velocities = new double[count];
            input = new double[count][]; output = new double[count][]; clamp = new boolean[count];
            for (int i=0; i<count; i++) {
                JSONObject node = list.getJSONObject(i); String op = operations[i] = node.getString("op");
                a[i] = node.optInt("a", 0); b[i] = node.optInt("b", -1);
                constants[i] = node.optDouble("value", 0); maximum[i] = node.optDouble("maximum", 0);
                if (!op.equals("constant") && (a[i] < 0 || a[i] >= (op.equals("input") ? sources : i))) throw new IllegalArgumentException("Cyclic scalar graph");
                if (b[i] < -1 || b[i] >= i) throw new IllegalArgumentException("Cyclic scalar graph");
                if (op.equals("map")) {
                    input[i] = array(node.getJSONArray("input")); output[i] = array(node.getJSONArray("output")); clamp[i] = node.getBoolean("clamp");
                    if (input[i].length < 2 || input[i].length != output[i].length) throw new IllegalArgumentException("Scalar map size");
                }
            }
        } catch (JSONException error) { throw new IllegalArgumentException(error); }
    }
    private static double[] array(JSONArray array) throws JSONException {
        double[] result = new double[array.length()];
        for (int i=0; i<result.length; i++) result[i]=array.getDouble(i);
        return result;
    }
    void evaluate(double[] sourceValues, double[] sourceVelocities) {
        for (int i=0; i<operations.length; i++) {
            String op = operations[i];
            boolean reads = !op.equals("input") && !op.equals("constant");
            double x = reads ? values[a[i]] : 0, xv = reads ? velocities[a[i]] : 0, y = b[i] < 0 ? 0 : values[b[i]], yv = b[i] < 0 ? 0 : velocities[b[i]];
            double value = 0, velocity = 0;
            switch (op) {
                case "input": value=sourceValues[a[i]]; velocity=sourceVelocities[a[i]]; break;
                case "constant": value=constants[i]; break;
                case "map": {
                    double[] in=input[i], out=output[i];
                    if (clamp[i] && x<=in[0]) { value=out[0]; break; }
                    if (clamp[i] && x>=in[in.length-1]) { value=out[out.length-1]; break; }
                    int k=0; while(k<in.length-2 && x>in[k+1]) k++;
                    double slope=(out[k+1]-out[k])/(in[k+1]-in[k]);
                    value=out[k]+(x-in[k])*slope; velocity=xv*slope; break;
                }
                case "add": value=x+y; velocity=xv+yv; break;
                case "sub": value=x-y; velocity=xv-yv; break;
                case "mul": value=x*y; velocity=xv*y+x*yv; break;
                case "div": if(y!=0) { value=x/y; velocity=(xv*y-x*yv)/(y*y); } break;
                case "min": value=Math.min(x,y); velocity=x<y?xv:x>y?yv:0; break;
                case "max": value=Math.max(x,y); velocity=x>y?xv:x<y?yv:0; break;
                case "clamp": value=Math.min(maximum[i],Math.max(y,x)); velocity=x<=y||x>=maximum[i]?0:xv; break;
                case "abs": value=Math.abs(x); velocity=Math.signum(x)*xv; break;
                case "sin": value=Math.sin(x); velocity=Math.cos(x)*xv; break;
                case "cos": value=Math.cos(x); velocity=-Math.sin(x)*xv; break;
                case "velocity": value=xv; break;
                default: throw new IllegalArgumentException("Unknown scalar operation: "+op);
            }
            velocities[i]=Double.isFinite(value)&&Double.isFinite(velocity)?velocity:0;
            values[i]=Double.isFinite(value)?value:0;
        }
    }
    double value() { return values[values.length-1]; }
    double velocity() { return velocities[velocities.length-1]; }
}
