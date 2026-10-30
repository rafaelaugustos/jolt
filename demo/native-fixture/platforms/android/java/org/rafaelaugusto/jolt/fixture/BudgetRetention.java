package org.rafaelaugusto.jolt.fixture;

import android.os.Debug;
import android.view.View;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import org.json.JSONObject;

/** Demo-only weak ownership checks and allocator snapshots, outside timing windows. */
public final class BudgetRetention {
    private final ArrayList<WeakReference<View>> targets = new ArrayList<>();
    public void watch(View view) { targets.add(new WeakReference<>(view)); }
    public void reset() { targets.clear(); }
    public String snapshot() {
        int alive = 0;
        for (WeakReference<View> target : targets) if (target.get() != null) alive++;
        Runtime vm = Runtime.getRuntime();
        try {
            return new JSONObject().put("timeMs", System.nanoTime() / 1e6)
                .put("watched", targets.size()).put("alive", alive)
                .put("javaUsedBytes", vm.totalMemory() - vm.freeMemory())
                .put("nativeAllocatedBytes", Debug.getNativeHeapAllocatedSize()).toString();
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
}
