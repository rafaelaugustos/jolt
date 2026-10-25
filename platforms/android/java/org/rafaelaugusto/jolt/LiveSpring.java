package org.rafaelaugusto.jolt;

import android.os.SystemClock;
import android.view.Choreographer;
import android.view.View;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Persistent native follower graph. The frame callback never enters JavaScript. */
public final class LiveSpring {
    private static final ArrayList<LiveSpring> nodes = new ArrayList<>();
    private static boolean scheduled;
    private static long previousFrame;
    private static final Choreographer.FrameCallback clock = new Choreographer.FrameCallback() {
        @Override public void doFrame(long nanos) {
            scheduled = false;
            double now = nanos / 1e6;
            double remaining = previousFrame == 0 ? 1.0 / 120 : Math.min(.064, Math.max(0, (nanos - previousFrame) / 1e9));
            previousFrame = nanos;
            // Older nodes precede their followers. Substeps bound chain phase error at 60/120Hz.
            while (remaining > 1e-9) {
                double dt = Math.min(remaining, 1.0 / 240);
                remaining -= dt;
                for (int i = 0; i < nodes.size(); i++) nodes.get(i).step(now - remaining * 1000, dt);
            }
            boolean active = false;
            for (int i = 0; i < nodes.size(); i++) {
                LiveSpring node = nodes.get(i);
                node.apply();
                active |= node.moving || node.layersMoving(now);
            }
            if (active) schedule(); else previousFrame = 0;
        }
    };
    private static void schedule() {
        if (scheduled || nodes.isEmpty()) return;
        scheduled = true;
        Choreographer.getInstance().postFrameCallback(clock);
    }

    private final SpringState state;
    private final double stiffness, damping, mass, restDelta, restSpeed;
    private final ArrayList<Binding> bindings = new ArrayList<>();
    private LiveSpring source;
    private Mapping[] sourceMaps = new Mapping[0];
    private SampledInput input;
    private boolean direct = true;
    private double targetValue;
    private boolean moving, reduced, disposed, paused, inputHeld, sensorInput;

    public LiveSpring(double initial, double stiffness, double damping, double mass,
                      double restDelta, double restSpeed, boolean reduced) {
        state = new SpringState(initial, 0);
        this.stiffness = stiffness; this.damping = damping; this.mass = mass;
        this.restDelta = restDelta; this.restSpeed = restSpeed; this.reduced = reduced;
        targetValue = initial;
        nodes.add(this);
    }
    public double getPosition() { return state.position; }
    public double getVelocity() { return state.velocity; }
    public boolean isMoving() { return moving; }
    public static int activeCount() { return scheduled ? 1 : 0; }
    public static int nodeCount() { return nodes.size(); }

