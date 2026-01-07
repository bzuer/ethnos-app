class SearchHandler {
    constructor() {
        this.currentQuery = '';
        this.currentPage = 1;
        this.resultsPerPage = 25;
        this.totalResults = 0;
        this.isLoading = false;
        this.autocompleteTimeout = null;
        this.selectedSuggestionIndex = -1;
    }

    init() {
        document.querySelectorAll('form[role="search"]').forEach(form => {
            form.addEventListener('submit', e => {
                if (window.location.pathname === '/search/results') {
                    e.preventDefault();
                    this.handleFormSubmission(form);
                }
            });
        });

        

        if (window.location.pathname === '/search/results') {
            this.handleResultsPage();
        }
        this.setupPagination();
    }

    setupAutocomplete() { }

    async fetchAutocomplete(query) { }

    renderInlineAutocomplete() { }

    clearGhost() { }

    renderAutocomplete() { }

    highlightQuery(text) {
        const query = document.getElementById('search-input').value.trim();
        if (!query) return this.escapeHTML(text);
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const safeText = this.escapeHTML(text);
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        return safeText.replace(regex, '<strong>$1</strong>');
    }

    formatSuggestionType(type) { return type; }

    selectSuggestion() { }

    updateSuggestionHighlight() { }

    hideAutocomplete() { this.selectedSuggestionIndex = -1; }

    handleFormSubmission(form) {
        const formData = new FormData(form);
        const params = this.buildSearchParams(formData);
        
        if (params.q || this.hasAdvancedParams(formData)) {
            const urlParams = new URLSearchParams(params).toString();
            window.history.pushState({}, '', '/search/results?' + urlParams);
            this.performSearch(params);
            this.hideAutocomplete();
        } else {
            this.showError('Preencha pelo menos um campo de busca.');
        }
    }

    buildSearchParams(formData) {
        let params = {};
        
        if (formData.get('q')) {
            params.q = formData.get('q').trim();
        }
        
        ['title', 'author', 'abstract', 'subject', 'venue', 'publisher', 'type', 'language'].forEach(field => {
            if (formData.get(field)) {
                params[field] = formData.get(field).trim();
            }
        });
        
        if (formData.get('year_start')) {
            params.year_start = formData.get('year_start');
        }
        if (formData.get('year_end')) {
            params.year_end = formData.get('year_end');
        }
        if (formData.get('sort')) {
            params.sort = formData.get('sort');
        }
        
        params.limit = this.resultsPerPage;
        
        return params;
    }

    hasAdvancedParams(formData) {
        return ['title', 'author', 'abstract', 'subject', 'venue', 'publisher'].some(field => 
            formData.get(field)
        );
    }

    handleResultsPage() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('q') || this.hasAdvancedUrlParams(urlParams)) {
            const params = Object.fromEntries(urlParams.entries());
            this.performSearch(params);
        }
    }

    hasAdvancedUrlParams(urlParams) {
        return ['title', 'author', 'abstract', 'subject', 'venue', 'publisher'].some(field => 
            urlParams.has(field)
        );
    }

    async performSearch(params) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading();
        
        try {
            
            let results = await api.searchSphinx(params);
            let normalized = null;

            if (results && results.data && Array.isArray(results.data)) {
                normalized = results;
            } else if (results && results.data && results.data.results) {
                normalized = {
                    status: results.status,
                    data: results.data.results,
                    pagination: results.data.pagination || results.pagination || null,
                    meta: results.meta || {}
                };
            }

            if (!normalized || !normalized.data || normalized.data.length === 0) {
                results = await api.searchWorks(params);
                normalized = results;
            }

            this.displayResults(normalized, params);
            this.currentQuery = params.q || 'Busca Avançada';
            const total = (normalized.pagination && (normalized.pagination.total || normalized.pagination.totalResults)) || (normalized.data ? normalized.data.length : 0);
            this.totalResults = total;
            
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Erro ao realizar busca. Tente novamente.');
        } finally {
            this.isLoading = false;
        }
    }

    displayResults(results, params) {
        const container = document.querySelector('.results-container') || 
                         document.querySelector('section[aria-labelledby="search-results"]');
        
        if (!container) {
            console.error('Results container not found');
            return;
        }

        const total = (results.pagination && (results.pagination.total || results.pagination.totalResults)) || (results.data ? results.data.length : 0);
        this.updateSearchHeader(params, total);

        if (results.data && results.data.length > 0) {
            this.renderSortControls(container, params);
            this.renderResults(results.data, container);
            
            if (results.pagination) {
                this.renderPagination(results, container);
            }
        } else {
            this.renderNoResults(params.q, container);
        }
    }

    renderResults(works, container) {
        const resultsHTML = works.map(work => {
            const relevanceScore = work.relevance_score ? 
                `<span class="relevance-score">Score: ${this.escapeHTML(String(work.relevance_score))}</span>` : '';
            const peerReviewed = work.peer_reviewed ? 
                '<span class="badge peer-reviewed">Revisado por Pares</span>' : '';
            const safeTitle = this.escapeHTML(work.title || 'Título não disponível');
            const safeSubtitle = work.subtitle ? ' - ' + this.escapeHTML(work.subtitle) : '';
            const authorsPreview = Array.isArray(work.authors_preview) ? work.authors_preview.slice(0,2).join(', ') + (work.author_count && work.author_count > 2 ? ' et al.' : '') : null;
            const safeAuthors = this.escapeHTML(work.formatted_authors || authorsPreview || work.author_string || 'Autor não informado');
            const safeYear = (work.publication_year || (work.publication && work.publication.year) || work.year) ? this.escapeHTML(String(work.publication_year || (work.publication && work.publication.year) || work.year)) : '';
            const safeVenue = work.venue && work.venue.name ? this.escapeHTML(work.venue.name) : (work.venue_name ? this.escapeHTML(work.venue_name) : '');
            const safeDoi = (work.doi || (work.publication && work.publication.doi)) ? this.escapeHTML(String(work.doi || (work.publication && work.publication.doi))) : '';
            const safeAbstract = work.abstract ? this.escapeHTML(work.abstract.substring(0, 300)) + (work.abstract.length > 300 ? '...' : '') : '';
            return `
                <article class="result-item">
                    <h3 class="result-title">
                        <a href="/work/${work.id}" class="result-link">
                            ${safeTitle}${safeSubtitle}
                        </a>
                        ${relevanceScore}
                    </h3>
                    <div class="result-meta">
                        <span class="result-authors">${safeAuthors}</span>
                        ${safeYear ? `<span class="result-year"> • ${safeYear}</span>` : ''}
                        ${work.work_type ? `<span class="result-type"> • ${this.formatWorkType(work.work_type)}</span>` : ''}
                        ${work.language ? `<span class="result-language"> • ${this.formatLanguage(work.language)}</span>` : ''}
                        ${peerReviewed}
                    </div>
                    ${safeVenue ? `
                        <div class="result-venue">
                            <strong>Publicado em:</strong> ${safeVenue}
                        </div>
                    ` : ''}
                    ${safeDoi ? `
                        <div class="result-doi">
                            <strong>DOI:</strong> <a href="https://doi.org/${safeDoi}" target="_blank" rel="noopener noreferrer">${safeDoi}</a>
                        </div>
                    ` : ''}
                    ${safeAbstract ? `
                        <div class="result-abstract">
                            <p>${safeAbstract}</p>
                        </div>
                    ` : ''}
                    <div class="result-actions">
                        <a href="/work/${work.id}" class="action-btn btn-positive">Ver Detalhes</a>
                        ${safeDoi ? `<a href="https://doi.org/${safeDoi}" target="_blank" rel="noopener noreferrer" class="action-btn">Acesso Direto</a>` : ''}
                    </div>
                </article>
            `;
        }).join('');
        container.innerHTML = `<div class="results-container">${resultsHTML}</div>`;
    }

    formatWorkType(type) {
        const types = {
            'ARTICLE': 'Artigo',
            'BOOK': 'Livro',
            'CHAPTER': 'Capítulo',
            'THESIS': 'Tese/Dissertação',
            'CONFERENCE': 'Artigo de Evento',
            'REPORT': 'Relatório',
            'DATASET': 'Dataset',
            'OTHER': 'Outro'
        };
        return types[type] || type;
    }

    formatLanguage(language) {
        const languages = {
            'pt': 'Português',
            'en': 'Inglês',
            'es': 'Espanhol',
            'fr': 'Francês',
            'de': 'Alemão',
            'it': 'Italiano'
        };
        return languages[language] || language;
    }

    renderNoResults(query, container) {
        const safeQuery = this.escapeHTML(query || '');
        const html = query && query !== 'Busca Avançada' ? `
            <div class="no-results">
                <p>Nenhum resultado encontrado para "<strong>${safeQuery}</strong>".</p>
                <p>Tente usar termos diferentes ou verifique a ortografia.</p>
            </div>
        ` : `
            <div class="info-message">
                <p>Preencha pelo menos um campo de busca para ver os resultados.</p>
            </div>
        `;
        container.innerHTML = html;
    }

    updateSearchHeader(params, total) {
        const header = document.querySelector('.page-header');
        if (!header) return;

        const query = params.q || 'Busca Avançada';
        
        let summaryEl = header.querySelector('.search-summary') || document.createElement('p');
        let statsEl = header.querySelector('.search-stats') || document.createElement('p');
        
        summaryEl.className = 'search-summary';
        summaryEl.innerHTML = `Resultados para: "<strong>${this.escapeHTML(query)}</strong>"`;
        
        statsEl.className = 'search-stats';
        statsEl.innerHTML = this.escapeHTML(total.toLocaleString('pt-BR')) + ' resultados encontrados';
        
        if (!header.querySelector('.search-summary')) header.appendChild(summaryEl);
        if (!header.querySelector('.search-stats')) header.appendChild(statsEl);
    }

    renderPagination(results, container) {
        if (!results.pagination || results.pagination.totalPages <= 1) return;

        const { page, totalPages } = results.pagination;
        const paginationHTML = `
            <nav class="pagination-nav" aria-label="Navegação de páginas de resultados">
                <button class="action-btn pagination-btn js-page-prev" ${page <= 1 ? 'disabled' : ''} 
                        data-target-page="${page - 1}" aria-label="Página anterior">
                    « Anterior
                </button>
                <span class="pagination-info">Página ${page} de ${totalPages}</span>
                <button class="action-btn pagination-btn js-page-next" ${page >= totalPages ? 'disabled' : ''} 
                        data-target-page="${page + 1}" aria-label="Próxima página">
                    Próximo »
                </button>
            </nav>
        `;

        const resultsContainer = container.querySelector('.results-container');
        resultsContainer.insertAdjacentHTML('afterend', paginationHTML);

        
        const nav = resultsContainer.nextElementSibling;
        if (nav && nav.classList.contains('pagination-nav')) {
            nav.addEventListener('click', (ev) => {
                const btn = ev.target.closest('button[data-target-page]');
                if (!btn || btn.disabled) return;
                const target = parseInt(btn.getAttribute('data-target-page'), 10);
                if (!Number.isNaN(target)) this.goToPage(target);
            }, { once: true });
        }
    }

    goToPage(page) {
        if (page < 1 || this.isLoading) return;

        this.currentPage = page;
        const urlParams = new URLSearchParams(window.location.search);
        const params = Object.fromEntries(urlParams.entries());
        params.page = page;

        const newUrl = '/search/results?' + new URLSearchParams(params).toString();
        window.history.pushState({}, '', newUrl);
        
        this.performSearch(params);
    }

    setupPagination() {
        window.addEventListener('popstate', () => {
            if (window.location.pathname === '/search/results') {
                this.handleResultsPage();
            }
        });
    }

    showLoading() {
        const container = document.querySelector('section[aria-labelledby="search-results"]');
        if (container) {
            container.innerHTML = '<p class="field-value">Realizando busca...</p>';
        }
    }

    showError(message) {
        const container = document.querySelector('section[aria-labelledby="search-results"]');
        if (container) {
            container.innerHTML = `<div class="error-message"><p>${this.escapeHTML(message)}</p></div>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    window.searchHandler = new SearchHandler();
    window.searchHandler.init();
});
SearchHandler.prototype.escapeHTML = function (str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};
