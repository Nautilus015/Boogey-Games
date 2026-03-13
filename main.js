/* ============================
   BOOGEY GAMES - main.js
   Dynamic Playgama Catalog
   ============================ */

const GAMES_PER_PAGE = 24;
const GENRE_LIMIT = 15; // Number of genre filters to show

let allGames = [];
let filteredGames = [];
let currentPage = 1;
let currentGenre = 'all';
let searchQuery = '';

/* ============================
   HELPERS
   ============================ */
function truncate(str, max) {
    if (!str) return '';
    return str.length > max ? str.slice(0, max).trim() + '…' : str;
}

function getMobileLabel(mobileReady) {
    if (!mobileReady || mobileReady.length === 0) return null;
    if (mobileReady.includes('For Android') && mobileReady.includes('For IOS')) return '📱 iOS & Android';
    if (mobileReady.includes('For Android')) return '📱 Android';
    if (mobileReady.includes('For IOS')) return '📱 iOS';
    return null;
}

/* ============================
   LOAD GAMES JSON
   ============================ */
async function loadGames() {
    try {
        const res = await fetch('games.json');
        const data = await res.json();
        // Support both direct array and {segments: [...{hits:[...]}]} structure
        if (Array.isArray(data)) {
            allGames = data;
        } else if (data.segments) {
            allGames = data.segments.flatMap(s => s.hits || []);
        } else if (data.hits) {
            allGames = data.hits;
        } else {
            allGames = [];
        }

        document.getElementById('game-count-display').textContent = `${allGames.length.toLocaleString()} games available`;
        document.getElementById('stat-games').textContent = allGames.length.toLocaleString();

        buildGenreFilters();
        filterAndRender();
        document.getElementById('loading-state').classList.add('hidden');
    } catch (err) {
        console.error('Failed to load games.json', err);
        document.getElementById('loading-state').innerHTML = '<p style="color:#ff3d00">Failed to load game catalog.</p>';
    }
}

/* ============================
   GENRE FILTERS
   ============================ */
function buildGenreFilters() {
    const genreCounts = {};
    allGames.forEach(game => {
        (game.genres || []).forEach(g => {
            genreCounts[g] = (genreCounts[g] || 0) + 1;
        });
    });

    // Sort genres by popularity
    const topGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, GENRE_LIMIT)
        .map(([g]) => g);

    const container = document.getElementById('genre-filters');
    topGenres.forEach(genre => {
        const btn = document.createElement('button');
        btn.className = 'genre-tag';
        btn.dataset.genre = genre;
        btn.textContent = genre.replace(/-/g, ' ');
        btn.addEventListener('click', () => selectGenre(genre, btn));
        container.appendChild(btn);
    });
}

function selectGenre(genre, btn) {
    currentGenre = genre;
    currentPage = 1;
    document.querySelectorAll('.genre-tag').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterAndRender();
}

/* ============================
   FILTER & RENDER
   ============================ */