    public void follow(LiveSpring parent, String mappings) {
        if (disposed || parent.disposed || nodes.indexOf(parent) >= nodes.indexOf(this))
            throw new IllegalArgumentException("A spring can only follow an existing live node");
        sourceMaps = maps(mappings);
        source = parent;
        wake();
    }
    public void updateInput(String snapshot) {
        if (disposed) return;
        try { input = new SampledInput(new JSONObject(snapshot)); }
        catch (JSONException error) { throw new IllegalArgumentException(error); }
        sensorInput = false; direct = false;
        wake();
    }
    public void setSensorInput(double value) {
        if (disposed || !Double.isFinite(value) || (sensorInput && inputHeld && state.position == value)) return;
        sensorInput = true; inputHeld = true; direct = true; targetValue = value; input = null;
        state.position = value; state.velocity = 0; moving = false;
        schedule();
    }
    public void setTarget(double value) {
        if (disposed) return;
        sensorInput = false; direct = true; targetValue = value; input = null;
        wake();
    }
    public void holdInput(double value, double velocity) {
        if (disposed) return;
        sensorInput = false; inputHeld = true; direct = true; targetValue = value; input = null;
        state.position = value; state.velocity = velocity; moving = true;
        apply(); schedule();
    }
    public void releaseInput(double target, double velocity) {
        if (disposed) return;
        inputHeld = false; state.velocity = velocity; setTarget(target);
    }
    public void setReduced(boolean value) { reduced = value; wake(); }
    public void setPaused(boolean value) {
        paused = value;
        if (value) moving = false; else wake();
    }
    private void wake() {
        // Sensor inputs are held data; policy changes must not start an endless frame clock.
        if (disposed || paused || sensorInput) return;
        moving = true;
        if (reduced) { step(SystemClock.uptimeMillis(), 0); apply(); }
        schedule();
    }
    private void step(double now, double dt) {
        if (disposed || paused || inputHeld) return;
        double target = source == null ? (direct ? targetValue : input.value(now)) : map(source.state.position, sourceMaps);
        boolean inputMoving = source == null ? !direct && input.running(now) : source.moving;
        if (reduced) { state.position = target; state.velocity = 0; }
        else state.advance(target, stiffness, damping, mass, dt);
        boolean rest = Math.abs(state.position - target) <= restDelta && Math.abs(state.velocity) <= restSpeed;
        if (rest && !inputMoving) { state.position = target; state.velocity = 0; }
        moving = inputMoving || !rest;
    }
    public Binding bind(View view, String property, String mappings) {
        if (disposed) throw new IllegalStateException("Spring disposed");
        Binding binding = new Binding(view, property, maps(mappings));
        bindings.add(binding);
        binding.apply();
        return binding;
    }
    private void apply() {
        for (int i = bindings.size() - 1; i >= 0; i--) {
            Binding binding = bindings.get(i);
            if (binding.view.get() == null) bindings.remove(i); else binding.apply();
        }
    }
    private boolean layersMoving(double now) {
        for (int i = 0; i < bindings.size(); i++)
            for (SampledInput layer : bindings.get(i).layers)
                if (layer.running(now)) return true;
        return false;
    }
    public static void sync(View view) {
        for (int i = 0; i < nodes.size(); i++) {
            LiveSpring node = nodes.get(i);
            for (int j = 0; j < node.bindings.size(); j++) {
                Binding binding = node.bindings.get(j);
                if (binding.view.get() == view) binding.apply();
            }
        }
    }
    public void dispose() {
        if (disposed) return;
        disposed = true; moving = false;
        bindings.clear();
        nodes.remove(this);
        // A retained child continues from its own state toward the parent's last value.
        for (int i = 0; i < nodes.size(); i++) {
            LiveSpring child = nodes.get(i);
            if (child.source == this) {
                child.source = null;
                child.setTarget(map(state.position, child.sourceMaps));
            }
        }
        source = null;
        if (nodes.isEmpty() && scheduled) {
            Choreographer.getInstance().removeFrameCallback(clock);
            scheduled = false; previousFrame = 0;
        }
    }

