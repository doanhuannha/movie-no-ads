const manifest = chrome.runtime.getManifest();
console.log('[Movie-No-Ads] Service worker of ' + manifest.name + ' ' + manifest.version + 'is running...');

const ROOT_URL = 'http://dev-world.net/extensions/movie-no-ads';
//const ROOT_URL = 'http://localhost:7770/extensions/movie-no-ads1';
const CACHE_CONFIG_KEY = 'site-configs';
let movie_sites = null, ruleId = 5000, scriptId = 10;
const fetchJson = async (urls, cacheKey, defaultValue) => {
    let result = null;
    for (let url of urls) {
        result = await fetch(url, { cache: 'no-store' })
            .then(r => r.json())
            .then(r => r)
            .catch(() => null);
        if (result) return result;
    };
    if(cacheKey){
        //await chrome.storage.local.remove(cacheKey);
        result = await chrome.storage.local.get(cacheKey)
            .then(r=>r[cacheKey])
            .catch(() => null);
        if (result){
            console.log('[Movie-No-Ads] Load config from cache (storage)');
            return result;
        } 
    }
    console.log('[Movie-No-Ads] Load default config');
    return defaultValue;
};
const cleanUp = async () => {
    await chrome.declarativeNetRequest
        .getDynamicRules()
        .then(async (rules) => {
            console.log('[Movie-No-Ads] Clean up rules', rules);
            const oldRuleIds = rules.map(rule => rule.id);
            await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldRuleIds });
        });
    await chrome.scripting.getRegisteredContentScripts()
        .then(async (scripts) => {
            console.log('[Movie-No-Ads] Clean up scripts', scripts);
            const oldScriptIds = scripts.map(script => script.id);
            await chrome.scripting.unregisterContentScripts({ ids: oldScriptIds });
        });
    return;
};
const ifAnyIncludes = (url, domains) => {
    const protocol = (new URL(url)).protocol;
    for (let domain of domains) if (url.startsWith(protocol+'//'+domain)) return true;
    return false;
};

