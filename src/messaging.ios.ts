import { DelegateObserver, SharedNotificationDelegate } from 'nativescript-shared-notification-delegate';
import * as applicationSettings from '@nativescript/core/application-settings';
import * as application from '@nativescript/core/application/application';
import { device } from '@nativescript/core/platform/platform';
import {
    IosInteractiveNotificationAction,
    IosInteractiveNotificationCategory,
    IosInteractiveNotificationType,
    MessagingOptions,
    PushNotificationModel,
} from './messaging';
import { invokeOnRunLoop, toJsObject } from './utils.ios';

let _notificationActionTakenCallback: Function;
let _pendingNotifications: any[] = [];
let _pendingActionTakenNotifications: any[] = [];
let _pushToken: any;
let _receivedPushTokenCallback: Function;
let _receivedNotificationCallback: Function;
let _registerForRemoteNotificationsRanThisSession = false;
let _userNotificationCenterDelegateObserver: PushNotificationDelegateObserverImpl;
let _showNotifications: boolean = true;
let _showNotificationsWhenInForeground: boolean = false;
let _autoClearBadge: boolean = true;

let _resolveWhenDidRegisterForNotifications;
let _rejectWhenDidFailToRegisterForNotifications;

// Track whether or not registration for remote notifications was request.
// This way we can suppress the "Allow notifications" consent popup until the listeners are passed in.
// const NOTIFICATIONS_REGISTRATION_KEY = 'Push-RegisterForRemoteNotifications';

export function initPushMessaging(options) {
    if (!options) {
        return;
    }
    _showNotifications = options.showNotifications === undefined ? _showNotifications : !!options.showNotifications;
    _showNotificationsWhenInForeground =
        options.showNotificationsWhenInForeground === undefined
            ? _showNotificationsWhenInForeground
            : !!options.showNotificationsWhenInForeground;
    _autoClearBadge = options.autoClearBadge === undefined ? _autoClearBadge : !!options.autoClearBadge;

    if (options.onMessageReceivedCallback !== undefined) {
        addOnMessageReceivedCallback(options.onMessageReceivedCallback);
    }

    if (options.onPushTokenReceivedCallback !== undefined) {
        addOnPushTokenReceivedCallback(options.onPushTokenReceivedCallback);
    }
}

export function addOnMessageReceivedCallback(callback: Function) {
    return new Promise((resolve, reject) => {
        try {
            // applicationSettings.setBoolean(NOTIFICATIONS_REGISTRATION_KEY, true);

            _receivedNotificationCallback = callback;
            // _registerForRemoteNotifications(resolve, reject);
            // _processPendingNotifications();

            resolve();
        } catch (ex) {
            console.log('Error in messaging.addOnMessageReceivedCallback: ' + ex);
            reject(ex);
        }
    });
}

export function getCurrentPushToken(): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            resolve(_pushToken);
        } catch (ex) {
            console.log('Error in messaging.getCurrentPushToken: ' + ex);
            reject(ex);
        }
    });
}

export function registerForPushNotifications(options?: MessagingOptions): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            initPushMessaging(options);
            _registerForRemoteNotificationsRanThisSession = false;
            _registerForRemoteNotifications(resolve, reject);
        } catch (ex) {
            console.log('Error in messaging.registerForPushNotifications: ' + ex);
            reject(ex);
        }
    });
}

export function unregisterForPushNotifications(): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            UIApplication.sharedApplication.unregisterForRemoteNotifications();

            // Note that we're not removing this key, because upon restart it would re-register the device.
            // I mean, if the dev uses 'unregisterForPushNotifications', he will likely also want to explicitly use 'registerForPushNotifications'.

            // TODO toch de key maar verwijderen?
            // applicationSettings.remove(NOTIFICATIONS_REGISTRATION_KEY);

            resolve();
        } catch (ex) {
            console.log('Error in messaging.unregisterForPushNotifications: ' + ex);
            reject(ex);
        }
    });
}

