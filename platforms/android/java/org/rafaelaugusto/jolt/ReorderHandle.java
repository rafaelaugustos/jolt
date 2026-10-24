package org.rafaelaugusto.jolt;

import android.content.Context;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.widget.Button;

/** A keyboard-focusable button that shares its pointer stream with its list. */
public final class ReorderHandle extends Button {
    public interface MoveListener { void move(int direction); }
    private MoveListener move;
    private ReorderSession session;
    public ReorderHandle(Context context) { super(context); setFocusable(true); setFocusableInTouchMode(true); }
    public void setMoveListener(MoveListener value) { move = value; }
    void setSession(ReorderSession value) { session = value; }
    @Override public boolean dispatchTouchEvent(MotionEvent event) {
        if (event.getActionMasked() == MotionEvent.ACTION_DOWN) requestFocus();
        if (session != null && session.handleTouch(this, event)) {
            MotionEvent cancel = MotionEvent.obtain(event); cancel.setAction(MotionEvent.ACTION_CANCEL);
            super.dispatchTouchEvent(cancel); cancel.recycle(); return true;
        }
        return super.dispatchTouchEvent(event);
    }
    @Override public boolean onKeyDown(int code, KeyEvent event) {
        if (event.isAltPressed() && move != null && (code == KeyEvent.KEYCODE_DPAD_UP || code == KeyEvent.KEYCODE_DPAD_DOWN)) {
            if (event.getRepeatCount() == 0) move.move(code == KeyEvent.KEYCODE_DPAD_UP ? -1 : 1);
            return true;
        }
        return super.onKeyDown(code, event);
    }
}
