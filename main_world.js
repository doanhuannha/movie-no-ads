if (!window.mainWorld) {

    window.mainWorld = {
        post: () => { },
        port: {
            dataset: {
                enabled: true,
                shadow: false
            }
        },
        isInIframe: () => {
            try {
                return window.self !== window.top;
            } catch (e) {
                return true;
            }
        },
        registerCssRules: function (cssRules) {
            var style = document.createElement('style');
            style.textContent = cssRules;
            document.head.append(style);
        },
        getAllVideos: function () {
            const videoElements = [];

            // Get all video elements directly in the main document
            const mainVideos = document.querySelectorAll('video');
            videoElements.push(...mainVideos);

            // Get all iframes
            const iframes = document.querySelectorAll('iframe');

            iframes.forEach(iframe => {
                try {
                    // Access the iframe's content document
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

                    // Get video elements within the iframe
                    const iframeVideos = iframeDoc.querySelectorAll('video');
                    videoElements.push(...iframeVideos);
                } catch (err) {
                    // Handle cross-origin errors if necessary
                    console.error('Error accessing iframe:', err);
                }
            });

            return videoElements;
        }

    };
    window.mainWorld.blockPopup = (aggressive = 3) => {
        // validate a request
        const policy = (type, element, event, extra = {}) => {
            let block = true;
            /*
            switch (type) {
              case 'dynamic.form.submit':
              case 'element.click': {
                if (element.target != '_blank') block = false;
                break;
              }
            }
            */
            
            if(element) switch (element.tagName.toLowerCase()) {
                case 'a':
                case 'form': {
                    if (element.target != '_blank') block = false;
                }; break;
            }


            if (block) console.log('[Movie-No-Ads] ' + type + ' is disabled', element);
            else console.log('[Movie-No-Ads] Let ' + type + ' go', element);
            return { block };
        };
        //simulate a window
        const simulate = (id, root = {}, tree = []) => new Proxy(root, { // window.location.replace
            get(obj, key) {
                return typeof root[key] === 'function' ? function (...args) {
                    window.mainWorld.post('record', {
                        id,
                        tree,
                        action: {
                            method: key,
                            args
                        }
                    });
                } : simulate(id, root[key], [...tree, key]);
            },
            set(obj, key, value) {
                if (value) {
                    window.mainWorld.post('record', {
                        id,
                        tree,
                        action: {
                            value,
                            prop: key
                        }
                    });
                }
                return true;
            }
        });
        const protected = new WeakMap(); // keep reference of all protected window objects

        // mainWorld
        const mainWorld = {};

        mainWorld.frame = target => {
            const { src, tagName } = target;
            if (src && (tagName === 'IFRAME' || tagName === 'FRAME')) {
                const s = src.toLowerCase();
                if (s.startsWith('javascript:') || s.startsWith('data:')) {
                    try {
                        mainWorld.install(target.contentWindow);
                    }
                    catch (e) { }
                }
            }
        };

        mainWorld.onclick = e => {
            const a = e.target.closest('[target]') || e.target.closest('a');
            // if this is not a form or anchor element, ignore the click
            if (a && policy('element.click', a, e).block) {
                mainWorld.onclick.pointer.apply(e);
                return true;
            }
        };
        mainWorld.onclick.pointer = MouseEvent.prototype.preventDefault;

        mainWorld.install = (w = window) => {
            if (window.mainWorld.port.dataset.enabled === false || protected.has(w)) {
                return;
            }
            const doc = w.document;
            protected.set(w);

            // overwrites
            const { HTMLAnchorElement, HTMLFormElement } = w;
            HTMLAnchorElement.prototype.click = new Proxy(HTMLAnchorElement.prototype.click, {
                apply(target, self, args) {
                    const { block } = policy('dynamic.a.click', self);
                    return block ? undefined : Reflect.apply(target, self, args);
                }
            });
            HTMLAnchorElement.prototype.dispatchEvent = new Proxy(HTMLAnchorElement.prototype.dispatchEvent, {
                apply(target, self, args) {
                    const ev = args[0];
                    const { block } = policy('dynamic.a.dispatch', self, ev);
                    return block ? false : Reflect.apply(target, self, args);
                }
            });
            HTMLFormElement.prototype.submit = new Proxy(HTMLFormElement.prototype.submit, {
                apply(target, self, args) {
                    const { block } = policy('dynamic.form.submit', self);
                    return block ? false : Reflect.apply(target, self, args);
                }
            });
            HTMLFormElement.prototype.dispatchEvent = new Proxy(HTMLFormElement.prototype.dispatchEvent, {
                apply(target, self, args) {
                    const { block } = policy('dynamic.form.dispatch', self);
                    return block ? false : Reflect.apply(target, self, args);
                }
            });

            // iframe mess
            if (aggressive > 1) {
                const { HTMLIFrameElement, HTMLFrameElement } = w;

                const wf = Object.getOwnPropertyDescriptor(HTMLFrameElement.prototype, 'contentWindow');
                Object.defineProperty(HTMLFrameElement.prototype, 'contentWindow', {
                    configurable: true,
                    enumerable: true,
                    get: function () {
                        const w = wf.get.call(this);
                        try {
                            mainWorld.install(w);
                        }
                        catch (e) { }
                        return w;
                    }
                });
                const wif = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
                Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
                    configurable: true,
                    enumerable: true,
                    get: function () {
                        const w = wif.get.call(this);
                        try {
                            mainWorld.install(w);
                        }
                        catch (e) { }
                        return w;
                    }
                });
                const cf = Object.getOwnPropertyDescriptor(HTMLFrameElement.prototype, 'contentDocument');
                Object.defineProperty(HTMLFrameElement.prototype, 'contentDocument', {
                    configurable: true,
                    enumerable: true,
                    get: function () {
                        const d = cf.get.call(this);
                        try {
                            mainWorld.install(d.defaultView);
                        }
                        catch (e) { }
                        return d;
                    }
                });
                const cif = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentDocument');
                Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', {
                    configurable: true,
                    enumerable: true,
                    get: function () {
                        const d = cif.get.call(this);
                        try {
                            mainWorld.install(d.defaultView);
                        }
                        catch (e) { }
                        return d;
                    }
                });
            }

            // iframe creation with innerHTML
            if (aggressive > 2) {
                new MutationObserver(ms => {
                    for (const m of ms) {
                        for (const e of m.addedNodes) {
                            mainWorld.frame(e);
                            if (e.childElementCount) {
                                [...e.querySelectorAll('iframe')].forEach(mainWorld.frame);
                            }
                        }
                    }
                }).observe(doc, { childList: true, subtree: true });
            }

            // click 
            doc.addEventListener('click', mainWorld.onclick, true); // with capture;

            // window.open
            w.open = new Proxy(w.open, {
                apply(target, self, args) {
                    // do not block if window is opened inside a frame
                    const name = args[1];
                    if (name && typeof name === 'string' && frames[name]) {
                        return Reflect.apply(target, self, args);
                    }

                    const { id, block } = policy('window.open', {
                        href: args.length ? args[0] : ''
                    }, null, {
                        args
                    });
                    if (block) { // return a window or a window-liked object
                        if (window.mainWorld.port.dataset.shadow === true) {
                            const iframe = document.createElement('iframe');
                            iframe.style.display = 'none';
                            document.body.appendChild(iframe);
                            return iframe.contentWindow;
                        }
                        else {
                            return simulate(id, window);
                        }
                    }
                    return Reflect.apply(target, self, args);
                }
            });

            //* DOM replacement (document.open removes all the DOM listeners)
            let dHTML = doc.documentElement;
            doc.write = new Proxy(doc.write, {
                apply(target, self, args) {
                    const r = Reflect.apply(target, self, args);
                    if (dHTML !== self.documentElement) {
                        dHTML = self.documentElement;
                        self.addEventListener('click', mainWorld.onclick, true);
                    }
                    return r;
                }
            });
        };
        mainWorld.remove = (w = window, d = document) => {
            if (window.mainWorld.port.dataset.enabled === false && protected.has(w)) {
                protected.delete(w);
                d.removeEventListener('click', mainWorld.onclick);
            }
        };
        console.clear = function () {
            console.log('[Movie-No-Ads] console.clear is disabled');
        }
        // always install since we do not know the enabling status right now
        mainWorld.install();

        console.log('[Movie-No-Ads] Block popup is installed', location.href);
    };
}

if (window.mainWorld.isInIframe()) {
    window.mainWorld.blockPopup();
}