export function handleRemoteNotification(app, userInfo) {
    const userInfoJSON = toJsObject(userInfo);
    const aps = userInfo.objectForKey('aps');
    if (aps !== null) {
        const alrt = aps.objectForKey('alert');
        if (alrt !== null && alrt.objectForKey) {
            userInfoJSON.title = alrt.objectForKey('title');
            userInfoJSON.body = alrt.objectForKey('body');
        }
    }

    userInfoJSON.foreground = app.applicationState === UIApplicationState.Active;
    updateUserInfo(userInfoJSON);
    _pendingNotifications.push(userInfoJSON);

    if (_receivedNotificationCallback) {
        _processPendingNotifications();
    }
}

function addOnPushTokenReceivedCallback(callback) {
    return new Promise((resolve, reject) => {
        try {
            _receivedPushTokenCallback = callback;
            // may already be present
            if (_pushToken) {
                callback(_pushToken);
            }

            // applicationSettings.setBoolean(NOTIFICATIONS_REGISTRATION_KEY, true);
            // _registerForRemoteNotifications();
            // _processPendingNotifications();

            resolve();
        } catch (ex) {
            console.log('Error in messaging.addOnPushTokenReceivedCallback: ' + ex);
            reject(ex);
        }
    });
}

// This breaks in-app-messaging :(
function getAppDelegate() {
    // Play nice with other plugins by not completely ignoring anything already added to the appdelegate
    if (application.ios.delegate === undefined) {
        @ObjCClass(UIApplicationDelegate)
        class UIApplicationDelegateImpl extends UIResponder implements UIApplicationDelegate {}

        application.ios.delegate = UIApplicationDelegateImpl;
    }
    return application.ios.delegate;
}
function addAppDelegateMethods(appDelegate) {
    // we need the launchOptions for this one so it's a bit hard to use the UIApplicationDidFinishLaunchingNotification pattern we're using for other things
    // however, let's not override 'applicationDidFinishLaunchingWithOptions' if we don't really need it:
    const oldMethod = appDelegate.prototype.applicationDidFinishLaunchingWithOptions;
    appDelegate.prototype.applicationDidFinishLaunchingWithOptions = function (application, launchOptions) {
        if (oldMethod) {
            oldMethod.call(this, application, launchOptions);
        }
        // If the app was terminated and iOS is launching it in result of a push notification tapped by the user, this will hold the notification data.
        if (launchOptions) {
            const remoteNotification = launchOptions.objectForKey(UIApplicationLaunchOptionsRemoteNotificationKey);
            if (remoteNotification) {
                handleRemoteNotification(application, remoteNotification);
            }
        }

        return true;
    };
}

function addBackgroundRemoteNotificationHandler(appDelegate) {
    const oldMethod = appDelegate.prototype.applicationDidRegisterForRemoteNotificationsWithDeviceToken;
    appDelegate.prototype.applicationDidRegisterForRemoteNotificationsWithDeviceToken = (
        application: UIApplication,
        deviceToken: NSData
    ) => {
        if (oldMethod) {
            oldMethod.call(this, application, deviceToken);
        }
        if (areNotificationsEnabled()) {
            _resolveWhenDidRegisterForNotifications && _resolveWhenDidRegisterForNotifications();
        } else {
            _rejectWhenDidFailToRegisterForNotifications && _rejectWhenDidFailToRegisterForNotifications();
        }

        // if Firebase Messaging isn't used, the developer cares about the APNs token, so pass it to the app
        const token = deviceToken.debugDescription.replace(/[< >]/g, '');
        _pushToken = token;
        if (_receivedPushTokenCallback) {
            _receivedPushTokenCallback(token);
        }
    };

    appDelegate.prototype.applicationDidFailToRegisterForRemoteNotificationsWithError = (
        application: UIApplication,
        error: NSError
    ) => {
        console.error('applicationDidFailToRegisterForRemoteNotificationsWithError', error);
        // if (error.localizedDescription.indexOf('not supported in the simulator') > -1) {
        //     // Why? See https://github.com/EddyVerbruggen/nativescript-plugin-firebase/issues/1277
        //     // Note that this method will also be invoked on a simulator when the consent popup is declined
        //     _resolveWhenDidRegisterForNotifications && _resolveWhenDidRegisterForNotifications();
        // } else {
        _rejectWhenDidFailToRegisterForNotifications && _rejectWhenDidFailToRegisterForNotifications(error.localizedDescription);
        // }
    };

    appDelegate.prototype.applicationDidReceiveRemoteNotificationFetchCompletionHandler = (
        app,
        notification,
        completionHandler
    ) => {
        // Pass notification to auth and check if they can handle it (in case phone auth is being used), see https://firebase.google.com/docs/auth/ios/phone-auth

        completionHandler(UIBackgroundFetchResult.NewData);
        handleRemoteNotification(app, notification);
    };
}

