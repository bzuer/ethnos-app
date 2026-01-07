class ethnos_appAPI {
    constructor() {
        const meta = document.querySelector('meta[name="ethnos-api-base"]');
        this.baseURL = meta && meta.content ? meta.content.trim() : '';
        this.cache = new Map();
        this.cacheTimeout = 300000;
        this.requestTimeout = 15000;
    }

    _getCacheKey(endpoint, params) {
        return endpoint + '_' + JSON.stringify(params || {});
    }

    _isValidCacheEntry(entry) {
        return entry && (Date.now() - entry.timestamp) < this.cacheTimeout;
    }

    async _fetch(endpoint, options = {}, retryCount = 2) {
        const cacheKey = this._getCacheKey(endpoint, options);
        const cachedEntry = this.cache.get(cacheKey);

        if (this._isValidCacheEntry(cachedEntry)) {
            return cachedEntry.data;
        }

        let lastError;
        const maxAttempts = retryCount + 1;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

                const fetchOptions = {
                    ...options,
                    signal: controller.signal,
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers
                    }
                };

                const response = await fetch(`${this.baseURL}${endpoint}`, fetchOptions);
                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`API Error: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                if (data.status === 'error') {
                    throw new Error(data.error || 'API returned error status');
                }
                this.cache.set(cacheKey, {
                    data: data,
                    timestamp: Date.now()
                });
                if (this.cache.size > 100) {
                    this._cleanCache();
                }

                return data;

            } catch (error) {
                lastError = error;

                if (error.name === 'AbortError') {
                    console.warn(`Request timeout (attempt ${attempt}/${maxAttempts}):`, endpoint);
                } else {
                    console.warn(`API fetch error (attempt ${attempt}/${maxAttempts}):`, error.message);
                }

                if (attempt < maxAttempts) {
                    const delay = 1000 * attempt;
                    console.log(`Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    if (error.name === 'AbortError') {
                        throw new Error('Timeout ao carregar dados. Tente recarregar a página.');
                    }
                    console.error('All retry attempts failed:', error);
                    throw error;
                }
            }
        }

        throw lastError;
    }

    _cleanCache() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.cacheTimeout) {
                this.cache.delete(key);
            }
        }
    }
    clearCache() {
        this.cache.clear();
    }

    async getAnalytics() {
        return this._fetch('/analytics/overview');
    }
    async getAnnualProduction() {
        return this._fetch('/analytics/annual-production');
    }
    async searchWorks(params = {}) {
        const queryParams = new URLSearchParams();
        
        if (params.q) queryParams.append('q', params.q);
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.page) queryParams.append('page', params.page);
        if (params.cursor) queryParams.append('cursor', params.cursor);
        if (params.sort) queryParams.append('sort', params.sort);

        const queryString = queryParams.toString();
        return this._fetch('/search/works' + (queryString ? '?' + queryString : ''));
    }

    async searchSphinx(params = {}) {
        const queryParams = new URLSearchParams();
        if (params.q) queryParams.append('q', params.q);
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.page) queryParams.append('page', params.page);
        if (params.sort) queryParams.append('sort', params.sort);
        const queryString = queryParams.toString();
        return this._fetch('/search/sphinx' + (queryString ? '?' + queryString : ''));
    }

    async getWork(id) {
        return this._fetch(`/works/${id}`);
    }

    async getVitrineWorks(params = {}) {
        const queryParams = new URLSearchParams();
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.page) queryParams.append('page', params.page);
        const queryString = queryParams.toString();
        return this._fetch('/works/vitrine' + (queryString ? '?' + queryString : ''));
    }
    async searchAuthors(name, limit = 25) {
        const queryParams = new URLSearchParams({
            name: name,
            limit: limit.toString()
        });
        return this._fetch(`/persons?${queryParams}`);
    }
    async getAuthor(id) {
        return this._fetch(`/persons/${id}`);
    }
    async getAuthorWorks(authorId, limit = 25, cursor = null) {
        const queryParams = new URLSearchParams({
            limit: limit.toString()
        });
        if (cursor) queryParams.append('cursor', cursor);
        
        return this._fetch(`/persons/${authorId}/works?${queryParams}`);
    }
    async getVenues(params = {}) {
        const queryParams = new URLSearchParams();
        
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.page) queryParams.append('page', params.page);
        if (params.offset) queryParams.append('offset', params.offset);

        const queryString = queryParams.toString();
        return this._fetch('/venues' + (queryString ? '?' + queryString : ''));
    }
    async getVenue(id) {
        return this._fetch(`/venues/${id}`);
    }
    async getVenueWorks(venueId, { limit = 25, page = 1, cursor = null } = {}) {
        const queryParams = new URLSearchParams({
            limit: limit.toString(),
            page: page.toString()
        });
        if (cursor) queryParams.append('cursor', cursor);
        return this._fetch(`/venues/${venueId}/works?${queryParams.toString()}`);
    }
    async getWorkMetrics(workId) {
        const res = await this._fetch(`/works/${workId}`);
        return res && res.data ? { status: 'success', data: res.data.metrics || {} } : { status: 'error' };
    }
    async getRecentWorks(limit = 10) {
        return this.searchWorks({ q: '*', limit: limit, sort: 'recent' });
    }
    async getTopVenues(limit = 10) {
        return this.getVenues({ limit: limit, offset: 0 });
    }
}
let api = new ethnos_appAPI();
