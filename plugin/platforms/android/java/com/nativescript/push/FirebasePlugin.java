package com.nativescript.push;

import java.io.IOException;

import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.iid.FirebaseInstanceId;
import com.google.firebase.iid.InstanceIdResult;

import android.util.Log;
// import androidx.annotation.NonNull;

public class FirebasePlugin {
  private static final String TAG = "FirebasePlugin";

  private static String currentToken;
  private static String cachedNotification;
  // private static boolean preventInitialRegisterTokenCallback = false;

  private static FirebasePluginListener onPushTokenReceivedCallback;
  private static FirebasePluginListener onNotificationReceivedCallback;

  public static void registerForPushNotifications(final FirebasePluginListener callback) {
    FirebaseInstanceId.getInstance().getInstanceId().addOnCompleteListener(new OnCompleteListener<InstanceIdResult>() {
      @Override
      public void onComplete(Task<InstanceIdResult> task) {
        if (!task.isSuccessful()) {
          Log.w("FCM TOKEN Failed", task.getException());
          callback.error(task.getException());
        } else {
          final String token = task.getResult().getToken();
          callback.success(token);
          executeOnPushTokenReceivedCallback(token);
        }
      }
    });
    // new Thread() {
    // public void run() {
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

  public static void unregisterForPushNotifications(final String senderId) {
    try {
      FirebaseInstanceId.getInstance().deleteInstanceId();
      currentToken = null;
    } catch (IOException e) {
      Log.e(TAG, "Error deleting token in FCM: " + e.getMessage(), e);
    }
  }

  public static void setOnPushTokenReceivedCallback(FirebasePluginListener callbacks) {
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

  public static void setOnNotificationReceivedCallback(FirebasePluginListener callbacks) {
    // TODO perhaps use this to set a badge:
    // https://github.com/gogoout/nativescript-plugin-badge/blob/28e79f6d5614ec9b9b98bb07c67df32fdc42ba9a/src/badge.android.ts#L13
    // Default count=1, and perhaps pass it in via the notification payload (like on
    // iOS)
    onNotificationReceivedCallback = callbacks;
    if (cachedNotification != null) {
      executeOnNotificationReceivedCallback(cachedNotification);
      cachedNotification = null;
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

  public static void executeOnNotificationReceivedCallback(String notification) {
    if (onNotificationReceivedCallback != null) {
      onNotificationReceivedCallback.success(notification);
    } else {
      // cachedNotification in case we did not set the callback yet
      cachedNotification = notification;
    }
  }
}
