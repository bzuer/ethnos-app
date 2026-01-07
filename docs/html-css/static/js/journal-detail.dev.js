let currentPublicationsPage = 1;
let totalPublicationsPages = 1;
const publicationsPerPage = 25;

function getVenueDataFromPage() {
    const el = document.getElementById('venue-data');
    if (!el) return null;
    return {
        venueId: el.dataset.venueId,
        totalPublications: parseInt(el.dataset.totalPublications) || 0
    };
}

function updatePublicationsPagination() {
    const pagination = document.getElementById('publications-pagination');
    const pageInfo = document.getElementById('publications-page-info');
    const prevBtn = document.getElementById('prev-publications');
    const nextBtn = document.getElementById('next-publications');
    if (!pagination || !pageInfo || !prevBtn || !nextBtn) return;

    if (totalPublicationsPages > 1) {
        pagination.classList.remove('hidden');
        pageInfo.textContent = `Página ${currentPublicationsPage} de ${totalPublicationsPages}`;
        prevBtn.disabled = currentPublicationsPage === 1;
        prevBtn.className = currentPublicationsPage === 1 ? 'action-btn pagination-btn' : 'action-btn btn-negative';
        nextBtn.disabled = currentPublicationsPage === totalPublicationsPages;
        nextBtn.className = currentPublicationsPage === totalPublicationsPages ? 'action-btn pagination-btn' : 'action-btn btn-positive';
    } else {
        pagination.classList.add('hidden');
    }
}

async function loadVenueDetails() {
    const ctx = getVenueDataFromPage();
    if (!ctx || !ctx.venueId) return;
    try {
        const res = await api.getVenue(ctx.venueId);
        const payload = res && res.data ? res.data : null;
        if (!payload) return;
        document.querySelector('.page-title').textContent = payload.name || 'Periódico';
        const esc = (t) => { const d = document.createElement('div'); d.textContent = t == null ? '' : String(t); return d.innerHTML; };
        let html = '<table class="data-table item-detail-table"><tbody>';
        html += `<tr><th scope="row">NOME</th><td class=\"field-value\">${esc(payload.name || 'N/A')}</td></tr>`;
        html += `<tr><th scope=\"row\">ISSN</th><td class=\"field-value\">${esc(payload.issn || payload.eissn || 'N/A')}</td></tr>`;
        html += `<tr><th scope=\"row\">EDITORA</th><td class=\"field-value\">${esc((payload.publisher && payload.publisher.name) || 'N/A')}</td></tr>`;
        if (payload.coverage_start_year && payload.coverage_end_year) {
            html += `<tr><th scope=\"row\">PERÍODO</th><td class=\"field-value\">${esc(payload.coverage_start_year)} - ${esc(payload.coverage_end_year)}</td></tr>`;
        }
        if (payload.country_code) {
            html += `<tr><th scope=\"row\">PAÍS</th><td class=\"field-value\">${esc(payload.country_code)}</td></tr>`;
        }
        html += `<tr><th scope=\"row\">TOTAL DE PUBLICAÇÕES</th><td class=\"field-value\">${esc(payload.works_count || 0)}</td></tr>`;
        html += '</tbody></table>';
        document.getElementById('venue-details').innerHTML = html;
    } catch (e) {
        console.error('Erro carregando venue:', e);
    }
}

async function loadVenuePublications(page = 1) {
    const ctx = getVenueDataFromPage();
    if (!ctx || !ctx.venueId) return;
    try {
        const resp = await api.getVenueWorks(ctx.venueId, { limit: publicationsPerPage, page });
        const data = resp && resp.data ? resp.data : [];
        const container = document.getElementById('venue-publications');
        const esc = (t) => { const d = document.createElement('div'); d.textContent = t == null ? '' : String(t); return d.innerHTML; };
        if (!data || data.length === 0) {
            container.innerHTML = '<p class="field-value">Nenhuma publicação encontrada neste periódico.</p>';
            return;
        }
        let html = '<table class="data-table venue-publications-table" aria-describedby="venue-publications-title">';
        html += '<thead><tr>';
        html += '<th scope="col">TÍTULO</th>';
        html += '<th scope="col">AUTOR(ES)</th>';
        html += '<th scope="col">ANO</th>';
        html += '</tr></thead><tbody>';
        data.forEach(pub => {
            html += '<tr>';
            const safeTitle = esc(pub.title || '');
            const authors = Array.isArray(pub.authors_preview) ? pub.authors_preview.slice(0,2).join(', ') + (pub.author_count && pub.author_count > 2 ? ' et al.' : '') : (pub.author_string || 'Não informado');
            const year = pub.publication_year || (pub.publication && pub.publication.year) || 'N/A';
            const type = pub.work_type || pub.type || 'N/A';
            html += `<td class="field-value"><a class="action-link" href="/work/${pub.id}" aria-label="Ver detalhes de ${safeTitle}">${safeTitle}</a></td>`;
            html += `<td class="field-value">${esc(authors)}</td>`;
            html += `<td class="result-type">${esc(String(type))}</td>`;
            html += `<td class="field-value">${esc(String(year))}</td>`;
            html += '</tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;

        currentPublicationsPage = page;
        const p = resp.pagination || (resp.meta && resp.meta.pagination) || null;
        totalPublicationsPages = p && p.totalPages ? p.totalPages : Math.max(1, Math.ceil((p && p.total ? p.total : (ctx.totalPublications || data.length)) / publicationsPerPage));
        updatePublicationsPagination();
    } catch (e) {
        console.error('Erro carregando publicações:', e);
    }
}

function initializePagination() {
    const prevBtn = document.getElementById('prev-publications');
    const nextBtn = document.getElementById('next-publications');
    if (prevBtn) prevBtn.addEventListener('click', () => currentPublicationsPage > 1 && loadVenuePublications(currentPublicationsPage - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => currentPublicationsPage < totalPublicationsPages && loadVenuePublications(currentPublicationsPage + 1));
}

document.addEventListener('DOMContentLoaded', function() {
    const ctx = getVenueDataFromPage();
    if (!ctx || !ctx.venueId) return;
    initializePagination();
    if (!document.querySelector('.page-title').textContent.trim()) {
        loadVenueDetails();
    }
    loadVenuePublications();
});

window.loadPreviousPublications = loadPreviousPublications;
window.loadNextPublications = loadNextPublications;
