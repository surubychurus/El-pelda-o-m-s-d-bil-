package com.example.notificaciones;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.RemoteInput;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.Calendar;

/** Programación, persistencia y construcción de notificaciones. */
public final class NotifCore {
    static final String KEY_REPLY = "reply_text";
    static final int SLOT_TIMER = 97, SLOT_END = 98, SLOT_SNOOZE = 99;

    private NotifCore() {}

    // ---------- persistencia ----------
    private static SharedPreferences sp(Context c) {
        return c.getSharedPreferences("rn", Context.MODE_PRIVATE);
    }

    static synchronized JSONObject pending(Context c) {
        try { return new JSONObject(sp(c).getString("pending", "{}")); } catch (Exception e) { return new JSONObject(); }
    }

    static synchronized void savePending(Context c, JSONObject all) {
        sp(c).edit().putString("pending", all.toString()).apply();
    }

    static synchronized JSONObject getPending(Context c, int id) {
        return pending(c).optJSONObject(String.valueOf(id));
    }

    static synchronized void addEvent(Context c, JSONObject ev) {
        try {
            JSONArray old = new JSONArray(sp(c).getString("events", "[]"));
            JSONArray out = new JSONArray();
            out.put(ev);
            for (int i = 0; i < old.length() && i < 49; i++) out.put(old.get(i));
            sp(c).edit().putString("events", out.toString()).apply();
        } catch (Exception ignored) {}
        RichNotifPlugin.emit(ev);
    }

    static String events(Context c) { return sp(c).getString("events", "[]"); }
    static void clearEvents(Context c) { sp(c).edit().putString("events", "[]").apply(); }

    // ---------- alarmas ----------
    private static PendingIntent showIntent(Context c, int id) {
        Intent i = new Intent(c, NotifReceiver.class).setAction(NotifReceiver.ACTION_SHOW)
                .setData(Uri.parse("rn://show/" + id)).putExtra("id", id);
        return PendingIntent.getBroadcast(c, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static void schedule(Context c, JSONObject n) {
        try {
            int id = n.getInt("id");
            long at = n.getLong("at");
            synchronized (NotifCore.class) {
                JSONObject all = pending(c);
                all.put(String.valueOf(id), n);
                savePending(c, all);
            }
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            PendingIntent pi = showIntent(c, id);
            try {
                if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms())
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                else am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } catch (SecurityException e) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            }
        } catch (Exception ignored) {}
    }

    static void cancelPending(Context c, int id) {
        ((AlarmManager) c.getSystemService(Context.ALARM_SERVICE)).cancel(showIntent(c, id));
        synchronized (NotifCore.class) {
            JSONObject all = pending(c);
            all.remove(String.valueOf(id));
            savePending(c, all);
        }
    }

    static void cancelAll(Context c, int id) {
        cancelPending(c, id);
        NotificationManagerCompat.from(c).cancel(id);
    }

    static long nextAt(long at, String repeat) {
        long now = System.currentTimeMillis();
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(at);
        int guard = 0;
        while (cal.getTimeInMillis() <= now && guard++ < 100000) {
            switch (repeat) {
                case "minute": cal.add(Calendar.MINUTE, 1); break;
                case "hour": cal.add(Calendar.HOUR_OF_DAY, 1); break;
                case "day": cal.add(Calendar.DAY_OF_YEAR, 1); break;
                case "week": cal.add(Calendar.WEEK_OF_YEAR, 1); break;
                case "month": cal.add(Calendar.MONTH, 1); break;
                default: cal.add(Calendar.YEAR, 1);
            }
        }
        return cal.getTimeInMillis();
    }

    /** Tras un reinicio: reprograma todo lo pendiente. */
    static void rescheduleAll(Context c) {
        JSONObject all = pending(c);
        java.util.Iterator<String> it = all.keys();
        long now = System.currentTimeMillis();
        while (it.hasNext()) {
            JSONObject n = all.optJSONObject(it.next());
            if (n == null) continue;
            try {
                String rep = n.optString("repeat", "");
                if (n.getLong("at") <= now) n.put("at", rep.isEmpty() ? now + 3000 : nextAt(n.getLong("at"), rep));
                schedule(c, n);
            } catch (Exception ignored) {}
        }
    }

    // ---------- notificación ----------
    static String ensureChannel(Context c, int importance) {
        String id = "canal_" + importance;
        if (Build.VERSION.SDK_INT >= 26) {
            int imp = importance >= 4 ? NotificationManager.IMPORTANCE_HIGH : importance == 3 ? NotificationManager.IMPORTANCE_DEFAULT : NotificationManager.IMPORTANCE_LOW;
            NotificationChannel ch = new NotificationChannel(id, "Prioridad " + importance, imp);
            ch.enableVibration(importance >= 3);
            if (importance <= 2) ch.setSound(null, null);
            c.getSystemService(NotificationManager.class).createNotificationChannel(ch);
        }
        return id;
    }

    private static int smallIcon(Context c, String name) {
        int r = c.getResources().getIdentifier(name == null ? "ic_stat_notif" : name, "drawable", c.getPackageName());
        return r != 0 ? r : android.R.drawable.ic_dialog_info;
    }