export function init() {
    prepAppDelegate();
    const delegate = getAppDelegate();
    addAppDelegateMethods(delegate);
    addBackgroundRemoteNotificationHandler(delegate);
    // initPushMessaging(arg);
}

export function registerForInteractivePush(model?: PushNotificationModel): void {
    const nativeActions: UNNotificationAction[] = [];

    model.iosSettings.interactiveSettings.actions.forEach((action: IosInteractiveNotificationAction) => {
        const notificationActionOptions: UNNotificationActionOptions = action.options
            ? (action.options.valueOf() as UNNotificationActionOptions)
            : UNNotificationActionOptionNone;
        const actionType: IosInteractiveNotificationType = action.type || 'button';
        let nativeAction: UNNotificationAction;

        if (actionType === 'input') {
            nativeAction = UNTextInputNotificationAction.actionWithIdentifierTitleOptionsTextInputButtonTitleTextInputPlaceholder(
                action.identifier,
                action.title,
                notificationActionOptions,
                action.submitLabel || 'Submit',
                action.placeholder
            );
        } else if (actionType === 'button') {
            nativeAction = UNNotificationAction.actionWithIdentifierTitleOptions(
                action.identifier,
                action.title,
                notificationActionOptions
            );
        } else {
            console.log('Unsupported action type: ' + action.type);
        }

        nativeActions.push(nativeAction);
    });

    const actions: NSArray<UNNotificationAction> = NSArray.arrayWithArray(nativeActions);
    const nativeCategories: UNNotificationCategory[] = [];

    model.iosSettings.interactiveSettings.categories.forEach((category) => {
        const nativeCategory = UNNotificationCategory.categoryWithIdentifierActionsIntentIdentifiersOptions(
            category.identifier,
            actions,
            null,
            null
        );

        nativeCategories.push(nativeCategory);
    });

    const nsSetCategories = new NSSet<UNNotificationCategory>(nativeCategories as any);
    UNUserNotificationCenter.currentNotificationCenter().setNotificationCategories(nsSetCategories);

    if (model.onNotificationActionTakenCallback) {
        _addOnNotificationActionTakenCallback(model.onNotificationActionTakenCallback);
    }
}

function prepAppDelegate() {
    // see https://github.com/EddyVerbruggen/nativescript-plugin-firebase/issues/178 for why we're not using a constant here
    // _addObserver('com.firebase.iid.notif.refresh-token', (notification) => onTokenRefreshNotification(notification.object));

    // _addObserver(UIApplicationDidFinishLaunchingNotification, (appNotification) => {
    //     if (applicationSettings.getBoolean(NOTIFICATIONS_REGISTRATION_KEY, false)) {
    //         _registerForRemoteNotifications();
    //     }
    // });

    _addObserver(UIApplicationDidBecomeActiveNotification, (appNotification) => {
        _processPendingNotifications();
    });
}

export function subscribeToTopic(topicName) {
    return new Promise((resolve, reject) => {
        reject('Enable FIRMessaging in Podfile first');
    });
}

export function unsubscribeFromTopic(topicName) {
    return new Promise((resolve, reject) => {
        reject('Enable FIRMessaging in Podfile first');
    });
}
const onTokenRefreshNotification = (token) => {
    _pushToken = token;

    if (_receivedPushTokenCallback) {
        _receivedPushTokenCallback(token);
    }
};

export class IosInteractivePushSettings {
    actions: IosInteractiveNotificationAction[];
    categories: IosInteractiveNotificationCategory[];
}

export enum IosInteractiveNotificationActionOptions {
    authenticationRequired = 1,
    destructive = 2,
    foreground = 4,
}

export function areNotificationsEnabled() {
    // to check if also the app is registered use app.registeredForRemoteNotifications,
    // this below checks if user has enabled notifications for the app
    return UIApplication.sharedApplication.currentUserNotificationSettings.types > 0;
}

