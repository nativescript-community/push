package com.nativescript.push;

import com.google.firebase.messaging.RemoteMessage;

public interface PushMessagingServiceListener {
  void success(Object data, RemoteMessage.Notification notif);
  void success(Object data);
  void error(Object data);
}