    static File imageFile(Context c, String name) {
        return new File(new File(c.getFilesDir(), "images"), name);
    }

    private static PendingIntent openApp(Context c, int id) {
        Intent i = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra("notif_id", id);
        return PendingIntent.getActivity(c, id, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static void show(Context c, JSONObject n) {
        try {
            NotificationManagerCompat nm = NotificationManagerCompat.from(c);
            if (!nm.areNotificationsEnabled()) return;
            int id = n.getInt("id");
            int importance = n.optInt("importance", 4);
            String title = n.optString("title"), body = n.optString("body"), big = n.optString("bigText");
            boolean ongoing = n.optBoolean("ongoing");

            NotificationCompat.Builder b = new NotificationCompat.Builder(c, ensureChannel(c, importance))
                    .setSmallIcon(smallIcon(c, n.optString("icon", null)))
                    .setContentTitle(title).setContentText(body.trim().isEmpty() ? null : body)
                    .setAutoCancel(!ongoing).setOngoing(ongoing)
                    .setPriority(importance >= 4 ? NotificationCompat.PRIORITY_HIGH : importance == 3 ? NotificationCompat.PRIORITY_DEFAULT : NotificationCompat.PRIORITY_LOW)
                    .setContentIntent(openApp(c, id));
            try { b.setColor(Color.parseColor(n.optString("color", "#6C5CE7"))); } catch (Exception ignored) {}

            // imagen
            String img = n.optString("image", "");
            Bitmap bmp = null;
            if (!img.isEmpty()) {
                File f = imageFile(c, img);
                if (f.exists()) bmp = BitmapFactory.decodeFile(f.getAbsolutePath());
            }
            if (bmp != null && "icon".equals(n.optString("imageMode", "big"))) {
                b.setLargeIcon(bmp);
                if (!big.isEmpty()) b.setStyle(new NotificationCompat.BigTextStyle().bigText(big));
            } else if (bmp != null) {
                NotificationCompat.BigPictureStyle st = new NotificationCompat.BigPictureStyle().bigPicture(bmp);
                if (!big.isEmpty()) st.setSummaryText(big);
                b.setLargeIcon(Bitmap.createScaledBitmap(bmp, 128, Math.max(1, 128 * bmp.getHeight() / bmp.getWidth()), true));
                st.bigLargeIcon((Bitmap) null);
                b.setStyle(st);
            } else if (!big.isEmpty()) {
                b.setStyle(new NotificationCompat.BigTextStyle().bigText(big));
            }

            // cronómetro / temporizador
            JSONObject chrono = n.optJSONObject("chrono");
            String mode = chrono == null ? "none" : chrono.optString("mode", "none");
            if ("up".equals(mode)) {
                b.setUsesChronometer(true).setShowWhen(true).setWhen(System.currentTimeMillis()).setOnlyAlertOnce(true);
            } else if ("down".equals(mode)) {
                long ms = Math.max(1, chrono.optLong("minutes", 1)) * 60000L;
                long end = System.currentTimeMillis() + ms;
                b.setUsesChronometer(true).setShowWhen(true).setWhen(end).setOnlyAlertOnce(true).setTimeoutAfter(ms);
                if (Build.VERSION.SDK_INT >= 24) b.setChronometerCountDown(true);
                JSONObject e = new JSONObject();
                e.put("id", (id / 100) * 100 + SLOT_END).put("title", "⏰ ¡Tiempo!").put("body", title.replace("⏱ ", ""))
                        .put("at", end).put("importance", 5).put("icon", "ic_stat_alarm").put("color", n.optString("color", "#6C5CE7"));
                schedule(c, e);
            }

            // botones
            JSONArray btns = n.optJSONArray("buttons");
            for (int i = 0; btns != null && i < Math.min(3, btns.length()); i++) {
                JSONObject bt = btns.getJSONObject(i);
                String kind = bt.optString("kind", "read"), label = bt.optString("title", "OK");
                Intent in = new Intent(c, NotifReceiver.class).setAction(NotifReceiver.ACTION_BTN)
                        .setData(Uri.parse("rn://btn/" + id + "/" + i))
                        .putExtra("id", id).putExtra("kind", kind).putExtra("label", label)
                        .putExtra("minutes", bt.optInt("minutes", 10)).putExtra("n", n.toString());
                if ("open".equals(kind)) {
                    Intent act = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    b.addAction(0, label, PendingIntent.getActivity(c, id * 4 + i, act, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
                } else if ("reply".equals(kind)) {
                    PendingIntent pi = PendingIntent.getBroadcast(c, id * 4 + i, in,
                            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0));
                    RemoteInput ri = new RemoteInput.Builder(KEY_REPLY).setLabel("Escribe tu respuesta").build();
                    b.addAction(new NotificationCompat.Action.Builder(0, label, pi).addRemoteInput(ri).build());
                } else {
                    PendingIntent pi = PendingIntent.getBroadcast(c, id * 4 + i, in, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
                    b.addAction(0, label, pi);
                }
            }
            nm.notify(id, b.build());
        } catch (SecurityException ignored) {
        } catch (Exception e) {
            android.util.Log.e("RichNotif", "show", e);
        }
    }
}
