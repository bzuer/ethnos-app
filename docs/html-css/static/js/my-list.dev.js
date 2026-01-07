
const STORAGE_KEY = 'ethnos_app_personal_list';

function initializePersonalList() {
    loadPersonalList();
    setupExportFunctionality();
    updateGlobalCounter();
    setupEventHandlers();
}

function loadPersonalList() {
    const container = document.getElementById('personal-list-container');
    const exportSection = document.getElementById('export-section');
    const emptyMessage = document.getElementById('export-empty-message');
    
    if (!container) return;
    
    const items = getPersonalList();
    
    if (items.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p class="field-value">Sua lista pessoal está vazia.</p>
                <p class="description">Adicione itens visitando as páginas de detalhes dos trabalhos.</p>
            </div>
        `;
        
        if (exportSection) exportSection.classList.add('hidden');
        if (emptyMessage) emptyMessage.classList.remove('hidden');
        return;
    }
    
    if (exportSection) exportSection.classList.remove('hidden');
    if (emptyMessage) emptyMessage.classList.add('hidden');
    
    let html = `
        <div class="list-header">
            <p class="list-stats">
                <span class="field-value">${items.length} ${items.length === 1 ? 'item' : 'itens'} na sua lista</span>
                <span class="description">Adicionado${items.length === 1 ? '' : 's'} em ordem cronológica</span>
            </p>
        </div>
    `;
    
    html += `
        <table class="data-table personal-list-table" aria-label="Lista pessoal de trabalhos salvos">
            <thead>
                <tr>
                    <th scope="col">TÍTULO</th>
                    <th scope="col">AUTOR(ES)</th>
                    <th scope="col">ANO</th>
                    <th scope="col">AÇÕES</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    const sortedItems = [...items].reverse();
    
    sortedItems.forEach(item => {
        const authors = formatAuthorsForDisplay(item.authors);
        const title = escapeHtml(item.title || 'Título não disponível');
        const year = item.publication_year || 'N/A';
        
        html += `
            <tr data-item-id="${item.id}">
                <td class="field-value">
                    <a href="/works/${item.id}" 
                       class="action-link" 
                       aria-label="Ver detalhes de ${title}">
                        ${title}
                    </a>
                </td>
                <td class="field-value">${escapeHtml(authors)}</td>
                <td class="field-value">${year}</td>
                <td>
                    <button type="button" 
                            class="action-btn btn-negative remove-from-list-btn" 
                            data-item-id="${item.id}"
                            aria-label="Remover '${title}' da lista">
                        Remover
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function getPersonalList() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Error loading personal list:', error);
        return [];
    }
}

function savePersonalList(items) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        return true;
    } catch (error) {
        console.error('Error saving personal list:', error);
        showTemporaryMessage('Erro ao salvar lista. Verifique o espaço de armazenamento.', 'error');
        return false;
    }
}

function addToPersonalList(item) {
    if (!item || !item.id || !item.title) {
        return { success: false, message: 'Dados do item inválidos' };
    }
    
    const list = getPersonalList();
    
    if (list.some(existingItem => existingItem.id === item.id)) {
        return { success: false, message: 'Item já está na sua lista' };
    }
    
    const itemToSave = {
        id: item.id,
        title: item.title,
        authors: item.authors,
        publication_year: item.publication_year,
        venue_name: item.venue_name,
        type: item.type,
        added_at: new Date().toISOString()
    };
    
    list.push(itemToSave);
    
    if (savePersonalList(list)) {
        updateGlobalCounter();
        return { success: true, message: 'Item adicionado à sua lista' };
    }
    
    return { success: false, message: 'Erro ao adicionar item' };
}

function removeFromList(itemId) {
    const list = getPersonalList();
    const item = list.find(item => item.id === itemId);
    
    if (!item) {
        showTemporaryMessage('Item não encontrado na lista', 'error');
        return;
    }
    
    const updatedList = list.filter(item => item.id !== itemId);
    
    if (savePersonalList(updatedList)) {
        loadPersonalList();
        updateGlobalCounter();
        showTemporaryMessage(`"${item.title}" removido da lista`, 'success');
    }
}

function clearAllItems() {
    const list = getPersonalList();
    
    if (list.length === 0) {
        showTemporaryMessage('Sua lista já está vazia', 'info');
        return;
    }
    
    if (confirm('Tem certeza que deseja limpar toda a sua lista? Esta ação não pode ser desfeita.')) {
        localStorage.removeItem(STORAGE_KEY);
        loadPersonalList();
        updateGlobalCounter();
        showTemporaryMessage('Lista limpa com sucesso', 'success');
    }
}

function setupEventHandlers() {
    document.addEventListener('click', function(event) {
        const target = event.target;
        
        if (target.classList.contains('remove-from-list-btn')) {
            const itemId = parseInt(target.dataset.itemId);
            if (!isNaN(itemId)) {
                removeFromList(itemId);
            }
            return;
        }
        
        if (target.classList.contains('clear-all-btn') || target.id === 'clear-all-btn') {
            clearAllItems();
            return;
        }
    });
}

function setupExportFunctionality() {
    document.addEventListener('click', function(event) {
        const target = event.target;
        
        switch (target.id) {
            case 'export-txt-btn':
                exportABNT();
                break;
            case 'export-bib-btn':
                exportBibTeX();
                break;
            case 'export-ris-btn':
                exportRIS();
                break;
            case 'export-json-btn':
                exportJSON();
                break;
        }
    });
}

function updateGlobalCounter() {
    const counter = document.getElementById('reading-list-counter');
    if (counter) {
        const count = getPersonalList().length;
        counter.textContent = count;
        if (count > 0) {
            counter.classList.add('active');
        } else {
            counter.classList.remove('active');
        }
    }
    
    if (window.updateReadingListCounter) {
        window.updateReadingListCounter();
    }
}

function formatAuthorsForDisplay(authors) {
    if (Array.isArray(authors)) {
        return authors.map(author => {
            if (!author) return '';
            if (typeof author === 'string') return author;
            const preferred = author.preferred_name;
            const given = author.given_names;
            const family = author.family_name;
            const fallback = author.name || author.full_name;
            if (preferred && preferred.trim()) return preferred;
            if (family && given) return `${given} ${family}`.trim();
            return fallback || '';
        }).filter(Boolean).join('; ');
    }
    return authors || 'Autor não informado';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showTemporaryMessage(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `temporary-message temporary-message-${type}`;
    notification.textContent = message;
    notification.setAttribute('role', 'status');
    notification.setAttribute('aria-live', 'polite');

    document.body.appendChild(notification);

    setTimeout(() => {
        if (!notification.parentNode) return;
        notification.classList.add('fade-out');
        notification.addEventListener('transitionend', () => {
            if (notification.parentNode) notification.parentNode.removeChild(notification);
        }, { once: true });
    }, 3000);
}

// --- Normalization & formatting helpers (export refactor) ---
function _normAuthor(author) {
    if (!author) return null;
    if (typeof author === 'string') {
        const parts = author.trim().split(/\s+/);
        const family = parts.length ? parts[parts.length - 1] : '';
        const given = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
        return {
            family_name: family || null,
            given_names: given || null,
            preferred_name: author,
            identifiers: {},
            affiliation: null
        };
    }
    const affiliationName = (author.affiliation && typeof author.affiliation === 'object') ? author.affiliation.name : (author.affiliation || null);
    return {
        family_name: author.family_name || null,
        given_names: author.given_names || null,
        preferred_name: author.preferred_name || author.full_name || author.name || null,
        identifiers: author.identifiers || (author.orcid ? { orcid: author.orcid } : {}),
        affiliation: affiliationName || null
    };
}

function _normWork(raw) {
    if (!raw) return null;
    const authors = Array.isArray(raw.authors) ? raw.authors.map(_normAuthor).filter(Boolean) : [];
    const publication = raw.publication || {};
    const venue = raw.venue || {};
    const publisher = raw.publisher || {};
    const metrics = raw.metrics || {};
    const citations = raw.citations || {};
    const files = raw.files || raw.attachments || [];
    return {
        id: raw.id,
        work_type: raw.work_type || raw.type || null,
        title: raw.title || null,
        subtitle: raw.subtitle || null,
        abstract: raw.abstract || null,
        language: raw.language || null,
        doi: raw.doi || raw.temp_doi || null,
        publication: {
            year: publication.year || raw.publication_year || raw.year || null,
            volume: publication.volume || raw.volume || null,
            issue: publication.issue || raw.issue || null,
            pages: publication.pages || raw.pages || null,
            publication_date: publication.publication_date || null,
            open_access: publication.open_access || raw.open_access || false,
            peer_reviewed: publication.peer_reviewed || raw.peer_reviewed || false
        },
        venue: {
            id: venue.id || null,
            name: venue.name || raw.venue_name || null,
            type: venue.type || null,
            issn: venue.issn || null,
            eissn: venue.eissn || null
        },
        publisher: {
            id: publisher.id || null,
            name: publisher.name || raw.publisher_name || null,
            country: (publisher.country_code || publisher.country || null)
        },
        authors: authors,
        metrics: {
            citation_count: metrics.citation_count || metrics.cited_by || (citations.cited_by || null),
            download_count: metrics.download_count || null,
            file_count: metrics.file_count || (Array.isArray(files) ? files.length : null)
        },
        citations: {
            cited_by: citations.cited_by || null,
            references: citations.references || null
        },
        files: Array.isArray(files) ? files : []
    };
}

function _primaryAuthorKey(nw) {
    const a0 = (nw.authors && nw.authors[0]) || null;
    if (!a0) return 'zzzz';
    const base = a0.family_name || (a0.preferred_name ? a0.preferred_name.split(' ').pop() : '') || 'zzzz';
    return base.toLowerCase();
}

function _sortWorks(nws) {
    return [...nws].sort((a, b) => {
        const aKey = _primaryAuthorKey(a);
        const bKey = _primaryAuthorKey(b);
        if (aKey !== bKey) return aKey.localeCompare(bKey);
        const ay = a.publication.year || 0;
        const by = b.publication.year || 0;
        if (ay !== by) return ay - by;
        const at = (a.title || '').toLowerCase();
        const bt = (b.title || '').toLowerCase();
        return at.localeCompare(bt);
    });
}

function _authorsABNT(authors) {
    if (!Array.isArray(authors) || authors.length === 0) return 'Autor não informado';
    return authors.map(a => {
        const fam = (a.family_name || '').toUpperCase();
        const given = a.given_names || '';
        if (!fam && !given && a.preferred_name) return a.preferred_name;
        return fam ? `${fam}, ${given}`.trim() : given;
    }).join('; ');
}

function _authorsBibTeX(authors) {
    if (!Array.isArray(authors) || authors.length === 0) return '';
    return authors.map(a => {
        const fam = a.family_name || (a.preferred_name ? a.preferred_name.split(' ').pop() : '') || '';
        const given = a.given_names || (a.preferred_name ? a.preferred_name.split(' ').slice(0, -1).join(' ') : '') || '';
        return fam && given ? `${fam}, ${given}` : (a.preferred_name || fam || given);
    }).join(' and ');
}

function _escapeBib(text) {
    if (!text) return '';
    return String(text).replace(/[\\{}]/g, '').replace(/[\u0000-\u001F]/g, '');
}

function _escapeRIS(text) {
    if (!text) return '';
    return String(text).replace(/[\r\n\t]/g, ' ').trim();
}

function _entryTypes(nw) {
    const t = (nw.work_type || '').toUpperCase();
    switch (t) {
        case 'ARTICLE': return { bib: 'article', ris: 'JOUR' };
        case 'BOOK': return { bib: 'book', ris: 'BOOK' };
        case 'CHAPTER': return { bib: 'incollection', ris: 'CHAP' };
        case 'CONFERENCE': return { bib: 'inproceedings', ris: 'CONF' };
        case 'THESIS': return { bib: 'phdthesis', ris: 'THES' };
        case 'REPORT': return { bib: 'techreport', ris: 'RPRT' };
        case 'DATASET': return { bib: 'misc', ris: 'DATA' };
        default:
            if (nw.venue && (nw.venue.name || nw.publication.volume || nw.publication.issue)) return { bib: 'article', ris: 'JOUR' };
            return { bib: 'misc', ris: 'GEN' };
    }
}

function _citeKey(nw) {
    const fam = _primaryAuthorKey(nw).replace(/[^a-z]/g, '') || 'work';
    const year = nw.publication.year || 'nodate';
    const slug = (nw.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12);
    return `${fam}${year}${slug || 'ref'}${nw.id}`;
}

async function fetchCompleteWorkData(itemIds) {
    if (itemIds.length === 0) return [];

    const meta = document.querySelector('meta[name="ethnos-api-base"]');
    const apiBase = (meta && meta.content ? meta.content.trim() : '') || '';

    try {
        const detailedWorks = await Promise.all(
            itemIds.map(async (id) => {
                try {
                    if (typeof api !== 'undefined' && api && typeof api.getWork === 'function') {
                        const res = await api.getWork(id);
                        return res && res.data ? res.data : null;
                    }
                    const resp = await fetch(`${apiBase}/works/${id}`);
                    if (!resp.ok) return null;
                    const json = await resp.json();
                    return json && json.data ? json.data : null;
                } catch (error) {
                    console.error(`Error fetching work ${id}:`, error);
                    return null;
                }
            })
        );

        return detailedWorks.filter(Boolean);
    } catch (error) {
        console.error('Error fetching complete work data:', error);
        showTemporaryMessage('Erro ao buscar dados completos. Usando dados locais.', 'error');
        return [];
    }
}

async function exportABNT() {
    const items = getPersonalList();
    if (items.length === 0) {
        showTemporaryMessage('Sua lista está vazia. Não há nada para exportar.', 'info');
        return;
    }
    
    showTemporaryMessage('Gerando documento DOCX...', 'info');

    // Refactored: build DOCX with complete, normalized data
    const completeDataRef = await fetchCompleteWorkData(items.map(item => item.id));
    const normalizedRef = _sortWorks(completeDataRef.map(_normWork).filter(Boolean));
    try {
        const g = (typeof window !== 'undefined' && window.docx) ? window.docx : (typeof docx !== 'undefined' ? docx : null);
        if (!g) throw new Error('docx not loaded');
        const { Document, Packer, Paragraph, TextRun, AlignmentType } = g;
        const children = [];
        children.push(
            new Paragraph({ children: [ new TextRun({ text: 'REFERÊNCIAS — ABNT NBR 6023:2018', bold: true }) ] }),
            new Paragraph({ text: `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}` }),
            new Paragraph({ text: `Total: ${normalizedRef.length} referências` }),
            new Paragraph({ text: '' })
        );
        normalizedRef.forEach(w => {
            const authorsText = _authorsABNT(w.authors);
            const t = (w.work_type || '').toUpperCase();
            const title = w.title || '';
            const subtitle = w.subtitle ? `: ${w.subtitle}` : '';
            const year = w.publication.year || '';
            const pages = w.publication.pages || '';
            const vol = w.publication.volume || '';
            const num = w.publication.issue && w.publication.issue !== 'None' ? w.publication.issue : '';
            const venue = w.venue && w.venue.name ? w.venue.name : '';
            const publisher = w.publisher && w.publisher.name ? w.publisher.name : '';
            const country = w.publisher && w.publisher.country ? w.publisher.country : '';
            const doi = w.doi ? `DOI: https://doi.org/${w.doi}` : '';
            const runs = [];
            runs.push(new TextRun({ text: `${authorsText}. ` }));
            if (t === 'BOOK' || t === 'THESIS' || (!venue && publisher)) {
                runs.push(new TextRun({ text: `${title}${subtitle}. `, italics: true }));
                const pubseg = [country, publisher].filter(Boolean).join(': ');
                if (pubseg) runs.push(new TextRun({ text: `${pubseg}, ` }));
                if (year) runs.push(new TextRun({ text: `${year}. ` }));
                if (pages) runs.push(new TextRun({ text: `p. ${pages}. ` }));
            } else {
                runs.push(new TextRun({ text: `${title}${subtitle}. ` }));
                if (venue) runs.push(new TextRun({ text: `${venue}`, italics: true }));
                const volIssue = [vol ? `, v. ${vol}` : '', num ? `, n. ${num}` : ''].join('');
                if (venue && (vol || num)) runs.push(new TextRun({ text: volIssue }));
                if (pages) runs.push(new TextRun({ text: `${(venue || vol || num) ? ', ' : ''}p. ${pages}` }));
                if (year) runs.push(new TextRun({ text: `${(venue || vol || num || pages) ? ', ' : ''}${year}. ` }));
            }
            if (w.language) runs.push(new TextRun({ text: `Idioma: ${w.language}. ` }));
            if (doi) runs.push(new TextRun({ text: doi }));
            children.push(new Paragraph({ children: runs, alignment: AlignmentType.JUSTIFY }));
        });
        children.push(new Paragraph({ text: '' }));
        children.push(new Paragraph({ text: 'Gerado por Ethnos Academic Database', alignment: AlignmentType.CENTER, italics: true }));
        const doc = new Document({ sections: [{ children }] });
        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `referencias-abnt-${new Date().toISOString().split('T')[0]}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showTemporaryMessage('Referências ABNT exportadas em formato DOCX', 'success');
        return; // stop here; old implementation below is bypassed
    } catch (e) {
        showTemporaryMessage('Falha na exportação DOCX (ABNT).', 'error');
        return;
    }
    const completeData = await fetchCompleteWorkData(items.map(item => item.id));
    
    let Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType;
    try {
        const docxGlobal = (typeof window !== 'undefined' && window.docx) ? window.docx : (typeof docx !== 'undefined' ? docx : null);
        if (!docxGlobal) throw new Error('docx not loaded');
        ({ Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docxGlobal);
    } catch (err) {
        showTemporaryMessage('Exportar ABNT (DOCX) indisponível. Biblioteca não carregada.', 'error');
        return;
    }
    
    const children = [];
    
    children.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: "INFORMAÇÕES DA EXPORTAÇÃO",
                    bold: true
                })
            ]
        }),
        new Paragraph({
            text: `Data: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`
        }),
        new Paragraph({
            text: `Total de referências: ${items.length}`
        }),
        new Paragraph({
            text: `Dados completos obtidos: ${completeData.length}`
        }),
        new Paragraph({
            text: "Fonte: Ethnos Academic Database"
        }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
            children: [
                new TextRun({
                    text: "REFERÊNCIAS",
                    bold: true
                })
            ]
        }),
        new Paragraph({ text: "" })
    );
    
    items.forEach((item, index) => {
        const work = completeData.find(data => data.id === item.id) || item;
        
        let authorsText = 'AUTOR NÃO INFORMADO';
        if (work.authors && Array.isArray(work.authors) && work.authors.length > 0) {
            authorsText = work.authors.map((author) => {
                if (!author) return '';
                const family = author.family_name;
                const given = author.given_names;
                const preferred = author.preferred_name;
                const fallback = author.name || author.full_name || (typeof author === 'string' ? author : '');

                if (family && given) return `${String(family).toUpperCase()}, ${given}`;
                if (preferred) {
                    const parts = preferred.trim().split(/\s+/);
                    if (parts.length > 1) {
                        const last = parts.pop();
                        const firsts = parts.join(' ');
                        return `${String(last).toUpperCase()}, ${firsts}`;
                    }
                    return String(preferred).toUpperCase();
                }
                if (fallback) {
                    const parts = String(fallback).trim().split(/\s+/);
                    if (parts.length > 1) {
                        const last = parts.pop();
                        const firsts = parts.join(' ');
                        return `${String(last).toUpperCase()}, ${firsts}`;
                    }
                    return String(fallback).toUpperCase();
                }
                return '';
            }).filter(Boolean).join('; ');
        } else if (work.authors) {
            authorsText = String(work.authors).toUpperCase();
        }
        
        const title = work.title || 'Título não informado';
        const subtitle = work.subtitle ? `: ${work.subtitle}` : '';
        const year = work.publication?.year || work.year || 'S.d.';
        const venue = work.venue?.name || work.venue_name || '';
        const publisher = work.publisher?.name || work.publisher_name || '';
        const volume = work.publication?.volume || work.volume || '';
        const issue = work.publication?.issue || work.issue || '';
        const pages = work.publication?.pages || work.pages || '';
        const doi = work.doi || '';
        const issn = work.venue?.issn || '';
        const workType = work.work_type || work.type || '';
        const language = work.language || '';
        const openAccess = work.publication?.open_access || work.open_access;
        const peerReviewed = work.publication?.peer_reviewed || work.peer_reviewed;
        
        let referenceText = `${authorsText}. ${title}${subtitle}. `;
        
        if (venue) {
            referenceText += `${venue}, `;
            if (volume) referenceText += `v. ${volume}, `;
            if (issue && issue !== 'None') referenceText += `n. ${issue}, `;
        }
        if (publisher && venue) referenceText += `${publisher}, `;
        else if (publisher) referenceText += `${publisher}, `;
        
        referenceText += `${year}.`;
        
        if (pages) referenceText += ` p. ${pages}.`;
        if (doi) {
            referenceText += ` Disponível em: https://doi.org/${doi}. Acesso em: ${new Date().toLocaleDateString('pt-BR')}.`;
        }
        
        children.push(
            new Paragraph({
                text: referenceText,
                alignment: AlignmentType.JUSTIFY,
                spacing: {
                    after: 240
                }
            })
        );
    });
    
    const stats = {
        total: items.length,
        withAbstract: completeData.filter(w => w.abstract && w.abstract.length > 0).length,
        withDOI: completeData.filter(w => w.doi).length,
        openAccess: completeData.filter(w => w.publication?.open_access || w.open_access).length,
        peerReviewed: completeData.filter(w => w.publication?.peer_reviewed || w.peer_reviewed).length
    };
    
    children.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: "ESTATÍSTICAS",
                    bold: true
                })
            ]
        }),
        new Paragraph({
            text: `Total de referências: ${stats.total}`
        }),
        new Paragraph({
            text: `Com resumo: ${stats.withAbstract} (${Math.round(stats.withAbstract/stats.total*100)}%)`
        }),
        new Paragraph({
            text: `Com DOI: ${stats.withDOI} (${Math.round(stats.withDOI/stats.total*100)}%)`
        }),
        new Paragraph({
            text: `Acesso aberto: ${stats.openAccess} (${Math.round(stats.openAccess/stats.total*100)}%)`
        }),
        new Paragraph({
            text: `Revisado por pares: ${stats.peerReviewed} (${Math.round(stats.peerReviewed/stats.total*100)}%)`
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
            text: "Gerado por Ethnos Academic Database - ethnos.app",
            alignment: AlignmentType.CENTER,
            italic: true
        }),
        new Paragraph({ text: "" }),
        
        new Paragraph({
            text: "Se este software foi útil para sua pesquisa, considere citá-lo:",
            italic: true
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
            text: "CRUZ, Bruno Cesar Cunha. Ethnos.app Academic Bibliography API. Versão 2.0.0. 2025. DOI: 10.5281/zenodo.17049435. Disponível em: https://api.ethnos.app. Acesso em: " + new Date().toLocaleDateString('pt-BR') + "."
        })
    );
    
    const doc = new Document({
        sections: [{
            children: children
        }]
    });
    
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = `referencias-abnt-${new Date().toISOString().split('T')[0]}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showTemporaryMessage('Referências ABNT exportadas em formato DOCX', 'success');
}

function formatWorkType(type) {
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

function formatLanguage(language) {
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

async function exportBibTeX() {
    const items = getPersonalList();
    if (items.length === 0) {
        showTemporaryMessage('Sua lista está vazia. Não há nada para exportar.', 'info');
        return;
    }
    // Refactored BibTeX export using complete /works/:id and normalized mapping
    try {
        const complete = await fetchCompleteWorkData(items.map(i => i.id));
        const normalized = _sortWorks(complete.map(_normWork).filter(Boolean));
        let contentRef = '';
        contentRef += '% ==================================================================\n';
        contentRef += '% Ethnos.app — Exportação BibTeX (completa)\n';
        contentRef += `% Gerado: ${new Date().toLocaleString('pt-BR')}\n`;
        contentRef += `% Registros: ${normalized.length}\n`;
        contentRef += '% ==================================================================\n\n';
        normalized.forEach((nw) => {
            const types = _entryTypes(nw);
            const key = _citeKey(nw);
            const authors = _authorsBibTeX(nw.authors);
            const title = _escapeBib(nw.title);
            const subtitle = _escapeBib(nw.subtitle);
            const fullTitle = subtitle ? `${title}: ${subtitle}` : title;
            const year = nw.publication.year || '';
            const month = nw.publication.publication_date ? (nw.publication.publication_date.split('-')[1] || '') : '';
            const pages = nw.publication.pages || '';
            const vol = nw.publication.volume || '';
            const num = nw.publication.issue && nw.publication.issue !== 'None' ? nw.publication.issue : '';
            const doi = nw.doi || '';
            const venue = nw.venue.name || '';
            const issn = nw.venue.issn || '';
            const eissn = nw.venue.eissn || '';
            const publisher = nw.publisher.name || '';
            const address = nw.publisher.country || '';
            const lang = nw.language || '';
            const abstract = nw.abstract ? _escapeBib(nw.abstract).slice(0, 1000) : '';
            contentRef += `@${types.bib}{${key},\n`;
            if (authors) contentRef += `  author       = {${authors}},\n`;
            if (fullTitle) contentRef += `  title        = {${fullTitle}},\n`;
            if (venue && (types.bib === 'article' || types.bib === 'inproceedings')) contentRef += `  journal      = {${_escapeBib(venue)}},\n`;
            if (venue && types.bib === 'incollection') contentRef += `  booktitle    = {${_escapeBib(venue)}},\n`;
            if (publisher) contentRef += `  publisher    = {${_escapeBib(publisher)}},\n`;
            if (address) contentRef += `  address      = {${_escapeBib(address)}},\n`;
            if (year) contentRef += `  year         = {${year}},\n`;
            if (month) contentRef += `  month        = {${month}},\n`;
            if (vol) contentRef += `  volume       = {${vol}},\n`;
            if (num) contentRef += `  number       = {${num}},\n`;
            if (pages) contentRef += `  pages        = {${pages}},\n`;
            if (doi) { contentRef += `  doi          = {${doi}},\n`; contentRef += `  url          = {https://doi.org/${doi}},\n`; }
            if (issn) contentRef += `  issn         = {${issn}},\n`;
            if (eissn) contentRef += `  eissn        = {${eissn}},\n`;
            if (lang) contentRef += `  language     = {${lang}},\n`;
            if (abstract) contentRef += `  abstract     = {${abstract}},\n`;
            if (nw.metrics.citation_count) contentRef += `  citations    = {${nw.metrics.citation_count}},\n`;
            if (nw.metrics.file_count) contentRef += `  files        = {${nw.metrics.file_count}},\n`;
            contentRef += `  id           = {${nw.id}}\n`;
            contentRef += `}\n\n`;
        });
        downloadFile(contentRef, `bibliografia-${new Date().toISOString().split('T')[0]}.bib`, 'text/plain');
        showTemporaryMessage('Bibliografia BibTeX exportada com formatação profissional', 'success');
        return;
    } catch (e) {
        console.error('BibTeX export error', e);
        // fall back to legacy below if needed
    }
    
    showTemporaryMessage('Buscando dados completos...', 'info');
    const completeData = await fetchCompleteWorkData(items.map(item => item.id));
    
    let content = '';
    content += '%================================================================\n';
    content += '%                    BIBLIOGRAFIA BIBTEX                        \n';
    content += '%                   Ethnos Academic Database                    \n';  
    content += '%================================================================\n';
    content += '%\n';
    content += `% Exportado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}\n`;
    content += `% Total de referências: ${items.length}\n`;
    content += `% Dados completos obtidos: ${completeData.length}\n`;
    content += `% Formato: BibTeX padrão para LaTeX\n`;
    content += `% Fonte: ethnos.app\n`;
    content += '%\n';
    content += '%----------------------------------------------------------------\n\n';
    
    items.forEach(item => {
        const work = completeData.find(data => data.id === item.id) || item;
        
        let authorsText = '';
        if (work.authors && Array.isArray(work.authors)) {
            authorsText = work.authors.map(author => {
                if (!author) return '';
                const family = author.family_name;
                const given = author.given_names;
                const preferred = author.preferred_name;
                const fallback = author.name || author.full_name || (typeof author === 'string' ? author : '');
                if (family && given) return `${family}, ${given}`;
                if (preferred) {
                    const parts = preferred.split(' ');
                    if (parts.length > 1) {
                        const lastName = parts.pop();
                        const firstNames = parts.join(' ');
                        return `${lastName}, ${firstNames}`;
                    }
                    return preferred;
                }
                const parts = fallback.split(' ');
                if (parts.length > 1) {
                    const lastName = parts.pop();
                    const firstNames = parts.join(' ');
                    return `${lastName}, ${firstNames}`;
                }
                return fallback;
            }).filter(Boolean).join(' and ');
        } else if (work.authors) {
            authorsText = String(work.authors).replace(/;/g, ' and');
        }
        
        const title = (work.title || '').replace(/[{}]/g, '');
        const subtitle = work.subtitle ? ` - ${work.subtitle}` : '';
        const year = work.publication?.year || work.year || '';
        const venue = work.venue?.name || work.venue_name || '';
        const volume = work.publication?.volume || work.volume || '';
        const issue = work.publication?.issue || work.issue || '';
        const pages = work.publication?.pages || work.pages || '';
        const doi = work.doi || '';
        const issn = work.venue?.issn || '';
        const publisher = work.publisher?.name || work.publisher_name || '';
        const language = work.language || '';
        const abstract = work.abstract || '';
        
        let entryType = 'misc';
        const workType = work.work_type || work.type || '';
        
        entryType = 'misc';
        
        let citeKey = `work${work.id}`;
        if (work.authors && Array.isArray(work.authors) && work.authors[0]) {
            const a0 = work.authors[0];
            const surname = a0.family_name || (a0.preferred_name ? a0.preferred_name.split(' ').pop() : '') || (a0.name || a0.full_name || '').split(' ').pop() || '';
            const yearStr = year ? year.toString() : 'nodate';
            citeKey = `${surname.toLowerCase()}${yearStr}work${work.id}`;
        }
        
        content += `% -------- Referência ${items.indexOf(item) + 1}/${items.length} --------\n`;
        content += `@${entryType}{${citeKey},\n`;
        
        
        content += `  id        = {${work.id}},\n`;
        if (authorsText) content += `  author    = {${authorsText}},\n`;
        content += `  title     = {${title}${subtitle}},\n`;
        if (workType) content += `  type      = {${workType}},\n`;
        
        
        if (year) content += `  year      = {${year}},\n`;
        if (venue) content += `  journal   = {${venue}},\n`;
        if (publisher) content += `  publisher = {${publisher}},\n`;
        if (volume) content += `  volume    = {${volume}},\n`;
        if (issue && issue !== 'None') content += `  number    = {${issue}},\n`;
        if (pages) content += `  pages     = {${pages}},\n`;
        
        
        if (work.publication?.publication_date) {
            content += `  date      = {${work.publication.publication_date}},\n`;
        }
        
        
        if (doi) {
            content += `  doi       = {${doi}},\n`;
            content += `  url       = {https://doi.org/${doi}},\n`;
        }
        if (issn) content += `  issn      = {${issn}},\n`;
        if (work.venue?.eissn) content += `  eissn     = {${work.venue.eissn}},\n`;
        
        
        if (language) content += `  language  = {${language}},\n`;
        if (abstract) {
            const cleanAbstract = abstract.replace(/[{}\\\\]/g, '').substring(0, 500);
            content += `  abstract  = {${cleanAbstract}${abstract.length > 500 ? '...' : ''}},\n`;
        }
        
        
        if (work.authors && Array.isArray(work.authors)) {
            const authorDetails = work.authors.map(author => {
                const baseName = author.preferred_name || [author.given_names, author.family_name].filter(Boolean).join(' ') || author.name || author.full_name || '';
                const orcid = author.identifiers && author.identifiers.orcid ? author.identifiers.orcid : author.orcid;
                const affiliationName = author.affiliation && typeof author.affiliation === 'object' ? author.affiliation.name : author.affiliation;
                let details = baseName;
                if (orcid) details += ` (ORCID: ${orcid})`;
                if (affiliationName) details += ` [${affiliationName}]`;
                return details;
            }).join('; ');
            if (authorDetails !== authorsText) {
                content += `  authors_detailed = {${authorDetails}},\n`;
            }
        }
        
        
        if (work.venue?.id) content += `  venue_id  = {${work.venue.id}},\n`;
        if (work.venue?.type) content += `  venue_type = {${work.venue.type}},\n`;
        
        
        if (work.publisher?.id) content += `  publisher_id = {${work.publisher.id}},\n`;
        if (work.publisher?.country) content += `  country   = {${work.publisher.country}},\n`;
        
        
        if (work.metrics?.citation_count) content += `  citations = {${work.metrics.citation_count}},\n`;
        if (work.metrics?.file_count) content += `  files     = {${work.metrics.file_count}},\n`;
        
        
        const notes = [];
        if (work.publication?.open_access || work.open_access) notes.push('Open Access');
        if (work.publication?.peer_reviewed || work.peer_reviewed) notes.push('Peer Reviewed');
        if (work.data_source) notes.push(`Source: ${work.data_source}`);
        if (notes.length > 0) {
            content += `  note      = {${notes.join(', ')}},\n`;
        }
        
        
        content += '}\n\n';
    });
    
    content += '%----------------------------------------------------------------\n';
    content += `% ${items.length} referências exportadas\n`;
    content += `% Gerado por ethnos.app\n`;
    content += '%----------------------------------------------------------------';
    
    downloadFile(content, `bibliografia-${new Date().toISOString().split('T')[0]}.bib`, 'text/plain');
    showTemporaryMessage('Bibliografia BibTeX exportada com formatação profissional', 'success');
}

