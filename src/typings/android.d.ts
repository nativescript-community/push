declare namespace com {
    export namespace nativescript {
        export namespace push {
            export class PushPlugin{
                register( appContext: globalAndroid.content.Context,  projectId: string,  callbacks: PushPluginListener)
            }
            export class PushPluginListener {

            }

            export class PushLifecycleCallbacks {

            }
        }
    }
}
