package org.rafaelaugusto.jolt;

import android.graphics.*;
import android.graphics.drawable.Drawable;
import java.util.*;
import org.json.*;

/** One retained, non-interactive drawing surface. No per-item View or animator. */
public final class BatchDrawing extends Drawable {
    private static int live;
    public static int liveCount() { return live; }
    private static final class Style {
        final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG), stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
        final boolean evenodd;
        Style(JSONObject o) throws JSONException {
            fill.setColor((int)o.getLong("fill")); fill.setStyle(Paint.Style.FILL);
            stroke.setColor((int)o.getLong("stroke")); stroke.setStyle(Paint.Style.STROKE);
            stroke.setStrokeWidth((float)o.getDouble("width"));
            stroke.setStrokeCap(Paint.Cap.valueOf(o.getString("cap").toUpperCase(Locale.ROOT)));
            stroke.setStrokeJoin(Paint.Join.valueOf(o.getString("join").toUpperCase(Locale.ROOT)));
            evenodd = o.getString("rule").equals("evenodd");
        }
    }
    private static final class Item {
        final String id, style;
        final Path path = new Path();
        final float[] primitive;
        Item(JSONObject o, float[] v) throws JSONException {
            id = o.getString("id"); style = o.getString("style");
            JSONArray p=o.optJSONArray("primitive");
            primitive=p==null?null:new float[p.length()];
            if(p!=null) {
                if(p.length()!=3 && p.length()!=4) throw new IllegalArgumentException("Invalid drawing primitive");
                for(int j=0;j<p.length();j++) primitive[j]=(float)p.getDouble(j);
            }
            String commands = o.getString("commands"); int offset=o.getInt("offset"), count=o.getInt("count");
            if(commands.length()>256 || count>1536 || offset<0 || count<0 || offset+count>v.length) throw new IllegalArgumentException("Drawing item budget exceeded");
            int i=offset;
            for(int c=0;c<commands.length();c++) switch(commands.charAt(c)) {
                case 'M': path.moveTo(v[i++],v[i++]); break;
                case 'L': path.lineTo(v[i++],v[i++]); break;
                case 'C': path.cubicTo(v[i++],v[i++],v[i++],v[i++],v[i++],v[i++]); break;
                case 'Q': path.quadTo(v[i++],v[i++],v[i++],v[i++]); break;
                case 'Z': path.close(); break;
                default: throw new IllegalArgumentException("Invalid drawing command");
            }
            if(i!=offset+count) throw new IllegalArgumentException("Invalid drawing points");
        }
        void draw(Canvas canvas, Paint paint) {
            if(primitive==null) canvas.drawPath(path,paint);
            else if(primitive.length==3) canvas.drawCircle(primitive[0],primitive[1],primitive[2],paint);
            else canvas.drawRect(primitive[0],primitive[1],primitive[0]+primitive[2],primitive[1]+primitive[3],paint);
        }
    }
    private Map<String,Item> items = new HashMap<>();
    private Map<String,Style> styles = new HashMap<>();
    private List<Item> order = new ArrayList<>();
    private float[] box = {0,0,1,1};
    private boolean disposed;
    public BatchDrawing() { live++; }
    public void apply(String program, float[] points) {
        if(disposed) throw new IllegalStateException("Drawing is disposed");
        if(program.length()>2097152) throw new IllegalArgumentException("Drawing payload budget exceeded");
        try {
            JSONObject o = new JSONObject(program);
            JSONArray list=o.getJSONArray("items"), sequence=o.optJSONArray("order"), paint=o.optJSONArray("styles"), b=o.getJSONArray("viewBox");
            if(list.length()>1024 || (sequence!=null && sequence.length()>1024) || (paint!=null && paint.length()>64)) throw new IllegalArgumentException("Drawing item/style budget exceeded");
            Map<String,Item> nextItems = new HashMap<>(items);
            Map<String,Style> nextStyles = paint==null ? styles : new HashMap<>();
            List<Item> nextOrder = new ArrayList<>();
            for(int i=0;paint!=null && i<paint.length();i++) { JSONObject s=paint.getJSONObject(i); nextStyles.put(s.getString("id"), new Style(s)); }
            for(int i=0;i<list.length();i++) { Item item=new Item(list.getJSONObject(i), points); nextItems.put(item.id,item); }
            Set<String> retained = new HashSet<>();
            for(int i=0;i<(sequence==null ? order.size() : sequence.length());i++) {
                String id=sequence==null ? order.get(i).id : sequence.getString(i); Item item=nextItems.get(id);
                if(item==null || !nextStyles.containsKey(item.style) || !retained.add(id)) throw new IllegalArgumentException("Invalid drawing identity/style");
                nextOrder.add(item);
            }
            float[] nextBox=new float[4]; for(int i=0;i<4;i++) nextBox[i]=(float)b.getDouble(i);
            if(nextBox[2]<=0 || nextBox[3]<=0) throw new IllegalArgumentException("Invalid drawing viewBox");
            nextItems.keySet().retainAll(retained);
            for(Item item:nextOrder) {
                Path.FillType type=nextStyles.get(item.style).evenodd?Path.FillType.EVEN_ODD:Path.FillType.WINDING;
                if(item.path.getFillType()!=type) item.path.setFillType(type);
            }
            items=nextItems; styles=nextStyles; order=nextOrder; box=nextBox;
            invalidateSelf();
        } catch(JSONException e) { throw new IllegalArgumentException(e); }
    }
    @Override public void draw(Canvas canvas) {
        Rect b=getBounds(); if(disposed || b.width()<=0 || b.height()<=0) return;
        float scale=Math.min(b.width()/box[2],b.height()/box[3]);
        int save=canvas.save(); canvas.clipRect(b);
        canvas.translate(b.exactCenterX()-box[2]*scale/2,b.exactCenterY()-box[3]*scale/2);
        canvas.scale(scale,scale); canvas.translate(-box[0],-box[1]);
        for(Item item:order) {
            Style style=styles.get(item.style);
            if(style.fill.getAlpha()>0) item.draw(canvas,style.fill);
            if(style.stroke.getAlpha()>0 && style.stroke.getStrokeWidth()>0) {
                // Rectangle path joins follow the declared round/bevel/miter style.
                if(item.primitive!=null && item.primitive.length==3) item.draw(canvas,style.stroke);
                else canvas.drawPath(item.path,style.stroke);
            }
        }
        canvas.restoreToCount(save);
    }
    public void dispose() { if(disposed)return; disposed=true; live--; items.clear(); order.clear(); styles.clear(); setCallback(null); }
    @Override public void setAlpha(int alpha) {}
    @Override public void setColorFilter(ColorFilter filter) {}
    @Override public int getOpacity() { return PixelFormat.TRANSLUCENT; }
}
