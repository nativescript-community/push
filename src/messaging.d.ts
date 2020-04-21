/**
 * The returned object in the callback handler of the addOnMessageReceivedCallback function.
 *
 * Note that any custom data you send from your server will be available as
 * key/value properties on the Message object as well.
 */
export interface Message {
    /**
     * Indicated whether or not the notification was received while the app was in the foreground.
     */
    foreground: boolean;
    /**
     * The main text shown in the notificiation.
     * Not available on Android when the notification was received in the background.
     */
    body?: string;
    /**
     * Optional title, shown above the body in the notification.
     * Not available on Android when the notification was received in the background.
     */
    title?: string;
    /**
     * Any other data you may have added to the notification.
     */
    data: any;
    /**
     * Indicates whether or not the notification was tapped.
     * iOS only.
     */
    notificationTapped?: boolean;
}
export interface MessagingOptions {
    /**
     * For Messaging, either pass in this callback function here, or use addOnMessageReceivedCallback.
     */
    onPushTokenReceivedCallback?: (token: string) => void;

    /**
     * For Messaging, either pass in this callback function here, or use addOnPushTokenReceivedCallback.
     */
    onMessageReceivedCallback?: (message: Message) => void;

    /**
     * For Messaging (Push Notifications). Whether you want this plugin to automatically display the notifications or just notify the callback.
     * Currently used on iOS only. Default true.
     */
    showNotifications?: boolean;

    /**
     * For Messaging (Push Notifications). Whether you want this plugin to always handle the notifications when the app is in foreground.
     * Currently used on iOS only. Default false.
     */
    showNotificationsWhenInForeground?: boolean;

    /**
     * Automatically clear the badges on starting.
     * Currently used on iOS only. Default true.
     */
    autoClearBadge?: boolean;
}

export declare function init();
export declare function getCurrentPushToken(): Promise<string>;

export declare function registerForPushNotifications(options?: MessagingOptions): Promise<void>;

export declare function unregisterForPushNotifications(): Promise<void>;

export declare function registerForInteractivePush(model?: any): void;

export declare function subscribeToTopic(topicName: any): Promise<{}>;

export declare function unsubscribeFromTopic(topicName: any): Promise<{}>;

export declare function areNotificationsEnabled(): boolean;

export declare const onTokenRefreshNotification: (token: string) => void;

// android. ...
export declare function onAppModuleLaunchEvent(intent: any): void;
export declare function onAppModuleResumeEvent(intent: any): void;

export declare interface IosInteractivePushSettings {
    actions: IosInteractiveNotificationAction[];
    categories: IosInteractiveNotificationCategory[];
}

export interface IosPushSettings {
    badge: boolean;
    sound: boolean;
    alert: boolean;
    notificationCallback: Function;
    interactiveSettings: IosInteractivePushSettings;
}

export interface NotificationActionResponse {
    androidSettings: any;
    iosSettings: IosPushSettings;
    onNotificationActionTakenCallback: Function;
}

export interface PushNotificationModel {
    androidSettings: any;
    iosSettings: IosPushSettings;
    onNotificationActionTakenCallback: Function;
}

export declare enum IosInteractiveNotificationActionOptions {
    authenticationRequired = 1,
    destructive = 2,
    foreground = 4,
}

export type IosInteractiveNotificationType = 'button' | 'input';

export interface IosInteractiveNotificationAction {
    /**
     * Either "button" or "input", default "button".
     */
    type?: IosInteractiveNotificationType;
    identifier: string;
    title: string;
    submitLabel?: string;
    placeholder?: string;
    options?: IosInteractiveNotificationActionOptions;
}

export interface IosInteractiveNotificationCategory {
    identifier: string;
    // actionsForDefaultContext?: string[];
    // actionsForMinimalContext?: string[];
}

export declare class IosPushSettings {
    badge: boolean;
    sound: boolean;
    alert: boolean;
    notificationCallback: Function;
    interactiveSettings: IosInteractivePushSettings;
}

export declare class PushNotificationModel {
    androidSettings: any;
    iosSettings: IosPushSettings;
    onNotificationActionTakenCallback: Function;
}