    public final class Binding {
        private final WeakReference<View> view;
        private final String property;
        private final Mapping[] mappings;
        private final float density;
        private boolean stopped;
        private SampledInput[] layers = new SampledInput[0];
        Binding(View view, String property, Mapping[] mappings) {
            this.view = new WeakReference<>(view); this.property = property; this.mappings = mappings;
            density = view.getResources().getDisplayMetrics().density;
        }
        public double getValue() { return map(state.position, mappings); }
        public void setLayers(String inputs) {
            try {
                JSONArray array = new JSONArray(inputs);
                SampledInput[] next = new SampledInput[array.length()];
                for (int i = 0; i < next.length; i++) next[i] = new SampledInput(array.getJSONObject(i));
                layers = next;
            } catch (JSONException error) { throw new IllegalArgumentException(error); }
            apply(); schedule();
        }
        public void cancel() { stopped = true; bindings.remove(this); }
        private void apply() {
            View target = view.get();
            if (stopped || target == null || !target.isAttachedToWindow()) return;
            double composed = getValue();
            boolean multiply = property.equals("opacity") || property.startsWith("scale");
            double now = SystemClock.uptimeMillis();
            for (SampledInput layer : layers) composed = multiply ? composed * layer.value(now) : composed + layer.value(now);
            float value = (float)composed;
            switch (property) {
                case "x": target.setTranslationX(value * density); break;
                case "y": target.setTranslationY(value * density); break;
                case "scaleX": target.setScaleX(value); break;
                case "scaleY": target.setScaleY(value); break;
                case "rotate": target.setRotation(value); break;
                case "rotateX": target.setRotationX(value); break;
                case "rotateY": target.setRotationY(value); break;
                case "opacity": target.setAlpha(Math.max(0, Math.min(1, value))); break;
                default: throw new IllegalArgumentException("Unsupported live property " + property);
            }
        }
    }
    private static final class Mapping {
        final double[] input, output;
        final boolean clamp;
        Mapping(JSONObject json) throws JSONException {
            input = array(json.getJSONArray("input")); output = array(json.getJSONArray("output"));
            clamp = json.getBoolean("clamp");
        }
        double value(double value) {
            if (clamp && value <= input[0]) return output[0];
            if (clamp && value >= input[input.length - 1]) return output[output.length - 1];
            int index = 0;
            while (index < input.length - 2 && value > input[index + 1]) index++;
            double span = input[index + 1] - input[index];
            double fraction = span > 0 ? (value - input[index]) / span : value < input[index] ? 0 : 1;
            return output[index] + (output[index + 1] - output[index]) * fraction;
        }
    }
    private static Mapping[] maps(String json) {
        try {
            JSONArray array = new JSONArray(json);
            Mapping[] result = new Mapping[array.length()];
            for (int i = 0; i < result.length; i++) result[i] = new Mapping(array.getJSONObject(i));
            return result;
        } catch (JSONException error) { throw new IllegalArgumentException(error); }
    }
    private static double map(double value, Mapping[] maps) {
        for (Mapping mapping : maps) value = mapping.value(value);
        return value;
    }
    private static double[] array(JSONArray input) throws JSONException {
        double[] result = new double[input.length()];
        for (int i = 0; i < result.length; i++) result[i] = input.getDouble(i);
        return result;
    }
    private static final class SampledInput {
        final double value, anchor, elapsed, duration, delay, repeat, end;
        final double[] values, times;
        final boolean reverse, playing;
        SampledInput(JSONObject json) throws JSONException {
            value = json.getDouble("value");
            anchor = SystemClock.uptimeMillis(); elapsed = json.getDouble("elapsed");
            playing = json.getBoolean("running");
            duration = json.getDouble("duration"); delay = json.getDouble("delay");
            repeat = json.getDouble("repeat"); end = json.getDouble("to");
            reverse = json.getBoolean("reverse");
            values = array(json.getJSONArray("values")); times = array(json.getJSONArray("times"));
        }
        boolean running(double now) { return playing && (repeat < 0 || now - anchor + elapsed < delay + duration * (repeat + 1)); }
        double value(double now) {
            if (!playing || values.length < 2) return value;
            if (!running(now)) return end;
            double time = Math.max(0, now - anchor + elapsed - delay);
            double iteration = Math.floor(time / Math.max(1, duration));
            double progress = (time % Math.max(1, duration)) / Math.max(1, duration);
            if (reverse && iteration % 2 >= 1) progress = 1 - progress;
            int lo = 0, hi = times.length - 1;
            while (lo + 1 < hi) { int mid = (lo + hi) / 2; if (times[mid] <= progress) lo = mid; else hi = mid; }
            double fraction = times[hi] > times[lo] ? (progress - times[lo]) / (times[hi] - times[lo]) : 1;
            return values[lo] + (values[hi] - values[lo]) * Math.max(0, Math.min(1, fraction));
        }
    }
}
