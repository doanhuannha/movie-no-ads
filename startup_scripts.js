//require 'common_scripts.js';
const manifest = chrome.runtime.getManifest();
console.log('[Movie-No-Ads] Trying to identify the site with service worker', location.href);
const url = (window.location != window.parent.location) ? document.referrer||location.href : location.href;
//if(url) url = location.href;
UtilityTool.sendMessage({ cmd: 'hi', url }).then(siteConfig => {
    if (siteConfig && siteConfig.name) {
        console.log('[Movie-No-Ads] Content script of ' + manifest.name + ' ' + manifest.version +'/' + siteConfig.configVersion + ' is attached in ', location.href, siteConfig);
        if (siteConfig.adElements) for (let el of siteConfig.adElements) UtilityTool.removeElements(el);
        if (siteConfig.skipAds) for (let adOpt of siteConfig.skipAds) {
            if (adOpt.adVideos) UtilityTool.autoSkipAdVideo(adOpt.container, adOpt.adVideos, adOpt.skipButtons, siteConfig.extras);
            else UtilityTool.autoSkipButton(adOpt.container, adOpt.skipButtons, siteConfig.extras);
        }
    }

});
FullScreenHelper.start();