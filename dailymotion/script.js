
UtilityTool.autoSkipAdVideo = function (containerSelector, adVideoDetectors, skipButtonSelectors) {
    console.log('[Movie-No-Ads][DM] Run overrided autoSkipAdVideo');
    HtmlMonitor.domReady(() => {
        HtmlMonitor.waitForElement(containerSelector, document.body).then(el => {
            UtilityTool.ensureInDOM(el, () => {
                UtilityTool.autoSkipButton(containerSelector, skipButtonSelectors);
            });
            const observer = new MutationObserver((_, sender) => {
                const container = sender.containerEl;
                let adVideoDetected = false;
                for (let selector of adVideoDetectors) {
                    if (container.querySelector(selector)) {
                        adVideoDetected = true;
                        break;
                    }
                }
                
                if (adVideoDetected) {
                    console.log('[Movie-No-Ads] Ad detected');
                    const video = container.querySelector('video');
                    console.log('[Movie-No-Ads] Ad video src/lastAdSrc',video.src, video.lastAdSrc);
                    console.dir(video);
                    if(video.src.indexOf('.mp3')>=0 || video.src.indexOf('.ogg')>=0){
                        video.removeAttribute('src');
                        //video.src= null; 
                        return;
                    }
                    if (video && video.src && video.src != '') {
                        if (video.lastAdSrc) {
                            video.currentTime = video.duration ? video.duration : Number.MAX_SAFE_INTEGER;
                            //video.play();
                            return;
                        }
                        console.log('[Movie-No-Ads] Ad video found', video.src, video.duration);
                        video.lastAdSrc = video.src;
                        video.currentTime = video.duration ? video.duration : Number.MAX_SAFE_INTEGER;
                        console.log('[Movie-No-Ads] Play ad video');
                        //*
                        retry(() => {
                            if (video.src == video.lastAdSrc) return video.play();
                            else return Promise.resolve({});
                        }).then(() => {
                            video.lastAdSrc = null;
                        }).catch(ex=>{
                            console.log('[Movie-No-Ads] Unable to continue ad video')
                        });
                        //*/
                    }
                    console.log('[Movie-No-Ads] Search for skip button');
                    let skipBt = null;
                    for (let selector of skipButtonSelectors) {
                        skipBt = container.querySelector(selector);
                        
                    }
                    if (skipBt) {
                        setTimeout((bt)=>{bt.click()}, 500, skipBt);
                        console.log('[Movie-No-Ads] Skip button should be clicked', skipBt);
                    }
                    else console.log('[Movie-No-Ads] no skip button found');
                    
                    //skipBt.click();
                }
            });
            observer.containerEl = el;
            observer.observe(el, {
                childList: true,
                subtree: true,
                attributes: false
            });
        });
    });
};
console.log('[Movie-No-Ads][DM] Starting to monitor Daily Motion video ads...');