async function exportRIS() {
    const items = getPersonalList();
    if (items.length === 0) {
        showTemporaryMessage('Sua lista está vazia. Não há nada para exportar.', 'info');
        return;
    }
    // Refactored RIS export using complete /works/:id and normalized mapping
    try {
        const complete = await fetchCompleteWorkData(items.map(i => i.id));
        const normalized = _sortWorks(complete.map(_normWork).filter(Boolean));
        let contentRef = '';
        normalized.forEach((nw) => {
            const types = _entryTypes(nw);
            const title = _escapeRIS((nw.title || '') + (nw.subtitle ? `: ${nw.subtitle}` : ''));
            const year = nw.publication.year || '';
            const date = nw.publication.publication_date || '';
            const venue = nw.venue.name || '';
            const vol = nw.publication.volume || '';
            const num = nw.publication.issue && nw.publication.issue !== 'None' ? nw.publication.issue : '';
            const pages = nw.publication.pages || '';
            const publisher = nw.publisher.name || '';
            const country = nw.publisher.country || '';
            const issn = nw.venue.issn || '';
            const doi = nw.doi || '';
            const langMap = { pt: 'por', en: 'eng', es: 'spa', fr: 'fre', de: 'ger', it: 'ita' };
            const lang = nw.language ? (langMap[nw.language] || nw.language.toLowerCase()) : '';
            contentRef += `TY  - ${types.ris}\n`;
            if (title) contentRef += `TI  - ${title}\n`;
            if (Array.isArray(nw.authors)) {
                nw.authors.forEach(a => {
                    const fam = a.family_name || (a.preferred_name ? a.preferred_name.split(' ').pop() : '') || '';
                    const given = a.given_names || (a.preferred_name ? a.preferred_name.split(' ').slice(0, -1).join(' ') : '') || '';
                    const name = fam && given ? `${fam}, ${given}` : (a.preferred_name || fam || given);
                    if (name) contentRef += `AU  - ${_escapeRIS(name)}\n`;
                    if (a.affiliation) contentRef += `AD  - ${_escapeRIS(a.affiliation)}\n`;
                    if (a.identifiers && a.identifiers.orcid) contentRef += `UR  - https://orcid.org/${a.identifiers.orcid}\n`;
                });
            }
            if (venue) contentRef += `${types.ris === 'JOUR' ? 'JO' : 'T2'}  - ${_escapeRIS(venue)}\n`;
            if (year) contentRef += `PY  - ${year}\n`;
            if (date) contentRef += `Y1  - ${date}\n`;
            if (vol) contentRef += `VL  - ${vol}\n`;
            if (num) contentRef += `IS  - ${num}\n`;
            if (pages) {
                if (pages.includes('-')) {
                    const [start, end] = pages.split('-');
                    contentRef += `SP  - ${start.trim()}\n`;
                    if (end && end.trim()) contentRef += `EP  - ${end.trim()}\n`;
                } else {
                    contentRef += `SP  - ${pages}\n`;
                }
            }
            if (publisher) contentRef += `PB  - ${_escapeRIS(publisher)}\n`;
            if (country) contentRef += `CY  - ${_escapeRIS(country)}\n`;
            if (doi) { contentRef += `DO  - ${doi}\n`; contentRef += `UR  - https://doi.org/${doi}\n`; }
            if (issn) contentRef += `SN  - ${issn}\n`;
            if (nw.abstract) contentRef += `AB  - ${_escapeRIS(nw.abstract).slice(0, 1000)}\n`;
            if (lang) contentRef += `LA  - ${lang}\n`;
            if (nw.metrics.citation_count) contentRef += `N1  - Cited by: ${nw.metrics.citation_count}\n`;
            contentRef += `ID  - ${nw.id}\n`;
            contentRef += 'ER  - \n\n';
        });
        downloadFile(contentRef, `referencias-${new Date().toISOString().split('T')[0]}.ris`, 'application/x-research-info-systems');
        showTemporaryMessage('Bibliografia RIS exportada com sucesso', 'success');
        return;
    } catch (e) {
        console.error('RIS export error', e);
        // fall back to legacy below if needed
    }
    
    showTemporaryMessage('Buscando dados completos...', 'info');
    const completeData = await fetchCompleteWorkData(items.map(item => item.id));
    
    let content = '';
    
    items.forEach(item => {
        const work = completeData.find(data => data.id === item.id) || item;
        
        let risType = 'JOUR';
        const workType = (work.work_type || work.type || '').toUpperCase();
        const venue = work.venue?.name || work.venue_name;
        const volume = work.publication?.volume || work.volume;
        const issue = work.publication?.issue || work.issue;
        
        if (venue && (work.venue?.type === 'JOURNAL' || venue.toLowerCase().includes('journal') || volume || issue)) {
            risType = 'JOUR';
        } else {
            switch (workType) {
                case 'ARTICLE':
                    risType = 'JOUR';
                    break;
                case 'BOOK':
                    risType = venue ? 'JOUR' : 'BOOK';
                    break;
                case 'CHAPTER':
                    risType = 'CHAP';
                    break;
                case 'THESIS':
                    risType = 'THES';
                    break;
                case 'CONFERENCE':
                    risType = 'CONF';
                    break;
                case 'REPORT':
                    risType = 'RPRT';
                    break;
                case 'DATASET':
                    risType = 'DATA';
                    break;
                default:
                    risType = venue ? 'JOUR' : 'GEN';
            }
        }
        
        content += `TY  - ${risType}\n`;
        
        if (work.title) {
            const fullTitle = work.title + (work.subtitle ? ` - ${work.subtitle}` : '');
            content += `TI  - ${fullTitle}\n`;
        }
        
        if (Array.isArray(work.authors)) {
            work.authors.forEach(author => {
                if (!author) return;
                const family = author.family_name;
                const given = author.given_names;
                const preferred = author.preferred_name;
                const fallback = author.name || author.full_name || (typeof author === 'string' ? author : '');
                let authorName = '';
                if (family && given) authorName = `${family}, ${given}`;
                else if (preferred) authorName = preferred;
                else authorName = fallback;
                if (authorName) {
                    content += `AU  - ${authorName}\n`;
                    const affiliationName = author.affiliation && typeof author.affiliation === 'object' ? author.affiliation.name : author.affiliation;
                    if (affiliationName) {
                        content += `AD  - ${affiliationName}\n`;
                    }
                    const orcid = author.identifiers && author.identifiers.orcid ? author.identifiers.orcid : author.orcid;
                    if (orcid) {
                        content += `UR  - https://orcid.org/${orcid}\n`;
                    }
                }
            });
        } else if (work.authors) {
            content += `AU  - ${work.authors}\n`;
        }
        
        if (venue) {
            if (risType === 'JOUR') {
                content += `JO  - ${venue}\n`;
            } else {
                content += `T2  - ${venue}\n`;
            }
        }
        
        const year = work.publication?.year || work.year;
        if (year) content += `PY  - ${year}\n`;
        
        if (volume) content += `VL  - ${volume}\n`;
        
        if (issue && issue !== 'None') content += `IS  - ${issue}\n`;
        
        const pages = work.publication?.pages || work.pages;
        if (pages) {
            if (pages.includes('-')) {
                const [start, end] = pages.split('-');
                content += `SP  - ${start.trim()}\n`;
                if (end && end.trim()) content += `EP  - ${end.trim()}\n`;
            } else {
                content += `SP  - ${pages}\n`;
            }
        }
        
        const publisher = work.publisher?.name || work.publisher_name;
        if (publisher) content += `PB  - ${publisher}\n`;
        
        const doi = work.doi;
        if (doi) {
            content += `DO  - ${doi}\n`;
            content += `UR  - https://doi.org/${doi}\n`;
        }
        
        const issn = work.venue?.issn;
        if (issn) content += `SN  - ${issn}\n`;
        
        if (work.abstract) {
            const cleanAbstract = work.abstract.replace(/[\\r\n\\t]/g, ' ').substring(0, 1000);
            content += `AB  - ${cleanAbstract}${work.abstract.length > 1000 ? '...' : ''}\n`;
        }
        
        if (work.language) {
            const langMap = {
                'pt': 'por', 'en': 'eng', 'es': 'spa', 'fr': 'fre', 
                'de': 'ger', 'it': 'ita', 'Eng': 'eng', 'Ita': 'ita', 'Por': 'por'
            };
            const langCode = langMap[work.language] || work.language.toLowerCase();
            content += `LA  - ${langCode}\n`;
        }
        
        const keywords = [];
        if (work.publication?.peer_reviewed || work.peer_reviewed) {
            keywords.push('peer-reviewed');
        }
        if (work.publication?.open_access || work.open_access) {
            keywords.push('open-access');
        }
        if (workType) {
            keywords.push(workType.toLowerCase());
        }
        if (keywords.length > 0) {
            content += `KW  - ${keywords.join(', ')}\n`;
        }
        
        content += `DB  - ethnos_app\n`;
        content += `DP  - Ethnos Academic Database\n`;
        
        content += `DA  - ${new Date().toISOString().split('T')[0]}\n`;
        
        content += 'ER  - \n\n';
    });
    
    
    downloadFile(content, `referencias-${new Date().toISOString().split('T')[0]}.ris`, 'application/x-research-info-systems');
    showTemporaryMessage('Bibliografia RIS exportada com sucesso', 'success');
}

