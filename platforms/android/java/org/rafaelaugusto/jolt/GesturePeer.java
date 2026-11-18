package org.rafaelaugusto.jolt;

import java.util.ArrayList;

/** Native directed failure arbitration; no JavaScript callback participates in deciding a winner. */
public final class GesturePeer {
    private static final int IDLE=0, POSSIBLE=1, ACTIVE=2, FAILED=3, RECOGNIZED=4;
    private int phase=IDLE;
    private long contact=-1;
    private boolean disposed;
    private Runnable ready;
    private final Runnable cancelInput;
    private final ArrayList<Link> links = new ArrayList<>();
    public GesturePeer(Runnable cancelInput) { this.cancelInput=cancelInput; }
    public boolean isActive() { return phase==POSSIBLE || phase==ACTIVE; }
    public boolean isDisposed() { return disposed; }
    public boolean isCoordinated() { return !links.isEmpty(); }
    public void begin(long contact) { if (!disposed) { this.contact=contact; phase=POSSIBLE; ready=null; } }
    public boolean request(Runnable ready) {
        if (disposed || phase==FAILED || phase==RECOGNIZED) return false;
        if (phase==ACTIVE) return true;
        this.ready=ready; return resolve();
    }
    private boolean resolve() {
        if (phase!=POSSIBLE || ready==null) return false;
        for (Link link : new ArrayList<>(links)) {
            if (link.a==null) continue;
            if (link.kind.equals("simultaneous")) continue;
            GesturePeer waits=link.kind.equals("waitFor")?link.a:link.b;
            GesturePeer other=link.kind.equals("waitFor")?link.b:link.a;
            if (waits!=this || other.disposed || other.contact!=contact) continue;
            if (other.phase==ACTIVE || other.phase==RECOGNIZED) { reject(); return false; }
            if (other.phase==POSSIBLE && link.kind.equals("waitFor")) return false;
        }
        phase=ACTIVE; Runnable callback=ready; ready=null;
        for (Link link : new ArrayList<>(links)) {
            if (link.a==null) continue;
            GesturePeer loser=link.kind.equals("block") && link.a==this?link.b:
                link.kind.equals("waitFor") && link.b==this?link.a:null;
            if (loser!=null && loser.contact==contact) loser.reject();
        }
        if (!disposed && phase==ACTIVE) callback.run();
        return phase==ACTIVE;
    }
    public void fail() {
        if (disposed || phase==FAILED || phase==RECOGNIZED) return;
        phase=FAILED; ready=null;
        for (Link link : new ArrayList<>(links)) if(link.a!=null) (link.a==this?link.b:link.a).resolve();
    }
    public void finish() { if (phase==ACTIVE) { phase=RECOGNIZED; ready=null; } else fail(); }
    private void reject() { if (isActive()) { phase=FAILED; ready=null; cancelInput.run(); } }
    public Link connect(GesturePeer other, String kind) {
        if (disposed || other==null || other.disposed || other==this ||
            !(kind.equals("simultaneous")||kind.equals("waitFor")||kind.equals("block")))
            throw new IllegalArgumentException("Invalid gesture relationship");
        Link link=new Link(this,other,kind); links.add(link); other.links.add(link); return link;
    }
    public void dispose() {
        if (disposed) return; reject(); disposed=true;
        for (Link link : new ArrayList<>(links)) link.dispose();
        ready=null;
    }
    public static final class Link {
        private GesturePeer a,b;
        private final String kind;
        private Link(GesturePeer a,GesturePeer b,String kind) { this.a=a;this.b=b;this.kind=kind; }
        public void dispose() {
            if(a==null)return;
            GesturePeer first=a,second=b; a=null;b=null;
            first.links.remove(this);second.links.remove(this);first.reject();second.reject();
        }
    }
}
