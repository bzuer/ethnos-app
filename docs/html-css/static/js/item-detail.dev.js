
function initializeItemActions() {
    const addToListBtn = document.getElementById("add-to-list-btn");
    const shareBtn = document.getElementById("share-btn");
    const printBtn = document.getElementById("print-btn");
    
    if (addToListBtn) {
        addToListBtn.addEventListener("click", handleAddToList);
        setTimeout(checkIfItemInList, 100);
    }
    
    if (shareBtn) {
        shareBtn.addEventListener("click", handleShare);
    }
    
    if (printBtn) {
        printBtn.addEventListener("click", handlePrint);
    }
}

function handleShare() {
    const btn = document.getElementById("share-btn");
    const title = btn.dataset.title || document.title;
    const url = window.location.href;
    
    if (navigator.share) {
        navigator.share({
            title: title,
            url: url
        }).catch(error => {
            console.warn('Sharing cancelled or failed:', error);
            fallbackCopyToClipboard(url);
        });
    } else {
        fallbackCopyToClipboard(url);
    }
}

function fallbackCopyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Link copiado para a área de transferência');
        }).catch(() => {
            showNotification('Erro ao copiar link');
        });
    } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showNotification('Link copiado para a área de transferência');
        } catch (err) {
            showNotification('Erro ao copiar link');
        }
        document.body.removeChild(textArea);
    }
}

function handlePrint() {
    window.print();
}

function handleAddToList() {
    const itemData = extractItemDataFromPage();
    
    if (!itemData) {
        showNotification('Erro ao obter dados do item', 'error');
        return;
    }
    
    if (!window.MyList || !window.MyList.addToPersonalList) {
        showNotification('Módulo de lista não disponível. Recarregue a página', 'error');
        return;
    }
    
    const result = window.MyList.addToPersonalList(itemData);
    
    if (result.success) {
        showAddToListSuccess(result.message);
        updateAddToListButton(true);
    } else {
        showNotification(result.message, result.success ? 'success' : 'error');
    }
}

function extractItemDataFromPage() {
    try {
        const titleElement = document.querySelector('.page-title');
        const title = titleElement ? titleElement.textContent.trim() : null;
        
        if (!title) return null;
        
        const pathParts = window.location.pathname.split('/');
        const workId = pathParts[pathParts.length - 1];
        
        if (!workId || isNaN(parseInt(workId))) return null;
        
        let authors = null;
        let publicationYear = null;
        let venueName = null;
        let type = null;
        
        const rows = document.querySelectorAll('table tr');
        
        for (const row of rows) {
            const th = row.querySelector('th');
            const td = row.querySelector('td');
            
            if (!th || !td) continue;
            
            const label = th.textContent.trim();
            
            switch (label) {
                case 'AUTOR(ES)':
                    const authorLinks = td.querySelectorAll('a.action-link');
                    if (authorLinks.length > 0) {
                        authors = Array.from(authorLinks).map(link => ({
                            full_name: link.textContent.trim()
                        }));
                    } else {
                        const authorText = td.textContent.trim();
                        if (authorText && authorText !== 'Não informado') {
                            authors = authorText;
                        }
                    }
                    break;
                    
                case 'ANO':
                    const yearText = td.textContent.trim();
                    if (yearText && yearText !== 'N/A') {
                        publicationYear = parseInt(yearText) || yearText;
                    }
                    break;
                    
                case 'PERIÓDICO':
                    const venueLink = td.querySelector('a.action-link');
                    if (venueLink) {
                        venueName = venueLink.textContent.trim();
                    } else {
                        const venueText = td.textContent.trim();
                        if (venueText && venueText !== 'N/A') {
                            venueName = venueText;
                        }
                    }
                    break;
                    
                case 'TIPO':
                    const typeText = td.textContent.trim();
                    if (typeText && typeText !== 'N/A') {
                        type = typeText;
                    }
                    break;
            }
        }
        
        return {
            id: parseInt(workId),
            title: title,
            authors: authors,
            publication_year: publicationYear,
            venue_name: venueName,
            type: type
        };
        
    } catch (error) {
        console.error('Error extracting item data:', error);
        return null;
    }
}

function showAddToListSuccess(message) {
    showNotification(message, 'success');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
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

function updateAddToListButton(added) {
    const btn = document.getElementById("add-to-list-btn");
    if (btn && added) {
        btn.textContent = "Adicionado à Lista";
        btn.disabled = true;
        btn.setAttribute("aria-label", "Item já adicionado à lista pessoal");
    }
}

function checkIfItemInList() {
    if (!window.MyList || !window.MyList.getPersonalList) return;
    
    const pathParts = window.location.pathname.split('/');
    const workId = parseInt(pathParts[pathParts.length - 1]);
    
    if (!workId || isNaN(workId)) return;
    
    const list = window.MyList.getPersonalList();
    const isInList = list.some(item => item.id === workId);
    
    if (isInList) {
        updateAddToListButton(true);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    initializeItemActions();
});