const updateUserInfo = (userInfoJSON) => {
    // move the most relevant properties (if set) so it's according to the TS definition and aligned with Android
    if (userInfoJSON.aps && userInfoJSON.aps.alert) {
        userInfoJSON.title = userInfoJSON.aps.alert.title;
        userInfoJSON.body = userInfoJSON.aps.alert.body;
    }
    // also, to make the ts.d happy copy all properties to a data element
    if (!userInfoJSON.hasOwnProperty('data')) {
        userInfoJSON.data = {};
    }
    Object.keys(userInfoJSON).forEach((key) => {
        if (key !== 'data') userInfoJSON.data[key] = userInfoJSON[key];
    });

    // cleanup
    userInfoJSON.aps = undefined;
};

function onCallback(unnotification, actionIdentifier?, inputText?) {
    // if the app is in the foreground then this method will receive the notification
    // if the app is in the background, and user has responded to interactive notification, then this method will receive the notification
    // if the app is in the background, and user views a notification, applicationDidReceiveRemoteNotificationFetchCompletionHandler will receive it
    const userInfo = unnotification.request.content.userInfo;
    const userInfoJSON = toJsObject(userInfo);
    updateUserInfo(userInfoJSON);

    if (actionIdentifier) {
        _pendingActionTakenNotifications.push({
            actionIdentifier,
            userInfoJSON,
            inputText,
        });

        if (_notificationActionTakenCallback) {
            _processPendingActionTakenNotifications();
        }

        userInfoJSON.notificationTapped = actionIdentifier === UNNotificationDefaultActionIdentifier;
    } else {
        userInfoJSON.notificationTapped = false;
    }

    userInfoJSON.foreground = UIApplication.sharedApplication.applicationState === UIApplicationState.Active;

    _pendingNotifications.push(userInfoJSON);
    if (_receivedNotificationCallback) {
        _processPendingNotifications();
    }
}

function _registerForRemoteNotifications(resolve?, reject?) {
    let app = UIApplication.sharedApplication;
    if (!app) {
        application.on('launch', () => _registerForRemoteNotifications(resolve, reject));
        return;
    }
    function actualRegisterForRemoteNotifications() {
        invokeOnRunLoop(() => {
            // see https://developer.apple.com/documentation/uikit/uiapplication/1623078-registerforremotenotifications
            app.registerForRemoteNotifications(); // prompts the user to accept notifications
        });
    }
    if (_registerForRemoteNotificationsRanThisSession) {
        resolve && resolve();
        return;
    }

    _registerForRemoteNotificationsRanThisSession = true;

    _resolveWhenDidRegisterForNotifications = resolve;
    _rejectWhenDidFailToRegisterForNotifications = reject;

    if (parseInt(device.osVersion, 10) >= 10) {
        const authorizationOptions = UNAuthorizationOptions.Alert | UNAuthorizationOptions.Sound | UNAuthorizationOptions.Badge;
        UNUserNotificationCenter.currentNotificationCenter().requestAuthorizationWithOptionsCompletionHandler(
            authorizationOptions,
            (granted, error) => {
                if (!error) {
                    if (app === null) {
                        app = UIApplication.sharedApplication;
                    }
                    if (app !== null) {
                        actualRegisterForRemoteNotifications();
                    }
                } else {
                    console.log('Error requesting push notification auth: ' + error);
                    reject && reject(error.localizedDescription);
                }
            }
        );

        if (_showNotifications) {
            _userNotificationCenterDelegateObserver = PushNotificationDelegateObserverImpl.initWithCallack(
                new WeakRef(onCallback)
            );
            UNUserNotificationCenter.currentNotificationCenter().delegate = _userNotificationCenterDelegateObserver;
            // SharedNotificationDelegate.addObserver(_userNotificationCenterDelegateObserver);
        }
    } else {
        const notificationTypes =
            UIUserNotificationType.Alert |
            UIUserNotificationType.Badge |
            UIUserNotificationType.Sound |
            UIUserNotificationActivationMode.Background;
        const notificationSettings = UIUserNotificationSettings.settingsForTypesCategories(notificationTypes, null);
        actualRegisterForRemoteNotifications();
        app.registerUserNotificationSettings(notificationSettings);
    }
}

