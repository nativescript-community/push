const path = require('path');
const fs = require('fs');
module.exports = function ($logger, $projectData, hookArgs) {
    return new Promise<void>(function (resolve, reject) {
        /* Decide whether to prepare for dev or prod environment */
        const validStagingEnvs = ['dev', 'development', 'staging'];
        const validProdEnvs = ['prod', 'production'];
        let isProdEnv = false; // building with --env.prod or --env.production flag
        let isStagingEnv = false;
        const env = (hookArgs.platformSpecificData || hookArgs.prepareData).env;
        if (env) {
            Object.keys(env).forEach((key) => {
                if (validProdEnvs.indexOf(key) > -1) {
                    isProdEnv = true;
                }
                if (validStagingEnvs.indexOf(key) > -1) {
                    isStagingEnv = true;
                }
            });
        }
        const buildType = isProdEnv && !isStagingEnv ? 'production' : 'development';
        const platformFromHookArgs = hookArgs && (hookArgs.platform || (hookArgs.prepareData && hookArgs.prepareData.platform));
        const platform = (platformFromHookArgs || '').toLowerCase();
        /* Create info file in platforms dir so we can detect changes in environment and force prepare if needed */
        const npfInfoPath = path.join($projectData.platformsDir, platform, '.pluginfirebaseinfo');
        const npfInfo = {
            buildType,
        };
        try {
            fs.writeFileSync(npfInfoPath, JSON.stringify(npfInfo));
        } catch (err) {
            $logger.info('nativescript-plugin-firebase: unable to create ' + npfInfoPath + ', prepare will be forced next time!');
        }
        /* Handle preparing of Google Services files */
        if (platform === 'android') {
            const destinationGoogleJson = path.join($projectData.platformsDir, 'android', 'app', 'google-services.json');
            const destinationGoogleJsonAlt = path.join($projectData.platformsDir, 'android', 'google-services.json');
            let sourceGoogleJson = path.join($projectData.appResourcesDirectoryPath, 'Android', 'google-services.json');
            const sourceGoogleJsonProd = path.join(
                $projectData.appResourcesDirectoryPath,
                'Android',
                'google-services.json.prod'
            );
            const sourceGoogleJsonDev = path.join($projectData.appResourcesDirectoryPath, 'Android', 'google-services.json.dev');
            // ensure we have both dev/prod versions so we never overwrite singlular google-services.json
            if (fs.existsSync(sourceGoogleJsonProd) && fs.existsSync(sourceGoogleJsonDev)) {
                if (buildType === 'production') {
                    sourceGoogleJson = sourceGoogleJsonProd;
                } // use prod version
                else {
                    sourceGoogleJson = sourceGoogleJsonDev;
                } // use dev version
            }
            // copy correct version to destination
            if (fs.existsSync(sourceGoogleJson) && fs.existsSync(path.dirname(destinationGoogleJson))) {
                $logger.info('Copy ' + sourceGoogleJson + ' to ' + destinationGoogleJson + '.');
                fs.writeFileSync(destinationGoogleJson, fs.readFileSync(sourceGoogleJson));
                resolve();
            } else if (fs.existsSync(sourceGoogleJson) && fs.existsSync(path.dirname(destinationGoogleJsonAlt))) {
                // NativeScript < 4 doesn't have the 'app' folder
                fs.writeFileSync(destinationGoogleJsonAlt, fs.readFileSync(sourceGoogleJson));
                resolve();
            } else {

                if (isProdEnv) {
                    $logger.error(
                        'Unable to copy google-services.json. You need this file, because the Google Services Plugin cannot function without it..'
                    );
                    reject();
                } else {
                    $logger.warn(
                        'Unable to copy google-services.json. You need this file, because the Google Services Plugin cannot function without it..'
                    );
                    resolve();
                }
            }
        } else if (platform === 'ios') {
            // we have copied our GoogleService-Info.plist during before-checkForChanges hook, here we delete it to avoid changes in git
            const destinationGooglePlist = path.join($projectData.appResourcesDirectoryPath, 'iOS', 'GoogleService-Info.plist');
            const sourceGooglePlistProd = path.join(
                $projectData.appResourcesDirectoryPath,
                'iOS',
                'GoogleService-Info.plist.prod'
            );
            const sourceGooglePlistDev = path.join($projectData.appResourcesDirectoryPath, 'iOS', 'GoogleService-Info.plist.dev');
            // if we have both dev/prod versions, let's remove GoogleService-Info.plist in destination dir
            if (fs.existsSync(sourceGooglePlistProd) && fs.existsSync(sourceGooglePlistDev)) {
                if (fs.existsSync(destinationGooglePlist)) {
                    fs.unlinkSync(destinationGooglePlist);
                }
                resolve();
            } else {
                // single GoogleService-Info.plist modus
                resolve();
            }
        } else {
            resolve();
        }
    });
};
