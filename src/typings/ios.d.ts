declare class Push extends NSObject {
    static new(): Push;
    register(options)
    unregister();
    registerUserNotificationSettings(options: {
        types: string[];
        categories: string[];
    })
    areNotificationsEnabled()
}
declare class NSPushManager extends NSObject {
    static new(): NSPushManager;
}
