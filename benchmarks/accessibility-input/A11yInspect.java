import android.app.UiAutomation;
import android.os.HandlerThread;
import android.os.Looper;
import android.view.accessibility.AccessibilityNodeInfo;
import android.graphics.Rect;
import org.json.JSONArray;
import org.json.JSONObject;

/** Read-only shell probe. Keeps TalkBack running; never requests accessibility focus. */
public final class A11yInspect {
    private static JSONObject node(AccessibilityNodeInfo n) throws Exception {
        JSONObject o=new JSONObject(); Rect r=new Rect(); n.getBoundsInScreen(r);
        o.put("id",n.getViewIdResourceName()); o.put("text",n.getText()); o.put("label",n.getContentDescription());
        o.put("focused",n.isAccessibilityFocused()); o.put("visible",n.isVisibleToUser()); o.put("class",n.getClassName());
        o.put("heading",n.isHeading()); o.put("clickable",n.isClickable());
        o.put("bounds",new JSONArray(new int[]{r.left,r.top,r.right,r.bottom}));
        JSONArray c=new JSONArray(); for(int i=0;i<n.getChildCount();i++){AccessibilityNodeInfo v=n.getChild(i);if(v!=null)c.put(node(v));}o.put("children",c);return o;
    }
    public static void main(String[] args) throws Exception {
        Looper.prepareMainLooper();
        HandlerThread t=new HandlerThread("jolt-a11y");t.start();
        Class<?> connection=Class.forName("android.app.UiAutomationConnection");
        UiAutomation u=(UiAutomation)UiAutomation.class.getConstructor(Looper.class,Class.forName("android.app.IUiAutomationConnection")).newInstance(t.getLooper(),connection.getConstructor().newInstance());
        UiAutomation.class.getMethod("connect",int.class).invoke(u,UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES);
        try {
            Thread.sleep(250); AccessibilityNodeInfo root=u.getRootInActiveWindow();System.out.println(root==null?"null":node(root).toString());
        }
        finally {UiAutomation.class.getMethod("disconnect").invoke(u);t.quitSafely();}
    }
}
