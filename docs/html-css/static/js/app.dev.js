class ClientCache {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 10 * 60 * 1000;
        this.storageKey = 'ethnos_app_cache';
        this.loadFromStorage();
    }

    _getCacheKey(key) {
        return key;
    }

    _isValidCacheEntry(entry) {
        return entry && (Date.now() - entry.timestamp < this.cacheTimeout);
    }

    get(key) {
        const cacheKey = this._getCacheKey(key);
        const entry = this.cache.get(cacheKey);
        
        if (this._isValidCacheEntry(entry)) {
            return entry.data;
        }
        
        if (entry) {
            this.cache.delete(cacheKey);
        }
        
        return null;
    }

    set(key, data) {
        const cacheKey = this._getCacheKey(key);
        const entry = {
            data: data,
            timestamp: Date.now()
        };
        
        this.cache.set(cacheKey, entry);
        this.saveToStorage();
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                const now = Date.now();
                
                for (const [key, entry] of Object.entries(parsed)) {
                    if (now - entry.timestamp < this.cacheTimeout) {
                        this.cache.set(key, entry);
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to load cache from storage:', e);
        }
    }

    saveToStorage() {
        try {
            const toStore = {};
            for (const [key, entry] of this.cache.entries()) {
                if (this._isValidCacheEntry(entry)) {
                    toStore[key] = entry;
                }
            }
            localStorage.setItem(this.storageKey, JSON.stringify(toStore));
        } catch (e) {
            console.warn('Failed to save cache to storage:', e);
        }
    }

    clear() {
        this.cache.clear();
        localStorage.removeItem(this.storageKey);
    }
}

const clientCache = new ClientCache();

async function preloadEssentialData() {
    try {
        if (window.INITIAL_DATA) {
            clientCache.set('homepage_data', window.INITIAL_DATA);
            delete window.INITIAL_DATA;
            return;
        }

        
    } catch (e) {
        console.debug('Preload error:', e);
    }
}

function loadMyListScript() {
    const s = document.createElement('script');
    s.src = '/static/js/my-list.min.js';
    s.onload = function() {
        console.log('MyList module loaded');
        updateReadingListCounter();
    };
    s.onerror = function() {
        console.error('Failed to load MyList module');
    };
    document.head.appendChild(s);
}

function updateReadingListCounter() {
    const counter = document.getElementById('reading-list-counter');
    if (counter && window.MyList) {
        const list = window.MyList.getPersonalList();
        const count = list ? list.length : 0;
        counter.textContent = count;
        if (count > 0) {
            counter.classList.add('active');
        } else {
            counter.classList.remove('active');
        }
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('search-form');
    let input = document.getElementById('search-input');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const q = input.value.trim();
            if (q) {
                window.location.href = '/search/results?q=' + encodeURIComponent(q);
            }
        });
    }
    if (!window.MyList) loadMyListScript();
    updateReadingListCounter();
    preloadEssentialData();
});

window.updateReadingListCounter = updateReadingListCounter;
