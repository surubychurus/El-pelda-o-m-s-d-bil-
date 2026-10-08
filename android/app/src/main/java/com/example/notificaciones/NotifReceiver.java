package com.example.notificaciones;

import android.app.RemoteInput;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

/** Recibe las alarmas (mostrar notificación), los botones y el arranque del sistema. */
public class NotifReceiver extends BroadcastReceiver {
    static final String ACTION_SHOW = "com.example.notificaciones.SHOW";
    static final String ACTION_BTN = "com.example.notificaciones.BTN";

    @Override
    public void onReceive(Context c, Intent in) {
        String a = in.getAction();
        try {
            if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) {
                NotifCore.rescheduleAll(c);
            } else if (ACTION_SHOW.equals(a)) {
                onShow(c, in.getIntExtra("id", -1));
            } else if (ACTION_BTN.equals(a)) {
                onButton(c, in);
            }
        } catch (Exception e) {
            android.util.Log.e("RichNotif", "receiver", e);
        }
    }

    private void onShow(Context c, int id) throws Exception {
        JSONObject n = NotifCore.getPending(c, id);
        if (n == null) return;
        String rep = n.optString("repeat", "");
        JSONObject toShow = new JSONObject(n.toString());
        if (rep.isEmpty()) {
            NotifCore.cancelPending(c, id);
        } else {
            n.put("at", NotifCore.nextAt(n.getLong("at"), rep));
            NotifCore.schedule(c, n);
        }
        NotifCore.show(c, toShow);
    }

    private void onButton(Context c, Intent in) throws Exception {
        int id = in.getIntExtra("id", -1);
        String kind = in.getStringExtra("kind"), label = in.getStringExtra("label");
        int minutes = in.getIntExtra("minutes", 10);
        JSONObject n = new JSONObject(in.getStringExtra("n"));
        NotificationManagerCompat nm = NotificationManagerCompat.from(c);
        String text = null;
        int group = id / 100;

        switch (kind) {
            case "snooze": {
                nm.cancel(id);
                JSONObject s = new JSONObject(n.toString());
                s.put("id", group * 100 + NotifCore.SLOT_SNOOZE).put("at", System.currentTimeMillis() + minutes * 60000L).put("repeat", "");
                NotifCore.schedule(c, s);
                break;
            }
            case "timer": {
                nm.cancel(id);
                JSONObject t = new JSONObject(n.toString());
                t.put("id", group * 100 + NotifCore.SLOT_TIMER).put("title", "⏱ " + n.optString("title")).put("repeat", "")
                        .put("chrono", new JSONObject().put("mode", "down").put("minutes", minutes))
                        .put("buttons", new JSONArray().put(new JSONObject().put("title", "Cancelar").put("kind", "cancel")))
                        .put("image", "").put("ongoing", false);
                NotifCore.show(c, t);
                break;
            }
            case "cancel":
                nm.cancel(id);
                NotifCore.cancelPending(c, group * 100 + NotifCore.SLOT_END);
                break;
            case "reply": {
                Bundle r = RemoteInput.getResultsFromIntent(in);
                text = r == null ? null : String.valueOf(r.getCharSequence(NotifCore.KEY_REPLY));
                NotificationCompat.Builder b = new NotificationCompat.Builder(c, NotifCore.ensureChannel(c, 3))
                        .setSmallIcon(c.getResources().getIdentifier(n.optString("icon", "ic_stat_notif"), "drawable", c.getPackageName()))
                        .setContentTitle(n.optString("title")).setContentText("✔ Respondido: " + text)
                        .setTimeoutAfter(4000).setAutoCancel(true).setOnlyAlertOnce(true);
                try { nm.notify(id, b.build()); } catch (SecurityException ignored) {}
                break;
            }
            default: // "read": marcar como leído = quitar la notificación sin abrir la app
                nm.cancel(id);
        }
        NotifCore.addEvent(c, new JSONObject().put("t", System.currentTimeMillis()).put("id", id)
                .put("title", n.optString("title")).put("label", label).put("kind", kind)
                .put("text", text == null ? "" : text));
    }
}