function filterAndRender() {
    const q = searchQuery.toLowerCase().trim();
    filteredGames = allGames.filter(game => {
        const matchGenre = currentGenre === 'all' || (game.genres || []).includes(currentGenre);
        const matchSearch = !q ||
            (game.title || '').toLowerCase().includes(q) ||
            (game.description || '').toLowerCase().includes(q) ||
            (game.genres || []).some(g => g.includes(q));
        return matchGenre && matchSearch;
    });

    const countEl = document.getElementById('game-count-display');
    if (q || currentGenre !== 'all') {
        countEl.textContent = `${filteredGames.length.toLocaleString()} game${filteredGames.length !== 1 ? 's' : ''} found`;
    } else {
        countEl.textContent = `${allGames.length.toLocaleString()} games available`;
    }

    renderGrid();
    renderPagination();

    // Scroll to games section if filter was triggered after initial load
    if (allGames.length > 0) {
        document.getElementById('games-grid').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/* ============================
   RENDER GRID
   ============================ */
function renderGrid() {
    const grid = document.getElementById('games-grid');
    grid.innerHTML = '';

    const start = (currentPage - 1) * GAMES_PER_PAGE;
    const pageGames = filteredGames.slice(start, start + GAMES_PER_PAGE);

    if (pageGames.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--muted);padding:4rem 0;font-size:1.1rem;">No games found. Try a different search.</div>';
        return;
    }

    pageGames.forEach(game => {
        const thumb = (game.images && game.images[0]) ? game.images[0] : 'assets/logo.png';
        const genres = (game.genres || []).slice(0, 2);
        const mobileLabel = getMobileLabel(game.mobileReady);
        // Cloudflare Stream animated GIF for video preview
        const videoId = (game.videos && game.videos[0] && game.videos[0].playgama_id) ? game.videos[0].playgama_id : null;
        const videoGifUrl = videoId ? `https://videodelivery.net/${videoId}/thumbnails/thumbnail.gif?time=1s&height=300` : null;

        const card = document.createElement('div');
        card.className = 'game-card';
        card.innerHTML = `
            <div class="game-thumb-wrap">
                <img class="game-thumb" src="${thumb}" alt="${game.title}" loading="lazy" onerror="this.src='assets/logo.png'">
                ${videoGifUrl ? `<img class="game-video-preview" src="" data-src="${videoGifUrl}" alt="${game.title} preview">` : ''}
                <div class="video-play-hint"><svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
                <div class="game-genres">
                    ${genres.map(g => `<span class="game-genre-badge">${g.replace(/-/g,' ')}</span>`).join('')}
                </div>
                ${mobileLabel ? `<span class="mobile-badge">${mobileLabel}</span>` : ''}
            </div>
            <div class="game-info">
                <h3 class="game-title">${game.title}</h3>
                <p class="game-desc">${truncate(game.description, 90)}</p>
                <button class="play-btn" data-slug="${game.slug}">
                    <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Play Now
                </button>
            </div>
        `;

        // Video hover preview
        if (videoGifUrl) {
            const videoPreviewEl = card.querySelector('.game-video-preview');
            const thumbEl = card.querySelector('.game-thumb');
            const hintEl = card.querySelector('.video-play-hint');
            let loaded = false;

            card.addEventListener('mouseenter', () => {
                if (!loaded) {
                    videoPreviewEl.src = videoPreviewEl.dataset.src; // lazy-load on first hover
                    loaded = true;
                }
                videoPreviewEl.classList.add('visible');
                thumbEl.classList.add('hidden');
                hintEl.classList.add('visible');
            });
            card.addEventListener('mouseleave', () => {
                videoPreviewEl.classList.remove('visible');
                thumbEl.classList.remove('hidden');
                hintEl.classList.remove('visible');
            });
        }

        card.querySelector('.play-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openModal(game);
        });
        card.addEventListener('click', () => openModal(game));
        grid.appendChild(card);
    });
}

/* ============================
   PAGINATION
   ============================ */
function renderPagination() {
    const container = document.getElementById('pagination');
    container.innerHTML = '';
    const totalPages = Math.ceil(filteredGames.length / GAMES_PER_PAGE);
    if (totalPages <= 1) return;

    const makeBtn = (label, page, cls = '') => {
        const btn = document.createElement('button');
        btn.className = `page-btn${cls ? ' ' + cls : ''}`;
        btn.textContent = label;
        if (cls !== 'ellipsis' && cls !== 'active') {
            btn.addEventListener('click', () => {
                currentPage = page;
                renderGrid();
                renderPagination();
                document.getElementById('games').scrollIntoView({ behavior: 'smooth' });
            });
        }
        return btn;
    };

    // Prev
    if (currentPage > 1) {
        container.appendChild(makeBtn('← Prev', currentPage - 1));
    }

    // Page numbers (smart truncated)
    const pages = getPageNumbers(currentPage, totalPages);
    pages.forEach(p => {
        if (p === '…') {
            container.appendChild(makeBtn('…', null, 'ellipsis'));
        } else {
            container.appendChild(makeBtn(p, p, p === currentPage ? 'active' : ''));
        }
    });

    // Next
    if (currentPage < totalPages) {
        container.appendChild(makeBtn('Next →', currentPage + 1));
    }
}

function getPageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [1];
    if (current > 3) pages.push('…');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push('…');
    pages.push(total);
    return pages;
}

/* ============================
   PLAY MODAL
   ============================ */
function openModal(game) {
    const modal = document.getElementById('play-modal');
    const iframeWrap = document.getElementById('iframe-wrap');
    document.getElementById('modal-game-title').textContent = game.title;

    // Use the embed string if it contains valid iframe, else build from gameURL
    let iframeSrc = game.gameURL || '';

    // Inject iframe with forced inline styles to ensure it fills the wrapper
    // The wrapper itself is what will trigger fullscreen mode
    iframeWrap.innerHTML = `
        <iframe
            src="${iframeSrc}"
            style="width: 100%; height: 100%; min-height: 100%; border: none; display: block;"
            allow="fullscreen; accelerometer; camera; clipboard-read; clipboard-write; screen-wake-lock; speaker-selection; web-share; geolocation; gyroscope; microphone; xr-spatial-tracking; autoplay; encrypted-media; picture-in-picture; payment; publickey-credentials-get; publickey-credentials-create; storage-access; attribution-reporting; browsing-topics"
            frameborder="0"
            allowfullscreen
        ></iframe>
    `;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
}

