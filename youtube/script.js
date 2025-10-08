HtmlMonitor.domReady(() => {
    console.log('[Movie-No-Ads][YTB] Looking for tag: tp-yt-paper-dialog');
    window.setInterval(function () {
        var dialogs = document.querySelectorAll('tp-yt-paper-dialog');
        if(dialogs) for(const dialog of dialogs) {
            if(dialog.textContent.includes('Ad blockers violate')){
                console.log('[Movie-No-Ads][YTB] Ad-block Dialog detected, hide it', dialog);
                dialog.style.display = 'none';
                dialog.remove();
                var bg = document.querySelector('tp-yt-iron-overlay-backdrop');
                if(bg){
                    bg.click();
                    bg.className = 'closed';
                } 
                
            }
            
        }
        var skipSurvey = document.querySelector('ytlr-skip-button-renderer');
        if(skipSurvey){
            console.log('[Movie-No-Ads][YTB] Survey detected! Skip...');
            skipSurvey.click();
        }
        //console.log('[YTB] Subtitle',localStorage['yt-player-sticky-caption'],  localStorage['yt-html5-player-modules::subtitlesModuleData::module-enabled']);
    }, 1000);

    HtmlMonitor.monitorElement('yt-confirm-dialog-renderer', document.body).then(dialog => {
        UtilityTool.waitFor((arg) => {
            return arg.innerText.trim() != '';
        }, (arg) => {
            const msgContainer = arg.querySelector('yt-formatted-string.line-text');
            console.log('[Movie-No-Ads][YTB] Dialog detected!! Msg: ', msgContainer.innerText);
            //if (msgContainer && msgContainer.innerText.indexOf('Video paused') >= 0) {
            if (msgContainer) {
                msgContainer.innerText = 'Should auto continue...';
                console.log('[Movie-No-Ads][YTB] Try to continue playing the video');
                retry(() => {
                    const bt = dialog.querySelector('.yt-spec-button-shape-next');
                    if (bt && bt.getAttribute('aria-label') == 'Yes') {
                        console.log('[Movie-No-Ads][YTB] Continue button clicked!');
                        bt.click();
                        
                        return Promise.resolve({ err: null });
                    }
                    else {
                        return Promise.reject({ err: '[Movie-No-Ads][YTB] Continue button is not found', el: dialog });
                    }
                }, 1000).catch(e => console.log('[Movie-No-Ads][YTB] Failed to continue playing', e));
            }
            else console.log('[Movie-No-Ads][YTB] Not a continue dialog');
        }, dialog.querySelector('#scrollable'));
    });
    
});
UtilityTool.autoSkipAdVideo = function (containerSelector, adVideoDetectors, skipButtonSelectors, extras) {

    console.log('[Movie-No-Ads][YTB] Run overrided autoSkipAdVideo');
    const fakeAdVidUrl = extras.fakeAdVidUrl;
    HtmlMonitor.domReady(() => {
        HtmlMonitor.waitForElement(containerSelector, document.body).then(el => {
            console.log('[Movie-No-Ads] Monitor video container', el);
            UtilityTool.ensureInDOM(el, () => {
                UtilityTool.autoSkipAdVideo(containerSelector, adVideoDetectors, skipButtonSelectors);
            });
            const observer = new MutationObserver((_els, sender) => {
                const container = sender.containerEl;
                const video = container.querySelector('video');
                
                if (video && !video.myAutoPlay) {
                    video.myAutoPlay = true;
                    container.addEventListener('click', function (e) {
                        Ytb.userActions = true;
                        setTimeout(function(){Ytb.userActions = false;}, 500);
                    });
                    video.addEventListener('pause', function (e) {
                        if (Ytb.userActions === false && video.duration != video.currentTime) {
                            if(location.href.indexOf('youtube.com/tv')<0) // continue playing if not tv
                            {
                                //console.log('[Movie-No-Ads] Continue the paused video');
                                e.target.play();
                            } 
                        }
                        else Ytb.userActions = false;

                    });
                }
                
                let adVideoDetected = false;
                for (let selector of adVideoDetectors) {
                    if (container.querySelector(selector)) {
                        adVideoDetected = true;
                        break;
                    }
                }

                if (adVideoDetected) {
                    //console.log('Found ad symtoms!');

                    if (video && video.src && !isNaN(video.duration)) {
                        if (video.lastAdSrc && video.src == video.lastAdSrc) {
                            //video.currentTime = video.duration;
                            //video.src = fakeAdVidUrl;
                            //video.currentTime = isNaN(video.duration) ? Number.MAX_SAFE_INTEGER : video.duration;
                            //video.play();
                            //console.log('Trying to skip... do nothing', video.src, video.currentTime, video.duration);
                            return;
                        }
                        console.log('[Movie-No-Ads] Ad vid detected', video.src, video.duration);
                        video.lastAdSrc = video.src;
                        //video.currentTime = video.duration;
                        //*
                        retry(() => {
                            console.log('[Movie-No-Ads] Try to play ad vid...', video.lastAdSrc);
                            if (video.src) {
                                console.log('[Movie-No-Ads] Continue playing...', video.src, video.currentTime, video.src === video.lastAdSrc);
                                if (video.src !== video.lastAdSrc) return Promise.resolve();
                            }
                            else {
                                video.src = fakeAdVidUrl;
                                console.log('[Movie-No-Ads] Continue ad vid is gone...', video.src, video.currentTime);
                                return Promise.resolve();
                            }
                            video.currentTime = isNaN(video.duration) ? Number.MAX_SAFE_INTEGER : video.duration;
                            return video.play();
                        }).then(() => {
                            console.log('[Movie-No-Ads] Skip ad successfull');
                            video.lastAdSrc = null;
                        }).catch(ex => {
                            console.log('[Movie-No-Ads] Error on skip ad vid', ex);
                        });
                        //*/
                    }
                    let skipBt = null;
                    if (skipButtonSelectors) for (let selector of skipButtonSelectors) {
                        skipBt = container.querySelector(selector);
                        if (skipBt) break;
                    }
                    if (skipBt) {
                        if(video && !video.src) video.src = fakeAdVidUrl;
                        console.log('[Movie-No-Ads] Skip button and clicked', skipBt);
                        setTimeout((bt)=>{bt.click()}, 1000, skipBt);
                    }
                }
            });

            observer.containerEl = el;
            observer.observe(el, {
                childList: true,
                subtree: true,
                attributes: true
            });
        });
    });
};
const Ytb = {
    userActions: false,
    isOnTV: location.href.startsWith('https://www.youtube.com/tv'),
    lastCaptionState: false,
    readCurrentCaptionState: function(){
        if(this.isOnTV){
            let bt = document.querySelector('yt-icon.ytContribIconClosedCaption');
            if(bt){
                bt = UtilityTool.findParent(bt, 'ytlr-button');
                if(bt) return bt.matches('ytlr-button[aria-pressed="true"]');
            } 
        }
        else{
            let bt = document.querySelector('button.ytp-subtitles-button');
            if(bt) return bt.matches('button[aria-pressed="true"]');
        }
        return undefined;
    },
    toggleCaptionState: function(){
        if(this.isOnTV){
            let bt = document.querySelector('yt-icon.ytContribIconClosedCaption');
            if(bt){
                bt = UtilityTool.findParent(bt, 'ytlr-button');
                if(bt){
                    let evt = null;
                    evt = new Event('pointerup');
                    bt.dispatchEvent(evt);
                    evt = new Event('mouseup');
                    bt.dispatchEvent(evt);
                }
                else{
                    console.log('[Movie-No-Ads][YTB] not found bt');
                }
                
            } 
        }
        else{
            let bt = document.querySelector('button.ytp-subtitles-button');
            if(bt) bt.click();
        }
        this.lastCaptionState = this.readCurrentCaptionState();
    },
    restoreCaptionState: function(){
        console.log('[Movie-No-Ads][YTB] enable subtitle', location.href);
        if(this.readCurrentCaptionState()===false){
            this.toggleCaptionState();
        }

    }
};
console.log('[Movie-No-Ads][YTB] Script registered!');
setInterval(()=>{
    //Ytb.restoreCaptionState();
}, 5000);