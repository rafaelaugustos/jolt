package org.rafaelaugusto.jolt;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.TextPaint;
import android.text.method.TransformationMethod;
import android.text.style.CharacterStyle;
import android.text.style.UpdateAppearance;
import android.view.animation.Interpolator;
import android.view.animation.LinearInterpolator;
import android.view.animation.PathInterpolator;
import android.widget.TextView;
import java.text.BreakIterator;
import java.util.ArrayList;
import java.util.List;

/** Fades a TextView's text in piece by piece. Layout, truncation and the real text stay as they are. */
public final class TextReveal {
    public interface Callback {
        void onEnd(boolean finished);
    }

    private static final int MAX_PIECES = 256;
    private static final Interpolator EASE_OUT = new PathInterpolator(0f, 0f, 0.58f, 1f);
    private final TextView view;
    private final long duration;
    private final long stagger;
    private final long delay;
    private final float offset;
    private final Callback callback;
    private final CharSequence original;
    private final CharSequence shown;
    private final TransformationMethod method;
    private final Piece[] pieces;
    private ValueAnimator animator;
    private boolean settled;

    public TextReveal(TextView view, boolean byWord, long duration, long stagger, long delay, float offset, Callback callback) {
        this.view = view;
        this.duration = Math.max(duration, 1);
        this.stagger = stagger;
        this.delay = delay;
        this.offset = offset;
        this.callback = callback;
        CharSequence text = view.getText();
        this.original = text == null ? "" : text;
        // NativeScript's transformation method rebuilds the displayed text from its own model,
        // so pieces are measured on what is drawn and the spans go on that text.
        this.method = view.getTransformationMethod();
        CharSequence displayed = method != null ? method.getTransformation(original, view) : original;
        this.shown = displayed == null ? "" : displayed;
        this.pieces = split(shown.toString(), byWord);
    }

    public boolean isSupported() {
        return pieces.length <= MAX_PIECES;
    }

    public void start() {
        if (settled || animator != null) return;
        if (pieces.length == 0) {
            settle(true);
            return;
        }
        SpannableStringBuilder spannable = new SpannableStringBuilder(shown);
        for (Piece piece : pieces) {
            piece.alpha = 0f;
            piece.shift = offset;
            spannable.setSpan(piece, piece.start, piece.end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        }
        if (method != null) view.setTransformationMethod(null);
        view.setText(spannable);
        final long total = delay + duration + (pieces.length - 1) * stagger;
        animator = ValueAnimator.ofFloat(0f, 1f);
        animator.setDuration(total);
        animator.setInterpolator(new LinearInterpolator());
        animator.addUpdateListener(new ValueAnimator.AnimatorUpdateListener() {
            @Override
            public void onAnimationUpdate(ValueAnimator animation) {
                update(animation.getAnimatedFraction() * total);
                view.invalidate();
            }
        });
        animator.addListener(new AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(Animator animation) {
                settle(true);
            }
        });
        animator.start();
    }

    public void cancel() {
        settle(false);
    }

    private void update(float time) {
        for (int i = 0; i < pieces.length; i++) {
            float local = (time - delay - i * stagger) / duration;
            float eased = local <= 0f ? 0f : local >= 1f ? 1f : EASE_OUT.getInterpolation(local);
            pieces[i].alpha = eased;
            pieces[i].shift = offset * (1f - eased);
        }
    }

    private void settle(boolean finished) {
        if (settled) return;
        settled = true;
        ValueAnimator running = animator;
        animator = null;
        if (running != null) running.cancel();
        CharSequence current = view.getText();
        // An app change already replaced the spans; its text wins.
        if (current instanceof Spanned && ((Spanned) current).getSpans(0, current.length(), Piece.class).length > 0) {
            view.setText(original);
        }
        if (method != null && view.getTransformationMethod() == null) view.setTransformationMethod(method);
        callback.onEnd(finished);
    }

    private static Piece[] split(String text, boolean byWord) {
        List<Piece> pieces = new ArrayList<>();
        BreakIterator iterator = byWord ? BreakIterator.getWordInstance() : BreakIterator.getCharacterInstance();
        iterator.setText(text);
        int start = iterator.first();
        for (int end = iterator.next(); end != BreakIterator.DONE; start = end, end = iterator.next()) {
            if (byWord ? isWord(text, start, end) : !isBlank(text, start, end)) pieces.add(new Piece(start, end));
        }
        if (byWord) {
            // Spaces and punctuation stay with the word before them, so every visible mark is revealed.
            for (int i = 0; i < pieces.size(); i++) {
                Piece piece = pieces.get(i);
                if (i == 0) piece.start = 0;
                piece.end = i + 1 < pieces.size() ? pieces.get(i + 1).start : text.length();
            }
            if (pieces.isEmpty() && !isBlank(text, 0, text.length())) pieces.add(new Piece(0, text.length()));
        }
        return pieces.toArray(new Piece[0]);
    }

    private static boolean isWord(String text, int start, int end) {
        for (int i = start; i < end; ) {
            int point = text.codePointAt(i);
            if (Character.isLetterOrDigit(point)) return true;
            i += Character.charCount(point);
        }
        return false;
    }

    private static boolean isBlank(String text, int start, int end) {
        for (int i = start; i < end; ) {
            int point = text.codePointAt(i);
            if (!Character.isWhitespace(point) && !Character.isSpaceChar(point)) return false;
            i += Character.charCount(point);
        }
        return true;
    }

    /** Only changes how its range is drawn, so the TextView's layout never sees it. */
    private static final class Piece extends CharacterStyle implements UpdateAppearance {
        int start;
        int end;
        float alpha;
        float shift;

        Piece(int start, int end) {
            this.start = start;
            this.end = end;
        }

        @Override
        public void updateDrawState(TextPaint paint) {
            paint.setAlpha(Math.round(paint.getAlpha() * alpha));
            paint.baselineShift += Math.round(shift);
        }
    }
}
