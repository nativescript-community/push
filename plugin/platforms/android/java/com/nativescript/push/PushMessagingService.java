package com.nativescript.push;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.io.IOException;

import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.iid.FirebaseInstanceId;
import com.google.firebase.iid.InstanceIdResult;
import com.google.firebase.messaging.FirebaseMessaging;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import android.app.Notification;
import android.content.pm.PackageManager.NameNotFoundException;
import android.net.Uri;
import android.util.Log;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * This class takes care of notifications received while the app is in the
 * foreground.
 */
public class PushMessagingService extends FirebaseMessagingService {
  static final String TAG = "PushMessagingService";
  private static String currentToken;
  private static String cachedNotification;
  private static RemoteMessage.Notification cachedNot;
  static boolean isActive = false;
  static boolean showNotificationsWhenInForeground = true;
  // private static boolean preventInitialRegisterTokenCallback = false;

  private static PushMessagingServiceListener onPushTokenReceivedCallback;
  private static PushMessagingServiceListener onNotificationReceivedCallback;

  /**
   * Called if InstanceID token is updated. This may occur if the security of the
   * previous token had been compromised. Note that this is called when the
   * InstanceID token is initially generated so this is where you would retrieve
   * the token.
   */
  @Override
  public void onNewToken(String registrationToken) {
    super.onNewToken(registrationToken);
    executeOnPushTokenReceivedCallback(registrationToken);

    // If you want to send messages to this application instance or
    // manage this apps subscriptions on the server side, send the
    // Instance ID token to your app server.
  }

  /**
   * 
   * /* private void sendNotification(String messageBody) { Intent intent = new
   * Intent(this, MainActivity.class);
   * intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP); PendingIntent pendingIntent
   * = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_ONE_SHOT);
   * 
   * Uri defaultSoundUri=
   * RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
   * NotificationCompat.Builder notificationBuilder = new
   * NotificationCompat.Builder(this)
   * .setSmallIcon(R.drawable.ic_stat_ic_notification) .setContentTitle("FCM
   * Message") .setContentText(messageBody) .setAutoCancel(true)
   * .setSound(defaultSoundUri) .setContentIntent(pendingIntent);
   * 
   * NotificationManager notificationManager = (NotificationManager)
   * getSystemService(Context.NOTIFICATION_SERVICE);
   * 
   * // 0 = id of notification notificationManager.notify(0,
   * notificationBuilder.build()); }
   */

  public static void registerForPushNotifications(final PushMessagingServiceListener callback) {

    // new Thread() {
    // public void run() {
    FirebaseMessaging.getInstance().setAutoInitEnabled(true);
    FirebaseInstanceId.getInstance().getInstanceId().addOnCompleteListener(new OnCompleteListener<InstanceIdResult>() {
      @Override
      public void onComplete(Task<InstanceIdResult> task) {
        if (!task.isSuccessful()) {
          callback.error(task.getException());
        } else {
          final String token = task.getResult().getToken();
          callback.success(token);
          // dont call executeOnPushTokenReceivedCallback as it will be called onNewToken
          // executeOnPushTokenReceivedCallback(token);
        }
      }
    });
    // // try {

    // FirebaseInstanceId.getInstance().getInstanceId()
    // .addOnCompleteListener(new OnCompleteListener<InstanceIdResult>() {
    // @Override
    // public void onComplete(Task<InstanceIdResult> task) {
    // if (!task.isSuccessful()) {

    // Log.d(TAG, "getInstanceId failed " + task.getException());
    // return;
    // }

    // // Get new Instance ID token
    // String token = task.getResult().getToken();

    // if (!preventInitialRegisterTokenCallback) {
    // executeOnPushTokenReceivedCallback(token);
    // }

    // preventInitialRegisterTokenCallback = false;
    // // TODO register token to your server.

    // }
    // });
    // // String token = FirebaseInstanceId.getInstance().getToken(senderId, "FCM");

    // // if (!preventInitialRegisterTokenCallback) {
    // // executeOnPushTokenReceivedCallback(token);
    // // }

    // // preventInitialRegisterTokenCallback = false;
    // // } catch (IOException e) {
    // // Log.e(TAG, "Error getting a token from FCM: " + e.getMessage(), e);
    // // }
    // }
    // }.start();
  }