cleanUp().then(() => {
    chrome.scripting
        .registerContentScripts([
            {
                allFrames: true,
                runAt: 'document_start',
                matchOriginAsFallback: true,
                id: 'script_' + (++scriptId),
                js: ['common_scripts.js', 'startup_scripts.js'],
                matches: ['<all_urls>']
            },
            {
                allFrames: true,
                matchOriginAsFallback: true,
                runAt: 'document_start',
                id: 'script_' + (++scriptId),
                js: ['main_world.js'],
                matches: ['<all_urls>'],
                world: 'MAIN'
            }
        ])
        .catch((err) => console.warn('[Movie-No-Ads] iframe_sites script registration has unexpected error', err));
    chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [
            {
                id: ++ruleId,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [
                        {
                            header: 'user-agent',
                            operation: 'set',
                            value: 'Mozilla/5.0 (Linux; Tizen 6.0; SAMSUNG SM-Q900) AppleWebKit/537.36 (KHTML, like Gecko) TV Safari/537.36'
                            //value: 'Mozilla/5.0 (Linux; Tizen 2.3) AppleWebKit/538.1 (KHTML, like Gecko)Version/2.3 TV Safari/538.1'
                        },
                    ]
                },
                condition: {
                    regexFilter: '^https?://[0-9A-Za-z-.]*?(www.youtube.com)/tv/*',
                    resourceTypes: ['main_frame', 'sub_frame']
                }
            }
        ]
    });
    fetch('./configs.json').then(r=>r.json()).then(defVal=>{
        fetchJson([ROOT_URL + '/configs.json'], CACHE_CONFIG_KEY, defVal).then(configs => {
            if (configs == null) return;
            console.log('[Movie-No-Ads] Register content scrips and rules', configs);
            chrome.storage.local.set({[CACHE_CONFIG_KEY]: configs});
            movie_sites = configs.movie_sites;
            movie_sites.configVersion = configs.version;
            const resourceTypes = ['script', 'xmlhttprequest', 'media', 'websocket', 'webtransport']
            let rules = null;
            for (let site of configs.movie_sites) {
                site.matches = site.matches || [];
                for (let domain of site.domains) {
                    if (!site.matches.includes('*://' + domain + '/*')) site.matches.push('*://' + domain + '/*');// domain
                    if (!site.matches.includes('*://*.' + domain + '/*')) site.matches.push('*://*.' + domain + '/*');//sub domain
                }
                let scriptSettings = [{
                    allFrames: false,
                    runAt: 'document_start',
                    id: site.name + '_' + (++scriptId),
                    css: ['logo.css'],
                    matches: site.matches,
                    world: 'MAIN'
                },
                {
                    allFrames: true,
                    matchOriginAsFallback: false,
                    runAt: 'document_start',
                    id: site.name + '_' + (++scriptId),
                    js: ['block_popup.js'],
                    matches: site.matches,
                    world: 'MAIN'
                }];
                if (site.main_world_js) {
                    scriptSettings.push({
                        allFrames: true,
                        matchOriginAsFallback: false,
                        runAt: 'document_start',
                        id: site.name + '_' + (++scriptId),
                        js: site.main_world_js,
                        matches: site.matches,
                        world: 'MAIN'
                    });
                }
                if (site.js || site.css) {
                    scriptSettings.push({
                        allFrames: true,
                        matchOriginAsFallback: false,
                        runAt: 'document_start',
                        id: site.name + '_' + (++scriptId),
                        js: site.js,
                        css: site.css,
                        matches: site.matches
                    });
    
                }
                if (scriptSettings.length > 0) chrome.scripting
                    .registerContentScripts(scriptSettings)
                    .catch((err) => console.warn('[Movie-No-Ads] ' + site.name + ': script registration has unexpected error', err));
    
                rules = [];
                if(site.block_all_excepts && site.block_all_excepts.length > 0){
                    rules.push(
                        {
                            id: ++ruleId,
                            priority: 2,
                            action: {
                                type: 'block'
                            },
                            condition: {
                                initiatorDomains: site.domains,
                                resourceTypes
                            }
                        },
                        {
                            id: ++ruleId,
                            priority: 3,
                            action: {
                                type: 'allow'
                            },
                            condition: {
                                initiatorDomains: site.domains,
                                regexFilter: '^https?://[0-9A-Za-z-.]*?(' + site.domains.join('|') + ')/',
                                resourceTypes
                            }
                        },
                        {
                            id: ++ruleId,
                            priority: 3,
                            action: {
                                type: 'allow'
                            },
                            condition: {
                                initiatorDomains: site.domains,
                                regexFilter: '^https?://[0-9A-Za-z-.]*?(' + site.block_all_excepts.join('|') + ')/',
                                resourceTypes
                            }
                        }
                    );
                }
                else if (site.allow_all_excepts && site.allow_all_excepts.length > 0) {
                    rules.push(
                        {
                            id: ++ruleId,
                            priority: 2,
                            action: {
                                type: 'block'
                            },
                            condition: {
                                initiatorDomains: site.domains,
                                regexFilter: '^https?://[0-9A-Za-z-.]*?(' + site.allow_all_excepts.join('|') + ')/',
                                resourceTypes
                            }
                        }
                    );
                }
                if (site.disableCORS) {
                    rules.push(
                        {
                            id: ++ruleId,
                            priority: 1,
                            action: {
                                type: "modifyHeaders",
                                responseHeaders: [
                                    {
                                        operation: 'set',
                                        header: 'Access-Control-Allow-Origin',
                                        value: '*'
                                    },
                                    {
                                        operation: 'remove',
                                        header: 'Content-Security-Policy'
                                    },
                                    {
                                        operation: 'remove',
                                        header: 'Access-Control-Allow-Credentials'
                                    }
                                    
                                ]
                            },
                            condition: {
                                initiatorDomains: site.domains
                            }
                        }
                    );
                }
    
                if (rules.length > 0) chrome.declarativeNetRequest.updateDynamicRules({
                    addRules: rules
                });
                console.log('[Movie-No-Ads]', site.name, scriptSettings, rules);
            }
    
            rules = [];
            if (configs.block_sites) for (let dmn of configs.block_sites) {
                rules.push(
                    {
                        id: ++ruleId,
                        priority: 4,
                        action: {
                            type: 'block'
                        },
                        condition: {
                            regexFilter: '^https?://[0-9A-Za-z-.]*?(' + dmn + ')/'
                        }
                    }
                );
            }
            if (configs.block_urls) for (let reg of configs.block_urls) {
                rules.push(
                    {
                        id: ++ruleId,
                        priority: 5,
                        action: {
                            type: 'block'
                        },
                        condition: {
                            regexFilter: reg
                        }
                    }
                );
            }
            if (rules.length > 0) chrome.declarativeNetRequest.updateDynamicRules({
                addRules: rules
            });
            console.log('[Movie-No-Ads] Blocking rules', rules);
        });
    });
    

    chrome.runtime.onMessage.addListener(
        function (msg, sender, response) {
            console.log('[Movie-No-Ads] Received', msg, sender);

            if (!movie_sites) {
                console.log('[Movie-No-Ads] Site config is not ready', msg, sender.url);
                response(null);
                return;
            }
            if (!msg || msg.cmd != 'hi') return;

            const scripting = chrome.scripting;
            const currentTab = sender.tab;
            const frameId = sender.frameId;
            const inFrame = frameId > 0;
            console.log('msg.url', msg.url);
            const domain = (new URL(msg.url)).hostname;
            let siteFound = false;
            for (let site of movie_sites) {
                if (ifAnyIncludes(msg.url, site.domains)) {
                    siteFound = true;
                    if (site.remoteCss) {
                        if (site.remoteCss.startsWith('http')) fetch(site.remoteCss).then(r => r.text()).then(css => {
                            site.remoteCss = css;
                            scripting.insertCSS({ css, target: { tabId: currentTab.id, allFrames: true } });
                        });
                        else scripting.insertCSS({ css: site.remoteCss, target: { tabId: currentTab.id, allFrames: true } });
                    }

                    if (site.styles) {
                        const styles = site.styles;
                        if (styles.css) scripting.insertCSS({ css: styles.css, target: { tabId: currentTab.id, allFrames: true } }).then(r => { console.log('[Movie-No-Ads] Inject css successfully', styles.css, sender.url); });
                        else fetch('./styles.css').then(r => r.text()).then(css => {
                            //if(styles.logos) css = css.replace('[LOGO]', styles.logos.map(s => s + '::after').join(','));
                            if(styles.hiddens) css = css.replace('[HIDDEN]', styles.hiddens.join(','));
                            styles.css = css;
                            scripting.insertCSS({ css, target: { tabId: currentTab.id, allFrames: true } }).then(r => { console.log('[Movie-No-Ads] Inject css successfully', css, sender.url); });
                        });
                    }
                    site.configVersion = movie_sites.configVersion;
                    response(site);
                    break;
                }
            }
        }
    );
    console.log('[Movie-No-Ads] Listening msg from content script...', chrome.runtime.id);
});