async function exportJSON() {
    const items = getPersonalList();
    if (items.length === 0) {
        showTemporaryMessage('Sua lista está vazia. Não há nada para exportar.', 'info');
        return;
    }
    
    // Refactored JSON export: include full /works/:id and normalized view
    try {
        const complete = await fetchCompleteWorkData(items.map(i => i.id));
        const normalized = _sortWorks(complete.map(_normWork).filter(Boolean));
        const exportData = {
            metadata: {
                format: 'ethnos_json_export',
                version: '3.0',
                exported_at: new Date().toISOString(),
                generator: 'ethnos_app Personal List',
                total_items: normalized.length
            },
            works: complete,
            normalized: normalized
        };
        downloadFile(JSON.stringify(exportData, null, 2), `referencias-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
        showTemporaryMessage('Dados JSON exportados com sucesso', 'success');
        return;
    } catch (e) {
        console.error('JSON export error', e);
        // fallback to legacy minimal export omitted
        showTemporaryMessage('Erro na exportação JSON.', 'error');
        return;
    }
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

 
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        initializePersonalList();
    });
} else {
    
    initializePersonalList();
}

window.MyList = {
    loadPersonalList: loadPersonalList,
    addToPersonalList: addToPersonalList,
    removeFromList: removeFromList,
    getPersonalList: getPersonalList,
    clearAllItems: clearAllItems,
    updateGlobalCounter: updateGlobalCounter,
    exportABNT: exportABNT,
    exportBibTeX: exportBibTeX,
    exportRIS: exportRIS,
    exportJSON: exportJSON
};