  public static String getCurrentPushToken() {
    return currentToken;
  }

  public static void unregisterForPushNotifications() {
    try {
      FirebaseMessaging.getInstance().setAutoInitEnabled(false);
      FirebaseInstanceId.getInstance().deleteInstanceId();
      currentToken = null;
    } catch (IOException e) {
      Log.e(TAG, "Error deleting token in FCM: " + e.getMessage(), e);
    }
  }

  public static void setOnPushTokenReceivedCallback(PushMessagingServiceListener callbacks) {
    // Workflow 1: User uses the registerForPushNotifications
    // In this case we are getting a double callback on initial app start up, since
    // the FB instance
    // generates a new token at application startup automatically. So we need to
    // prevent
    // the one triggered from the register.
    // Workflow 2: Users uses addPushTokenReceivedCallback directly
    // In this case we need to emit the token
    onPushTokenReceivedCallback = callbacks;
    if (currentToken != null) {
      executeOnPushTokenReceivedCallback(currentToken);
      // preventInitialRegisterTokenCallback = true;
    }
  }

  public static void setOnNotificationReceivedCallback(PushMessagingServiceListener callbacks) {
    onNotificationReceivedCallback = callbacks;
    if (cachedNotification != null) {
      executeOnNotificationReceivedCallback(cachedNotification, cachedNot);
      cachedNotification = null;
      cachedNot = null;
    }
  }

  public static void executeOnPushTokenReceivedCallback(String token) {
    if (token == currentToken) {
      return;
    }
    currentToken = token;
    if (onPushTokenReceivedCallback != null) {
      onPushTokenReceivedCallback.success(token);
    }
  }

  private final static AtomicInteger c = new AtomicInteger(0);

  public static int getID() {
    return c.incrementAndGet();
  }

  public void broadcastMessage(String notification) {

  }

  private int getStringResId(String aString) {
    String packageName = getPackageName();
    int resId = getResources().getIdentifier(aString, "string", packageName);
    return resId;
  }

  public void showNotification(final RemoteMessage.Notification not) {
    Object color = not.getColor();
    Log.d(TAG, "Message Notification Body: " + not.getBody());
    Log.d(TAG, "Message Notification BodyLocalize: " + not.getBodyLocalizationKey());
    Log.d(TAG, "Message Notification BodyLocalizeArgs: " + not.getBodyLocalizationArgs());
    Log.d(TAG, "Message Notification Title: " + not.getTitle());
    Log.d(TAG, "Message Notification TitleLocalize: " + not.getTitleLocalizationKey());
    Log.d(TAG, "Message Notification TitleLocalizeArgs: " + not.getTitleLocalizationArgs());
    Log.d(TAG, "Message Notification getChannelId: " + not.getChannelId());
    Log.d(TAG, "Message Notification getColor: " + not.getColor());
    Log.d(TAG, "Message Notification getIcon: " + not.getIcon());
    Log.d(TAG, "Message Notification getSound: " + not.getSound());
    Log.d(TAG, "Message Notification getTag: " + not.getTag());
    Log.d(TAG, "Message Notification getTicker: " + not.getTicker());
    Log.d(TAG, "Message Notification getEventTime: " + not.getEventTime());
    Log.d(TAG, "Message Notification getVisibility: " + not.getVisibility());
    Log.d(TAG, "Message Notification getImageUrl: " + not.getImageUrl());
    Log.d(TAG, "Message Notification getSticky: " + not.getSticky());
    Log.d(TAG, "Message Notification getLightSettings: " + not.getLightSettings());
    Log.d(TAG, "Message Notification getVibrateTimings: " + not.getVibrateTimings());
    final String packageName = this.getPackageName();
    android.content.pm.ApplicationInfo app;
    Object iconResource = null;

    String channelId = not.getChannelId();
    NotificationManagerCompat manager = NotificationManagerCompat.from(this);

    try {
      app = this.getPackageManager().getApplicationInfo(packageName, android.content.pm.PackageManager.GET_META_DATA);
      android.os.Bundle bundle = app.metaData;
      iconResource = bundle.get("com.google.firebase.messaging.default_notification_icon");
      if (channelId == null) {
        channelId = (String) bundle.get("com.google.firebase.messaging.default_notification_channel_id");
      }
      if (color == null) {
        color = bundle.get("com.google.firebase.messaging.default_notification_color");
      }
    } catch (NameNotFoundException e) {
      Log.d(TAG, "error get bundle data info: " + e.getLocalizedMessage());
      e.printStackTrace();
    }
    if (channelId == null) {
      channelId = manager.getNotificationChannels().get(0).getId();
    }
    NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId).setContentTitle(not.getTitle())
        .setContentText(not.getBody());
    if (iconResource != null) {
      builder.setSmallIcon((Integer) iconResource);
    }

