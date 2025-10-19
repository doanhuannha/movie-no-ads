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
        Ytb.restoreCaptionState();
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
                Ytb.videoElement = video;
                if (video && !video.myAutoPlay) {
                    console.log('[Movie-No-Ads] VID Element detected', video);
                    video.myAutoPlay = true;
                    container.addEventListener('click', function (e) {
                        if (e.pointerId < 0) return;
                        Ytb.userActions = true;
                        if(e.target.querySelector('.ytContribIconClosedCaption,.ytmClosedCaptioningButtonButton,.ytp-subtitles-button')) {
                            
                            UtilityTool.delay(500).then(()=>Ytb.recordCaptionState());
                        }
                        
                        UtilityTool.delay(500).then(function(){Ytb.userActions = false;});
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
                            //Ytb.restoreCaptionState();
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
    runMode: location.href.startsWith('https://www.youtube.com/tv') ? 'tv' : location.href.startsWith('https://m.youtube.com') ? 'mobile' : 'standard',
    lastCaptionState: undefined,
    captionTryCnt: 0,
    getLastCaptionState: function(){
        if(this.lastCaptionState==undefined){
            var enable = localStorage['.ytp-caption.'];
            if(enable!=undefined) {
                enable = JSON.parse(enable);
                this.lastCaptionState = (enable===true) || ((enable.toString())=='true');
            }
        }
        return this.lastCaptionState;
    },
    recordCaptionState: function(){
        
        this.lastCaptionState = this.readCaptionStateData();
        localStorage.setItem('.ytp-caption.', this.lastCaptionState);
        console.log('[Movie-No-Ads][YTB] caption state recorded', this.lastCaptionState);
    },
    readCaptionStateData: function(){
        let enable = undefined;
        switch (this.runMode) {
            case 'tv':
            case 'mobile': {
                enable = localStorage['yt-html5-player-modules::subtitlesModuleData::module-enabled'];
                if (enable != undefined) enable = JSON.parse(enable);

            } break;
            default: {
                enable = localStorage['yt-player-sticky-caption'];
                if (enable != undefined) enable = JSON.parse(enable).data;
            } break;
        }
        if(enable === undefined) this.lastCaptionState = undefined;
        else enable = (enable===true) || ((enable.toString())=='true');
        return enable;
    },
    getCaptionButton: function(){
        //*/
        let bt = null;
        switch(this.runMode){
            case 'tv':{
                bt = document.querySelector('[idomkey=TRANSPORT_CONTROLS_BUTTON_TYPE_CAPTIONS]');
                if(bt) bt = bt.querySelector('ytlr-button');
                if (this.lastCaptionState === true && !bt && this.captionTryCnt >= 5) {
                    this.togglePlayingOnTv();
                }
            } break;
            case 'mobile':{
                bt = document.querySelector('button.ytmClosedCaptioningButtonButton');
            } break;
            default:{
                bt = document.querySelector('button.ytp-subtitles-button');
                if(bt && bt.dataset && bt.dataset.tooltipTitle && bt.dataset.tooltipTitle.includes('unavailable')) bt = null;
            } break;
        }
        return bt;
    },
    
    readCurrentCaptionStateButton: function(bt){
        if(!bt) bt = this.getCaptionButton();
        if(bt) return bt.matches('[aria-pressed="true"]');
        else return undefined;
    },
    isCaptionAvailable: function(){
        return document.querySelector('div.ytp-caption-window-container') != null;
    },
    isCaptionStateOn:function(){
        return document.querySelector('.caption-window')
    },
    seekVideo: function(offsetMs){
        if(this.videoElement){
            this.videoElement.currentTime += offsetMs/1000;
        }
    },
    togglePlayingOnTv: async function(){
        var bt = document.querySelector('ytlr-watch-page');
        if(bt){
            let evt = new Event('mousedown');
            bt.dispatchEvent(evt);
            await UtilityTool.delay(200);

            evt = new Event('mouseup');
            bt.dispatchEvent(evt);

            await UtilityTool.delay(1000);
            Ytb.seekVideo(-5000);

            evt = new Event('mousedown');
            bt.dispatchEvent(evt);
            await UtilityTool.delay(200);

            evt = new Event('mouseup');
            bt.dispatchEvent(evt);
        }
    },
    setCaptionState:async function(enable, bt){
        
        //console.log('[Movie-No-Ads][YTB] toggle caption button', 'expected='+enable,'button='+this.readCurrentCaptionStateButton(), 'data='+this.readCaptionStateData());
        if(enable==undefined) return;
        if(this.readCurrentCaptionStateButton(bt)==enable && this.readCaptionStateData()==enable){
            console.log(`[Movie-No-Ads][YTB] Caption is set as expected`, enable);
            this.captionTryCnt = 0;
            return;
        }
        console.log(`[Movie-No-Ads][YTB] ${enable ? 'enable' : 'disable'} caption`);
        if(!bt) bt = this.getCaptionButton();
        if(bt) switch(this.runMode){
            case 'tv': {                
                let evt = new Event('mousedown');
                bt.dispatchEvent(evt);
                await UtilityTool.delay(200);

                evt = new Event('mouseup');
                bt.dispatchEvent(evt);
                
                let watchScreen = document.querySelector('ytlr-watch-default');                
                if(watchScreen){
                    //watchScreen.remove();
                    watchScreen.classList.replace('ytLrWatchDefaultControl','ytLrWatchDefaultIdle');
                    //let bubble = watchScreen.querySelector('ytlr-watch-metadata');
                    //if(bubble) bubble.classList.replace('ytLrWatchMetadataWarm','ytLrWatchMetadataIsMetadataHidden');
                } 
            } break;
            case 'mobile': {
                let evt = new Event('pointerdown');
                bt.dispatchEvent(evt);
                await UtilityTool.delay(200);

                evt = new Event('pointerup');
                bt.dispatchEvent(evt);
            } break;
            default: {
                bt.click();
            } break;
        }
    },
    restoreCaptionState: function () {
        if(!this.isCaptionAvailable()){
            console.log('[Movie-No-Ads][YTB] Caption is unavailable');
        }
        if (this.isCaptionAvailable() && this.getLastCaptionState() != undefined){
            const bt = this.getCaptionButton();
            if(!bt) {
                this.captionTryCnt++;
                console.log('[Movie-No-Ads][YTB] Unable to find caption button');
            }
            if(this.readCurrentCaptionStateButton(bt)!=undefined) this.setCaptionState(this.getLastCaptionState(), bt);
        }

    },
};
console.log('[Movie-No-Ads][YTB] Script registered!', Ytb.getLastCaptionState());
