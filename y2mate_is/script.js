HtmlMonitor.domReady(() => {
    window.setInterval(function () {
        var els = document.querySelectorAll('.tableVideo button[disabled].btn');
        if(els.length > 0) {
            console.log('[Movie-No-Ads][Y2M] Buttons found', els);
            for(const bt of els) bt.removeAttribute('disabled');   
        }
    }, 1000);
});

console.log('[Movie-No-Ads][Y2M] Starting to monitor download button...');