function _addOnNotificationActionTakenCallback(callback: Function) {
    return new Promise((resolve, reject) => {
        try {
            _notificationActionTakenCallback = callback;
            _processPendingActionTakenNotifications();
            resolve();
        } catch (ex) {
            console.log('Error in messaging._addOnNotificationActionTakenCallback: ' + ex);
            reject(ex);
        }
    });
}

function _processPendingNotifications() {
    const app = UIApplication.sharedApplication;
    if (!app) {
        application.on('launch', () => _processPendingNotifications());
        return;
    }
    if (_receivedNotificationCallback) {
        for (const p in _pendingNotifications) {
            _receivedNotificationCallback(_pendingNotifications[p]);
        }
        _pendingNotifications = [];

        if (app.applicationState === UIApplicationState.Active && _autoClearBadge) {
            app.applicationIconBadgeNumber = 0;
        }
    }
}

function _processPendingActionTakenNotifications() {
    const app = UIApplication.sharedApplication;
    if (!app) {
        application.on('launch', () => _processPendingNotifications());
        return;
    }
    if (_notificationActionTakenCallback) {
        for (const p in _pendingActionTakenNotifications) {
            _notificationActionTakenCallback(
                _pendingActionTakenNotifications[p].actionIdentifier,
                _pendingActionTakenNotifications[p].userInfoJSON,
                _pendingActionTakenNotifications[p].inputText
            );
        }
        _pendingActionTakenNotifications = [];

        if (app.applicationState === UIApplicationState.Active && _autoClearBadge) {
            app.applicationIconBadgeNumber = 0;
        }
    }
}

function _addObserver(eventName, callback) {
    return NSNotificationCenter.defaultCenter.addObserverForNameObjectQueueUsingBlock(
        eventName,
        null,
        NSOperationQueue.mainQueue,
        callback
    );
}

type PushNotificationCallback = (unnotification: UNNotification, actionIdentifier?: string, inputText?: string) => void;
class PushNotificationDelegateObserverImpl extends NSObject {
    public static ObjCProtocols = [UNUserNotificationCenterDelegate];
    observerUniqueKey = 'push-messaging';

    public callback: WeakRef<PushNotificationCallback>;
    // private _owner: WeakRef<Tabs>;

    public static initWithCallack(callback: WeakRef<PushNotificationCallback>): PushNotificationDelegateObserverImpl {
        const delegate = PushNotificationDelegateObserverImpl.new() as PushNotificationDelegateObserverImpl;
        delegate.callback = callback;

        return delegate;
    }

    // constructor(callback: (unnotification: UNNotification, actionIdentifier?: string, inputText?: string) => void) {
    //     this.callback = callback;
    // }

    public userNotificationCenterWillPresentNotificationWithCompletionHandler(
        center: UNUserNotificationCenter,
        notification: UNNotification,
        completionHandler: (p1: UNNotificationPresentationOptions) => void
    ): void {
        const userInfo = notification.request.content.userInfo;
        const userInfoJSON = toJsObject(userInfo);
        if (!(notification.request.trigger instanceof UNPushNotificationTrigger)) {
            return;
        }
        if (
            _showNotificationsWhenInForeground || // Default value, in case we always want to show when in foreground.
            userInfoJSON['showWhenInForeground'] === true || // ...this is for non-FCM...
            (userInfoJSON.aps && userInfoJSON.aps.showWhenInForeground === true) // ...and this as well (so users can choose where to put it).
        ) {
            completionHandler(
                UNNotificationPresentationOptions.Alert |
                    UNNotificationPresentationOptions.Sound |
                    UNNotificationPresentationOptions.Badge
            );
        } else {
            completionHandler(0);
        }
        if (this.callback) {
            this.callback.get()(notification);
        }
    }

    public userNotificationCenterDidReceiveNotificationResponseWithCompletionHandler(
        center: UNUserNotificationCenter,
        response: UNNotificationResponse,
        completionHandler: () => void
    ): void {
        if (!(response.notification.request.trigger instanceof UNPushNotificationTrigger)) {
            return;
        }
        // let's ignore "dismiss" actions
        if (response && response.actionIdentifier === UNNotificationDismissActionIdentifier) {
            completionHandler();
            return;
        }

        if (this.callback) {
            this.callback.get()(
                response.notification,
                response.actionIdentifier,
                (response as UNTextInputNotificationResponse).userText
            );
        }
        completionHandler();
    }
}
