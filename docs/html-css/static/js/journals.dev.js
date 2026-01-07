class JournalsLoader {
    constructor() {
        this.loadingStates = {
            impact: false,
            representation: false
        };
        const meta = document.querySelector('meta[name="ethnos-api-base"]');
        this.apiBase = (meta && meta.content ? meta.content.trim() : '/backend/api').replace(/\/$/, '');
    }

    async loadVenuesByImpact() {
        this.loadingStates.impact = true;
        
        const container = document.querySelector('.venues-impact-container');
        if (!container) {
            console.error('Venues impact container not found');
            return;
        }

        try {
            container.innerHTML = '<p class="field-value">Carregando periódicos por impacto...</p>';
            
            container.innerHTML = `
                <p class="field-value">
                    Dados de impacto não disponíveis no momento. 
                    <a href="/venues/complete" class="action-link">Ver listagem completa de periódicos</a>
                </p>
            `;
        } catch (error) {
            console.error('Error loading venues by impact:', error);
            container.innerHTML = '<p class="field-value error-text">Erro ao carregar dados de impacto</p>';
        } finally {
            this.loadingStates.impact = false;
        }
    }

    async loadVenuesByRepresentation() {
        this.loadingStates.representation = true;
        
        const container = document.querySelector('.venues-representation-container');
        if (!container) {
            console.error('Venues representation container not found');
            return;
        }

        try {
            container.innerHTML = '<p class="field-value">Carregando periódicos por representação...</p>';

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch('/venues/complete', {
                signal: controller.signal,
                headers: {
                    'Accept': 'text/html'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const topVenueIds = [1, 917, 58, 122, 1027, 47, 157, 75];
            const topVenues = [];
            
            for (const venueId of topVenueIds) {
                try {
                    const venueResponse = await fetch(`${this.apiBase}/venues/${venueId}`);
                    if (venueResponse.ok) {
                        const venueData = await venueResponse.json();
                        const v = venueData?.data || venueData?.venue || venueData;
                        if (v) {
                            topVenues.push({
                                id: venueId,
                                name: v.name,
                                type: v.type,
                                works_count: v.works_count
                            });
                        }
                    }
                } catch (e) {
                    console.warn(`Failed to fetch venue ${venueId}:`, e);
                }
            }
            
            let topVenuesTable = '';
            if (topVenues.length > 0) {
                topVenues.sort((a, b) => (b.works_count || 0) - (a.works_count || 0));
                const displayVenues = topVenues.slice(0, 5);
                
                topVenuesTable = `
                    <table class="data-table journals-representation-table">
                        <thead>
                            <tr>
                                <th scope="col">PERIÓDICO</th>
                                <th scope="col">TIPO</th>
                                <th scope="col">OBRAS</th>
                                <th scope="col">AÇÃO</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${displayVenues.map(venue => `
                                <tr>
                                    <td class="field-value">
                                        <strong>${venue.name || 'Nome não disponível'}</strong>
                                    </td>
                                    <td class="field-value">
                                        ${venue.type === 'JOURNAL' ? 'Periódico' : venue.type || 'N/A'}
                                    </td>
                                    <td class="field-value">
                                        <strong>${(venue.works_count || 0).toLocaleString()}</strong>
                                    </td>
                                    <td class="field-value">
                                        <a href="/venues/${venue.id}" class="action-link">Ver detalhes</a>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }

            let totalVenues = 0;
            try {
                const statsResponse = await fetch(`${this.apiBase}/venues?limit=1&page=1`);
                if (statsResponse.ok) {
                    const statsData = await statsResponse.json();
                    totalVenues = statsData?.pagination?.total || statsData?.pagination?.totalResults || 0;
                }
            } catch (e) {
                console.warn('Failed to load venues statistics via proxy:', e);
                totalVenues = 4856;
            }

            container.innerHTML = `
                <div class="venues-preview">
                    ${topVenuesTable || `
                        <table class="data-table journals-representation-table">
                            <thead>
                                <tr>
                                    <th scope="col">PERIÓDICO</th>
                                    <th scope="col">TIPO</th>
                                    <th scope="col">OBRAS</th>
                                    <th scope="col">AÇÃO</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td class="field-value">
                                        <strong>American Anthropologist</strong>
                                    </td>
                                    <td class="field-value">Periódico</td>
                                    <td class="field-value"><strong>31.070</strong></td>
                                    <td class="field-value">
                                        <a href="/venues/1" class="action-link">Ver detalhes</a>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="field-value">
                                        <strong>Contemporary Sociology</strong>
                                    </td>
                                    <td class="field-value">Periódico</td>
                                    <td class="field-value"><strong>25.882</strong></td>
                                    <td class="field-value">
                                        <a href="/venues/917" class="action-link">Ver detalhes</a>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="field-value">
                                        <strong>American Journal of Sociology</strong>
                                    </td>
                                    <td class="field-value">Periódico</td>
                                    <td class="field-value"><strong>25.074</strong></td>
                                    <td class="field-value">
                                        <a href="/venues/58" class="action-link">Ver detalhes</a>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="field-value">
                                        <strong>Social Forces</strong>
                                    </td>
                                    <td class="field-value">Periódico</td>
                                    <td class="field-value"><strong>20.770</strong></td>
                                    <td class="field-value">
                                        <a href="/venues/122" class="action-link">Ver detalhes</a>
                                    </td>
                                </tr>
                                <tr>
                                    <td class="field-value">
                                        <strong>Annales. Histoire, Sciences Sociales</strong>
                                    </td>
                                    <td class="field-value">Periódico</td>
                                    <td class="field-value"><strong>16.465</strong></td>
                                    <td class="field-value">
                                        <a href="/venues/1027" class="action-link">Ver detalhes</a>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    `}
                    <div class="action-links">
                        <p class="field-value">
                            <strong>${totalVenues.toLocaleString()} periódicos disponíveis</strong> - 
                            <a href="/venues/complete" class="action-link">Ver todos os periódicos organizados</a> | 
                            <a href="/search/advanced" class="action-link">Busca avançada</a>
                        </p>
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('Error loading venues by representation:', error);
            
            if (error.name === 'AbortError' || error.message.includes('timeout')) {
                container.innerHTML = `
                    <p class="field-value error-text">
                        Timeout ao carregar periódicos. A base de dados é muito grande.
                        <br><a href="/venues/complete" class="action-link">Ver listagem completa de periódicos</a>
                        <br><a href="/search/advanced" class="action-link">Ou use a busca avançada para filtros específicos</a>
                    </p>
                `;
            } else {
                container.innerHTML = `
                    <p class="field-value error-text">
                        Erro ao carregar periódicos. 
                        <br><a href="/venues/complete" class="action-link">Ver listagem completa</a>
                    </p>
                `;
            }
        } finally {
            this.loadingStates.representation = false;
        }
    }

    async init() {
        
        try {
            await Promise.all([
                this.loadVenuesByImpact(),
                this.loadVenuesByRepresentation()
            ]);
        } catch (error) {
            console.error('Error initializing journals loader:', error);
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const loader = new JournalsLoader();
    loader.init();
});
