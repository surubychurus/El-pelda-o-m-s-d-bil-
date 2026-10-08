package com.example.notificaciones;

import android.Manifest;
import android.os.Build;
import android.util.Base64;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "RichNotif", permissions = {
        @Permission(strings = {Manifest.permission.POST_NOTIFICATIONS}, alias = "notifications")
})
public class RichNotifPlugin extends Plugin {
    private static RichNotifPlugin instance;

    @Override
    public void load() { instance = this; }

    static void emit(JSONObject ev) {
        if (instance == null) return;
        try { instance.notifyListeners("action", new JSObject(ev.toString())); } catch (Exception ignored) {}
    }

    private JSObject permState() {
        boolean ok = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        return new JSObject().put("display", ok ? "granted" : "denied");
    }

    @PluginMethod
    @Override
    public void checkPermissions(PluginCall call) { call.resolve(permState()); }

    @PluginMethod
    @Override
    public void requestPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && !NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) {
            requestPermissionForAlias("notifications", call, "permCallback");
        } else call.resolve(permState());
    }

    @PermissionCallback
    private void permCallback(PluginCall call) { call.resolve(permState()); }

    @PluginMethod
    public void schedule(PluginCall call) {
        try {
            JSArray arr = call.getArray("notifications");
            for (int i = 0; i < arr.length(); i++) NotifCore.schedule(getContext(), arr.getJSONObject(i));
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        try {
            JSArray ids = call.getArray("ids");
            for (int i = 0; i < ids.length(); i++) NotifCore.cancelAll(getContext(), ids.getInt(i));
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void getPending(PluginCall call) {
        try {
            JSONObject all = NotifCore.pending(getContext());
            JSONArray out = new JSONArray();
            java.util.Iterator<String> it = all.keys();
            while (it.hasNext()) out.put(all.get(it.next()));
            call.resolve(new JSObject().put("notifications", out));
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void saveImage(PluginCall call) {
        try {
            String name = call.getString("name"), data = call.getString("data");
            if (name == null || data == null || name.contains("/") || name.contains("..")) { call.reject("datos no válidos"); return; }
            File f = NotifCore.imageFile(getContext(), name);
            f.getParentFile().mkdirs();
            try (FileOutputStream o = new FileOutputStream(f)) { o.write(Base64.decode(data, Base64.DEFAULT)); }
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void getEvents(PluginCall call) {
        try { call.resolve(new JSObject().put("events", new JSONArray(NotifCore.events(getContext())))); }
        catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void clearEvents(PluginCall call) { NotifCore.clearEvents(getContext()); call.resolve(); }
}