/* ============================
   FULLSCREEN
   ============================ */
function toggleFullscreen() {
    const expandIcon = document.getElementById('fs-expand-icon');
    const shrinkIcon = document.getElementById('fs-shrink-icon');

    if (!document.fullscreenElement) {
        // Target the modal container so CSS can hide the header and expand the iframe
        const wrap = document.querySelector('#play-modal .modal');
        if (!wrap) return;
        const req = wrap.requestFullscreen ||
                    wrap.webkitRequestFullscreen ||
                    wrap.mozRequestFullScreen ||
                    wrap.msRequestFullscreen;
        if (req) req.call(wrap);
    } else {
        const exit = document.exitFullscreen ||
                     document.webkitExitFullscreen ||
                     document.mozCancelFullScreen ||
                     document.msExitFullscreen;
        if (exit) exit.call(document);
    }
}

// Sync icon state when fullscreen changes (including browser Escape key)
document.addEventListener('fullscreenchange', () => {
    const expandIcon = document.getElementById('fs-expand-icon');
    const shrinkIcon = document.getElementById('fs-shrink-icon');
    if (!expandIcon || !shrinkIcon) return;
    if (document.fullscreenElement) {
        expandIcon.style.display = 'none';
        shrinkIcon.style.display = '';
    } else {
        expandIcon.style.display = '';
        shrinkIcon.style.display = 'none';
    }
});

function closeModal() {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    }
    const modal = document.getElementById('play-modal');
    modal.classList.remove('open');
    document.body.style.overflow = '';
    document.getElementById('iframe-wrap').innerHTML = '';
    const expandIcon = document.getElementById('fs-expand-icon');
    const shrinkIcon = document.getElementById('fs-shrink-icon');
    if (expandIcon) expandIcon.style.display = '';
    if (shrinkIcon) shrinkIcon.style.display = 'none';
}

/* ============================
   HEADER SCROLL
   ============================ */
function initScrollEffects() {
    const header = document.getElementById('header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 40) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
    });
}

/* ============================
   ACTIVE NAV LINK
   ============================ */
function initActiveNav() {
    const links = document.querySelectorAll('.nav-link[data-section]');
    // New order: games first, then home (intro), about, contact
    const sections = ['games', 'home', 'about', 'contact'];

    window.addEventListener('scroll', () => {
        let current = 'games';
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el && window.scrollY >= el.offsetTop - 150) current = id;
        });
        links.forEach(l => {
            l.classList.toggle('active', l.dataset.section === current);
        });
    });
}

/* ============================
   MOBILE MENU
   ============================ */
function initMobileMenu() {
    const toggle = document.getElementById('nav-toggle');
    const menu = document.getElementById('nav-menu');
    toggle.addEventListener('click', () => menu.classList.toggle('open'));
    menu.querySelectorAll('.nav-link').forEach(l => {
        l.addEventListener('click', () => menu.classList.remove('open'));
    });
}

/* ============================
   SEARCH
   ============================ */
function initSearch() {
    const input = document.getElementById('search-input');
    let debounce;
    input.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            searchQuery = input.value;
            currentPage = 1;
            filterAndRender();
        }, 320);
    });
}

/* ============================
   MODAL CLOSE EVENTS
   ============================ */
function initModal() {
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-fullscreen').addEventListener('click', toggleFullscreen);
    document.getElementById('play-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !document.fullscreenElement) closeModal();
    });
}

/* ============================
   BROWSE BUTTON SMOOTH SCROLL
   ============================ */
function initHeroBtn() {
    document.getElementById('browse-btn').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('games').scrollIntoView({ behavior: 'smooth' });
    });
}

/* ============================
   INIT
   ============================ */
document.addEventListener('DOMContentLoaded', () => {
    initScrollEffects();
    initActiveNav();
    initMobileMenu();
    initSearch();
    initModal();
    initHeroBtn();

    // Genre "All" button
    document.querySelector('.genre-tag[data-genre="all"]').addEventListener('click', (e) => {
        currentGenre = 'all';
        currentPage = 1;
        document.querySelectorAll('.genre-tag').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        filterAndRender();
    });

    loadGames();
});
