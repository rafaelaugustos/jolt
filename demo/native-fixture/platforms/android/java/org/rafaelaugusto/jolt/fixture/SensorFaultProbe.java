package org.rafaelaugusto.jolt.fixture;

import android.hardware.SensorManager;
import android.hardware.SensorEventListener;
import java.lang.reflect.Field;

/** Demo-only fault injection. Stop real OS delivery without changing Jolt state.
 * The production watchdog must report no-data, release work and recover on play().
 * This is a controlled service dropout, not a user revoking an Android permission.
 */
public final class SensorFaultProbe {
    public static void stopDelivery() {
        try {
            Class<?> type = Class.forName("org.rafaelaugusto.jolt.SensorSource");
            Field manager = type.getDeclaredField("manager"), listener = type.getDeclaredField("hardware");
            manager.setAccessible(true); listener.setAccessible(true);
            ((SensorManager)manager.get(null)).unregisterListener((SensorEventListener)listener.get(null));
        } catch (Exception error) { throw new IllegalStateException(error); }
    }
}
