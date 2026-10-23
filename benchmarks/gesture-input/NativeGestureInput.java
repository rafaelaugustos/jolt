import android.os.SystemClock;
import android.view.InputDevice;
import android.view.InputEvent;
import android.view.MotionEvent;
import java.lang.reflect.Method;

/** Shell-only test helper: injects real OS multi-pointer events into a dedicated emulator. */
public final class NativeGestureInput {
    private static Object manager;
    private static Method inject;
    private static long down;
    private static void send(int action, float... positions) throws Exception {
        int count = positions.length / 2;
        MotionEvent.PointerProperties[] properties = new MotionEvent.PointerProperties[count];
        MotionEvent.PointerCoords[] coordinates = new MotionEvent.PointerCoords[count];
        for (int i = 0; i < count; i++) {
            properties[i] = new MotionEvent.PointerProperties(); properties[i].id = i; properties[i].toolType = MotionEvent.TOOL_TYPE_FINGER;
            coordinates[i] = new MotionEvent.PointerCoords(); coordinates[i].x = positions[i * 2]; coordinates[i].y = positions[i * 2 + 1]; coordinates[i].pressure = 1; coordinates[i].size = .04f;
        }
        MotionEvent event = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, count, properties, coordinates, 0, 0, 1, 1, 0, 0, InputDevice.SOURCE_TOUCHSCREEN, 0);
        if (!((Boolean)inject.invoke(manager, event, 2))) throw new IllegalStateException("Input injection failed");
        event.recycle(); SystemClock.sleep(16);
    }
    public static void main(String[] args) throws Exception {
        Class<?> type;
        try { type = Class.forName("android.hardware.input.InputManagerGlobal"); }
        catch (ClassNotFoundException older) { type = Class.forName("android.hardware.input.InputManager"); }
        manager = type.getMethod("getInstance").invoke(null);
        inject = type.getMethod("injectInputEvent", InputEvent.class, int.class);
        float cx = Float.parseFloat(args[0]), cy = Float.parseFloat(args[1]);
        if (args.length > 2 && args[2].equals("double")) {
            down = SystemClock.uptimeMillis(); send(MotionEvent.ACTION_DOWN, cx, cy); send(MotionEvent.ACTION_UP, cx, cy);
            SystemClock.sleep(70);
            down = SystemClock.uptimeMillis(); send(MotionEvent.ACTION_DOWN, cx, cy); send(MotionEvent.ACTION_UP, cx, cy);
            return;
        }
        boolean cancel = args.length > 2 && args[2].equals("cancel");
        down = SystemClock.uptimeMillis();
        float x = cx - 100, y = cy;
        send(MotionEvent.ACTION_DOWN, x, y);
        for (int i = 1; i <= 20; i++) send(MotionEvent.ACTION_MOVE, x + i * 2, y - i);
        x += 40; y -= 20;
        if (cancel) { send(MotionEvent.ACTION_CANCEL, x, y); return; }
        float secondX = x + 200, secondY = y;
        send(MotionEvent.ACTION_POINTER_DOWN | (1 << MotionEvent.ACTION_POINTER_INDEX_SHIFT), x, y, secondX, secondY);
        float finalX = x, finalY = y, otherX = secondX, otherY = secondY;
        for (int i = 1; i <= 50; i++) {
            double t = i / 50.0, angle = t * Math.PI / 6, radius = 100 * (1 + .5 * t);
            double centerX = x + 100 + 80 * t, centerY = y - 50 * t;
            finalX = (float)(centerX - Math.cos(angle) * radius); finalY = (float)(centerY - Math.sin(angle) * radius);
            otherX = (float)(centerX + Math.cos(angle) * radius); otherY = (float)(centerY + Math.sin(angle) * radius);
            send(MotionEvent.ACTION_MOVE, finalX, finalY, otherX, otherY);
        }
        send(MotionEvent.ACTION_POINTER_UP | (1 << MotionEvent.ACTION_POINTER_INDEX_SHIFT), finalX, finalY, otherX, otherY);
        for (int i = 1; i <= 20; i++) send(MotionEvent.ACTION_MOVE, finalX + i * 2, finalY + i);
        send(MotionEvent.ACTION_UP, finalX + 40, finalY + 20);
    }
}