    if (not.getTitleLocalizationKey() != null) {
      String title = null;
      try {
        title = String.format(this.getString(getStringResId(not.getTitleLocalizationKey()), (Object[]) (not.getTitleLocalizationArgs())));
      } catch(Exception e) {
        title = not.getTitle();
      }
      builder.setContentTitle(title);
    } else if (not.getTitle() != null) {
      builder.setContentTitle(not.getTitle());
    }

    if (not.getBodyLocalizationKey() != null) {
      String body = null;
      try {
        body = String.format(this.getString(getStringResId(not.getBodyLocalizationKey()), (Object[]) (not.getBodyLocalizationArgs())));
      } catch(Exception e) {
        body = not.getBody();
      }
      builder.setContentText(body);
    } else if (not.getBody() != null) {
      builder.setContentText(not.getBody());
    }  
    if (color != null) {
      builder.setColor((Integer) color);
    }
    
    if (not.getSound() != null) {
      builder.setSound(Uri.parse(not.getSound()));
    }
    Notification notification = builder.build();
    manager.notify(getID(), notification);
  }

  @Override
  public void onMessageReceived(RemoteMessage remoteMessage) {
    try {
      final JSONObject json = new JSONObject().put("foreground", isActive).put("from", remoteMessage.getFrom());
      Log.d(TAG, "onMessageReceived: " + remoteMessage.getMessageId() + ", " + remoteMessage.getFrom() + ", "
          + remoteMessage.getCollapseKey() + ", " + remoteMessage.getTo() + ", " + remoteMessage.getData());

      final RemoteMessage.Notification not = remoteMessage.getNotification();
      Log.d(TAG, "not: " + not);

      if (not != null && showNotificationsWhenInForeground && isActive) {
        showNotification(not);
      }
      if (not != null) {
        json.put("title", not.getTitle()).put("body", not.getBody());
      }

      final Map<String, String> data = remoteMessage.getData();
      final JSONObject data_json = new JSONObject();
      for (Map.Entry<String, String> stringStringEntry : data.entrySet()) {
        data_json.put(stringStringEntry.getKey(), stringStringEntry.getValue());
      }
      json.put("data", data_json);
      final String notification = json.toString();

      executeOnNotificationReceivedCallback(notification, not);

      broadcastMessage(notification);
    } catch (JSONException e) {
      e.printStackTrace();
    }
  }

  public static void executeOnNotificationReceivedCallback(String notification, RemoteMessage.Notification not) {
    if (onNotificationReceivedCallback != null) {
      onNotificationReceivedCallback.success(notification);
    } else {
      // cachedNotification in case we did not set the callback yet
      cachedNotification = notification;
      cachedNot = not;
    }
  }
}
