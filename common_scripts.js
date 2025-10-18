

const retry = async function (act, delay = 1000, maxRetry = 3, tryCnt = 1) {
    let r = act(tryCnt);
    const shouldRetry = tryCnt < maxRetry;
    if (r instanceof Promise) {
        let rr = await r.then(arg => arg || {})
            .catch(ex => { return { retry: true, ex }; });
        if (rr && rr.retry) {
            if (!shouldRetry) return Promise.reject(rr.ex);
        }
        else return rr;
    }
    else {
        if (r) return new Promise(ok => ok(tryCnt));
        else if (!shouldRetry) return new Promise((_, fail) => fail(tryCnt));
    }
    if (shouldRetry) return await UtilityTool.delay(delay).then(() => retry(act, delay, maxRetry, ++tryCnt));
};
const HtmlMonitor = {
    _observer: null,
    waitForElement: function (selector, container, traceId) {
        return this.monitorElements(selector, container, traceId, true, true);
    },
    waitForElements: function (selector, container, traceId) {
        return this.monitorElements(selector, container, traceId, true);
    },
    monitorElement: function (selector, container, traceId) {
        return this.monitorElements(selector, container, traceId, false, true);
    },
    monitorElements: function (selector, container, traceId, once, firstElementOnly) {
        if (!traceId) traceId = new Date().getTime();
        return new Promise(resolve => {
            let items = container.querySelectorAll(selector);
            console.log('[Movie-No-Ads] Query for:', selector, 'in', container, traceId, location.href);
            if (items.length > 0) {
                if (firstElementOnly) resolve(items[0], container);
                else resolve(items, container);
            }
            if (!once || items.length == 0) {
                console.log('[Movie-No-Ads] Monitor', container, 'for', selector, traceId, location.href);
                const observer = new MutationObserver((_, sender) => {
                    let items = sender.targetNode.querySelectorAll(sender.selector);
                    if (items.length > 0) {
                        if (once) {
                            sender.disconnect();
                            console.log('[Movie-No-Ads] Stop monitoring:', sender.targetNode, 'for', sender.selector, location.href, sender.traceId);
                        }
                        if (firstElementOnly) resolve(items[0], sender.targetNode);
                        else resolve(items, sender.targetNode);

                    }
                });
                observer.traceId = traceId;
                observer.targetNode = container;
                observer.selector = selector;
                observer.observe(container, {
                    childList: true,
                    subtree: true,
                    attributes: true
                });

                console.log(traceId + '------------------------');
            }

        });
    },

    domReady: function (callback) {
        if (document.readyState === "complete") {
            callback();
        } else {
            window.addEventListener("load", callback, {
                once: true,
            });
        }
    }
};
const UtilityTool = {
    newId: function () {
        return Date.now().toString(18) + Math.random().toString(36);
        //return crypto.randomUUID().replaceAll('-', '');
    },
    delay: async (ms) => {
        if (!this.setTimeout) {
            var frame = document.createElement('iframe');
            this.setTimeout = frame.contentWindow.setTimeout;
        }
        return new Promise(resolve => {
            this.setTimeout(resolve, ms);
        });
    },
    waitFor: async function (check, callback, arg, timeout, waitId) {
        if(!timeout) timeout = 7000;
        if (!waitId) {
            waitId = 'waitForTime_' + this.newId();
            this[waitId] = new Date().getTime();
        }
        if (check(arg)) {
            if (callback) await callback(arg);
            else return new Promise(ok => ok(arg));
        }
        else {
            if (new Date().getTime() - this[waitId] < timeout) return await this.delay(500).then(() => this.waitFor(check, callback, arg, timeout, waitId));
            else {
                delete this[waitId];
                return new Promise((_, fail) => fail(arg));
            }
        }
    },
    isInDOM: function (el) {
        if (el.tagName == 'HTML') return true;
        else if (el.parentElement == null) return false;
        else return this.isInDOM(el.parentElement);
    },
    ensureInDOM: function (el, retry) {
        if (this.isInDOM(el)) {
            setTimeout((p) => UtilityTool.ensureInDOM(p.el, p.retry), 100, { el, retry });
        }
        else {
            console.log('[Movie-No-Ads] Not in DOM, retry', el);
            retry();
        }
    },
    getMaxZindex: function(){
        let zIndex_Max = -1;
        let maxZindexEl = null;
        var els = document.querySelectorAll('*');
        for(var el of els){
            const zIndex = window.getComputedStyle(el).zIndex;
            if(!isNaN(zIndex) && parseInt(zIndex)> zIndex_Max){
                zIndex_Max = parseInt(zIndex);
                maxZindexEl = el;
            }
        }
        return {zindex:zIndex_Max, element: maxZindexEl};
    },
    autoSkipButton: function (containerSelector, skipButtonSelectors) {
        HtmlMonitor.domReady(() => {
            HtmlMonitor.waitForElement(containerSelector, document.body).then(el => {
                UtilityTool.ensureInDOM(el, () => {
                    UtilityTool.autoSkipButton(containerSelector, skipButtonSelectors);
                });
                const observer = new MutationObserver((_, sender) => {
                    const container = sender.containerEl;
                    let skipBt = null;
                    for (let selector of skipButtonSelectors) {
                        skipBt = container.querySelector(selector);
                        if (skipBt) break;
                    }
                    if (skipBt) {
                        console.log('[Movie-No-Ads] Found skip button', skipBt);
                        const video = container.querySelector('video');
                        if (video && video.src && video.src != '') {
                            if (video.lastAdSrc) {
                                video.play();
                                return;
                            }
                            console.log('[Movie-No-Ads] Ad vid detected', video.src, video.duration);
                            video.lastAdSrc = video.src;
                            video.currentTime = video.duration ? video.duration : Number.MAX_SAFE_INTEGER;
                            retry(() => {
                                if (video.src == video.lastAdSrc) return video.play();
                                else return Promise.resolve({});
                            }).then(() => {
                                video.lastAdSrc = null;
                            });
                        }
                        setTimeout((bt)=>{bt.click()}, 500, skipBt);
                        //skipBt.click();
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
    },
    autoSkipAdVideo: function (containerSelector, adVideoDetectors, skipButtonSelectors) {
        HtmlMonitor.domReady(() => {
            HtmlMonitor.waitForElement(containerSelector, document.body).then(el => {
                UtilityTool.ensureInDOM(el, () => {
                    UtilityTool.autoSkipButton(containerSelector, skipButtonSelectors);
                });
                const observer = new MutationObserver((_, sender) => {
                    const container = sender.containerEl;
                    let adDetected = false;
                    for (let selector of adVideoDetectors) {
                        if (container.querySelector(selector)) {
                            adDetected = true;
                            break;
                        }
                    }
                    
                    if (adDetected) {
                        console.log('[Movie-No-Ads] Ad detected');
                        const video = container.querySelector('video');
                        if (video && video.src && video.src != '') {
                            if (video.lastAdSrc) {
                                video.currentTime = video.duration ? video.duration : Number.MAX_SAFE_INTEGER;
                                //video.play();
                                return;
                            }
                            console.log('[Movie-No-Ads] Ad video found', video.src, video.duration);
                            video.lastAdSrc = video.src;
                            video.currentTime = video.duration ? video.duration : Number.MAX_SAFE_INTEGER;
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
    },
    removeElements: function (elSelector) {
        console.log('[Movie-No-Ads] Waiting for elements to remove', elSelector);
        window.setInterval(function () {
            var els = document.querySelectorAll(elSelector);
            if(els.length > 0) {
                console.log('[Movie-No-Ads] Found elements to be removed', els);
                for(var el of els) el.remove();   
            }
        }, 500);

    },
    sendMessage: async (msg) => {
        let r = await chrome.runtime.sendMessage(msg)
            .then(r => { return r; })
            .catch(() => { return null; });
        if (r === null) r = await UtilityTool.sendMessage(msg);
        return r;
    },
    findParent: function(el, selector){
        if(el.matches(selector)) return el;
        else if(el.parentElement) return this.findParent(el.parentElement, selector);
        else return null;
    },
    findChild: function(el, selector){
        if(el.matches(selector)) return el;
        if(el.children) for(var child of el.children) return this.findChild(child, selector);
        else return null;
    }
};

console.log('[Movie-No-Ads] Common script is loaded', location.href);
