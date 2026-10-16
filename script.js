/**
 * SANCTUARY | Il Mio Rifugio Musicale – Logic & Playback Controller
 * In-browser YouTube Embed controller, filters, search, mini-player, sleep timer.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Lucide Icons Init
  if (window.lucide) {
    lucide.createIcons();
  }

  // Registrazione Service Worker per PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js?v=2.1').catch(() => {
        // SW opzionale in ambienti locali
      });
    });
  }

  // Caricamento Dati Tracce
  let tracks = [];
  try {
    const res = await fetch('tracks.json');
    tracks = await res.json();
  } catch (err) {
    console.error('Errore nel caricamento di tracks.json:', err);
    return;
  }

  // Stato Globale
  let currentTrackIndex = 0;
  let activeFilter = 'all';
  let sleepTimerInterval = null;
  let sleepSecondsLeft = 0;

  // Riferimenti DOM Principali
  const mainVideoFrame = document.getElementById('mainVideoFrame');
  const stageSongTitle = document.getElementById('stageSongTitle');
  const stageSongArtist = document.getElementById('stageSongArtist');
  const stageSongQuote = document.getElementById('stageSongQuote');
  const stageCatBadge = document.getElementById('stageCatBadge');
  const stageYearBadge = document.getElementById('stageYearBadge');
  const stageVibeBadge = document.getElementById('stageVibeBadge');
  const nowPlayingStatus = document.getElementById('nowPlayingStatus');
  const stageCard = document.getElementById('stageCard');
  const openYtStageLink = document.getElementById('openYtStageLink');

  // Pulsanti speciali Hero
  const mulanChorusHeroBtn = document.getElementById('mulanChorusHeroBtn');
  const herculesLangHeroBtn = document.getElementById('herculesLangHeroBtn');
  const herculesLangHeroText = document.getElementById('herculesLangHeroText');
  const dragonBallHeroBtn = document.getElementById('dragonBallHeroBtn');
  const dragonBallHeroText = document.getElementById('dragonBallHeroText');

  // Controlli Master Playback
  const prevTrackBtn = document.getElementById('prevTrackBtn');
  const nextTrackBtn = document.getElementById('nextTrackBtn');
  const randomTrackBtn = document.getElementById('randomTrackBtn');
  const copyStageQuoteBtn = document.getElementById('copyStageQuoteBtn');

  // Filtri & Ricerca
  const filterTabs = document.querySelectorAll('.filter-tab');
  const trackSearchInput = document.getElementById('trackSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const searchCountFeedback = document.getElementById('searchCountFeedback');
  const emptySearchState = document.getElementById('emptySearchState');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const trackCards = document.querySelectorAll('.track-card');

  // Sticky Mini Player
  const stickyMiniPlayer = document.getElementById('stickyMiniPlayer');
  const miniThumbImg = document.getElementById('miniThumbImg');
  const miniTrackTitle = document.getElementById('miniTrackTitle');
  const miniTrackArtist = document.getElementById('miniTrackArtist');
  const miniPrevBtn = document.getElementById('miniPrevBtn');
  const miniNextBtn = document.getElementById('miniNextBtn');
  const miniJumpToStageBtn = document.getElementById('miniJumpToStageBtn');

  // Sezioni & Pulsanti Header
  const workoutToggleBtn = document.getElementById('workoutToggleBtn');
  const cremoniniToggleBtn = document.getElementById('cremoniniToggleBtn');
  const startRockyPlaylistBtn = document.getElementById('startRockyPlaylistBtn');
  const rockyMiniCards = document.querySelectorAll('.rocky-mini-card');
  const rockyPlayBtns = document.querySelectorAll('.rmc-play-btn');
  const rockyPills = document.querySelectorAll('.rocky-pill-btn');
  const cremPills = document.querySelectorAll('.crem-pill-btn');

  // Sleep Timer Modal
  const openSleepTimerBtn = document.getElementById('openSleepTimerBtn');
  const sleepTimerModal = document.getElementById('sleepTimerModal');
  const closeSleepTimerBtn = document.getElementById('closeSleepTimerBtn');
  const sleepPresets = document.querySelectorAll('.btn-timer-preset');
  const activeTimerBox = document.getElementById('activeTimerBox');
  const remainingTimeText = document.getElementById('remainingTimeText');
  const cancelSleepTimerBtn = document.getElementById('cancelSleepTimerBtn');
  const sleepTimerLabel = document.getElementById('sleepTimerLabel');

  // Toast & Back to Top
  const toastBox = document.getElementById('toastBox');
  const toastMsg = document.getElementById('toastMsg');
  const backToTopBtn = document.getElementById('backToTopBtn');

  // ==========================================================================
  // FUNZIONI AUDIO PLAYER & RIPRODUZIONE
  // ==========================================================================

  function playTrackByIndex(index, options = {}) {
    if (index < 0) index = tracks.length - 1;
    if (index >= tracks.length) index = 0;

    currentTrackIndex = index;
    const track = tracks[currentTrackIndex];

    // URL YouTube con autoplay (se richiesto)
    let embedUrl = `https://www.youtube-nocookie.com/embed/${track.youtubeId}?enablejsapi=1&rel=0`;
    if (options.autoplay) {
      embedUrl += '&autoplay=1';
    }
    if (options.startSeconds) {
      embedUrl += `&start=${options.startSeconds}`;
    }

    mainVideoFrame.src = embedUrl;

    // Aggiornamento Dati Palcoscenico
    stageSongTitle.textContent = track.title;
    stageSongArtist.textContent = track.artist;
    stageSongQuote.textContent = `«${track.lyricsQuote}»`;
    stageCatBadge.textContent = track.categoryLabel;
    stageYearBadge.textContent = track.year;
    stageVibeBadge.textContent = track.vibe;
    nowPlayingStatus.textContent = `In riproduzione: ${track.title} – ${track.artist} (${track.year})`;

    if (openYtStageLink) {
      openYtStageLink.href = `https://www.youtube.com/watch?v=${track.youtubeId}`;
    }

    // Mini Player
    if (miniThumbImg) miniThumbImg.src = `https://img.youtube.com/vi/${track.youtubeId}/default.jpg`;
    if (miniTrackTitle) miniTrackTitle.textContent = track.title;
    if (miniTrackArtist) miniTrackArtist.textContent = track.artist;

    // Evidenziazione card attiva
    trackCards.forEach((card) => {
      if (card.dataset.id === track.id) {
        card.classList.add('active-playing');
      } else {
        card.classList.remove('active-playing');
      }
    });

    // Gestione Pulsanti Speciali (Mulan, Hercules, Dragon Ball GT)
    updateSpecialFeatureButtons(track);

    // Scroll verso il palcoscenico se richiesto
    if (options.scrollToPlayer) {
      stageCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (options.notifyToast) {
      showToast(`In riproduzione: ${track.title}`);
    }

    if (window.lucide) lucide.createIcons();
  }

  function playTrackById(trackId, options = {}) {
    const idx = tracks.findIndex(t => t.id === trackId);
    if (idx !== -1) {
      playTrackByIndex(idx, { autoplay: true, ...options });
    }
  }

  function updateSpecialFeatureButtons(track) {
    // Mulan Jump Chorus
    if (mulanChorusHeroBtn) {
      if (track.id === 'faro-di-te-un-uomo') {
        mulanChorusHeroBtn.classList.remove('hidden');
      } else {
        mulanChorusHeroBtn.classList.add('hidden');
      }
    }

    // Hercules Toggle ITA / ENG
    if (herculesLangHeroBtn && herculesLangHeroText) {
      if (track.id === 'posso-farcela') {
        herculesLangHeroBtn.classList.remove('hidden');
        herculesLangHeroText.textContent = 'Ascolta la versione originale in Inglese (Roger Bart)';
      } else if (track.id === 'go-the-distance-eng') {
        herculesLangHeroBtn.classList.remove('hidden');
        herculesLangHeroText.textContent = 'Ascolta la versione Italiana Disney (Alex Baroni)';
      } else {
        herculesLangHeroBtn.classList.add('hidden');
      }
    }

    // Dragon Ball GT Toggle ITA / JAP
    if (dragonBallHeroBtn && dragonBallHeroText) {
      if (track.id === 'dragon-ball-gt-ita') {
        dragonBallHeroBtn.classList.remove('hidden');
        dragonBallHeroText.textContent = 'Ascolta la Sigla Giapponese Originale (DAN DAN)';
      } else if (track.id === 'dragon-ball-gt-dan-dan') {
        dragonBallHeroBtn.classList.remove('hidden');
        dragonBallHeroText.textContent = 'Ascolta la Sigla Italiana Ufficiale (Giorgio Vanni)';
      } else {
        dragonBallHeroBtn.classList.add('hidden');
      }
    }
  }

  // ==========================================================================
  // EVENT LISTENERS CONTROLLI PRINCIPALI
  // ==========================================================================

  if (prevTrackBtn) {
    prevTrackBtn.addEventListener('click', () => {
      playTrackByIndex(currentTrackIndex - 1, { autoplay: true, notifyToast: true });
    });
  }

  if (nextTrackBtn) {
    nextTrackBtn.addEventListener('click', () => {
      playTrackByIndex(currentTrackIndex + 1, { autoplay: true, notifyToast: true });
    });
  }

  if (randomTrackBtn) {
    randomTrackBtn.addEventListener('click', () => {
      let randIdx = Math.floor(Math.random() * tracks.length);
      if (randIdx === currentTrackIndex) {
        randIdx = (randIdx + 1) % tracks.length;
      }
      playTrackByIndex(randIdx, { autoplay: true, scrollToPlayer: true, notifyToast: true });
    });
  }

  if (copyStageQuoteBtn) {
    copyStageQuoteBtn.addEventListener('click', () => {
      const curTrack = tracks[currentTrackIndex];
      const textToCopy = `«${curTrack.lyricsQuote}» — ${curTrack.title} (${curTrack.artist})`;
      navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('Verso musicale copiato negli appunti! ✨');
      }).catch(() => {
        showToast('Copia completata');
      });
    });
  }

  // Azioni speciali Hero
  if (mulanChorusHeroBtn) {
    mulanChorusHeroBtn.addEventListener('click', () => {
      playTrackByIndex(currentTrackIndex, { autoplay: true, startSeconds: 100 });
      showToast('⚡ Saltato al ritornello: «Uomini, uniti e fieri...»!');
    });
  }

  if (herculesLangHeroBtn) {
    herculesLangHeroBtn.addEventListener('click', () => {
      const cur = tracks[currentTrackIndex];
      if (cur.id === 'posso-farcela') {
        playTrackById('go-the-distance-eng', { scrollToPlayer: true });
      } else {
        playTrackById('posso-farcela', { scrollToPlayer: true });
      }
    });
  }

  if (dragonBallHeroBtn) {
    dragonBallHeroBtn.addEventListener('click', () => {
      const cur = tracks[currentTrackIndex];
      if (cur.id === 'dragon-ball-gt-ita') {
        playTrackById('dragon-ball-gt-dan-dan', { scrollToPlayer: true });
      } else {
        playTrackById('dragon-ball-gt-ita', { scrollToPlayer: true });
      }
    });
  }

  // ==========================================================================
  // FILTRI & RICERCA IN TEMPO REALE
  // ==========================================================================

  function applyFiltersAndSearch() {
    const query = trackSearchInput ? trackSearchInput.value.trim().toLowerCase() : '';
    let visibleCount = 0;

    trackCards.forEach((card) => {
      const category = card.dataset.category;
      const title = card.dataset.title || '';
      const artist = card.dataset.artist || '';
      const lyrics = card.dataset.lyrics || '';

      const matchesFilter = (activeFilter === 'all' || category === activeFilter);
      const matchesSearch = query === '' || 
        title.includes(query) || 
        artist.includes(query) || 
        lyrics.includes(query) ||
        category.includes(query);

      if (matchesFilter && matchesSearch) {
        card.classList.remove('hidden');
        visibleCount++;
      } else {
        card.classList.add('hidden');
      }
    });

    if (searchCountFeedback) {
      searchCountFeedback.textContent = `Mostrati ${visibleCount} di ${tracks.length} brani`;
    }

    if (emptySearchState) {
      if (visibleCount === 0) {
        emptySearchState.classList.remove('hidden');
      } else {
        emptySearchState.classList.add('hidden');
      }
    }

    if (clearSearchBtn) {
      if (query.length > 0) {
        clearSearchBtn.classList.remove('hidden');
      } else {
        clearSearchBtn.classList.add('hidden');
      }
    }
  }

  filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.dataset.filter;
      applyFiltersAndSearch();
    });
  });

  if (trackSearchInput) {
    trackSearchInput.addEventListener('input', applyFiltersAndSearch);
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      trackSearchInput.value = '';
      applyFiltersAndSearch();
      trackSearchInput.focus();
    });
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      if (trackSearchInput) trackSearchInput.value = '';
      activeFilter = 'all';
      filterTabs.forEach(t => {
        if (t.dataset.filter === 'all') t.classList.add('active');
        else t.classList.remove('active');
      });
      applyFiltersAndSearch();
    });
  }

  // Click su ogni card del catalogo
  document.querySelectorAll('.btn-play-track, .play-overlay-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const trackId = btn.dataset.id;
      if (trackId) {
        playTrackById(trackId, { scrollToPlayer: true });
      }
    });
  });

  document.querySelectorAll('.btn-copy-card-quote').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const quote = btn.dataset.quote;
      if (quote) {
        navigator.clipboard.writeText(`«${quote}»`).then(() => {
          showToast('Verso copiato negli appunti! 📋');
        });
      }
    });
  });

  trackCards.forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('a')) return;
      const trackId = card.dataset.id;
      if (trackId) {
        playTrackById(trackId, { scrollToPlayer: true });
      }
    });
  });

  // ==========================================================================
  // SEZIONE WORKOUT ROCKY 🥊 (JUKEBOX DIRETTO)
  // ==========================================================================

  if (workoutToggleBtn) {
    workoutToggleBtn.addEventListener('click', () => {
      const rockySection = document.getElementById('rocky-camp');
      if (rockySection) rockySection.scrollIntoView({ behavior: 'smooth' });
      showToast('Entrato nel Rocky Balboa Workout Camp 🥊');
    });
  }

  if (startRockyPlaylistBtn) {
    startRockyPlaylistBtn.addEventListener('click', () => {
      playTrackById('eye-of-the-tiger', { scrollToPlayer: true });
      showToast('Avviata sessione Rocky: Eye of the Tiger! 🥊');
    });
  }

  rockyPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const trackId = pill.dataset.id;
      if (trackId) playTrackById(trackId, { scrollToPlayer: true });
    });
  });

  rockyPlayBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const trackId = btn.dataset.id;
      if (trackId) playTrackById(trackId, { scrollToPlayer: true });
    });
  });

  rockyMiniCards.forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.rmc-play-btn')) return;
      const trackId = card.dataset.id;
      if (trackId) playTrackById(trackId, { scrollToPlayer: true });
    });
  });

  // ==========================================================================
  // SEZIONE CESARE CREMONINI 🇮🇹
  // ==========================================================================

  if (cremoniniToggleBtn) {
    cremoniniToggleBtn.addEventListener('click', () => {
      const cremSection = document.getElementById('cremonini-sanctuary');
      if (cremSection) cremSection.scrollIntoView({ behavior: 'smooth' });
      showToast('Benvenuto nel mondo poetico di Cesare Cremonini 🇮🇹');
    });
  }

  cremPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const trackId = pill.dataset.id;
      if (trackId) playTrackById(trackId, { scrollToPlayer: true });
    });
  });

  // ==========================================================================
  // STICKY MINI PLAYER (Persistente allo scroll)
  // ==========================================================================

  window.addEventListener('scroll', () => {
    const stageRect = stageCard.getBoundingClientRect();
    if (stageRect.bottom < 50) {
      stickyMiniPlayer.classList.remove('hidden');
    } else {
      stickyMiniPlayer.classList.add('hidden');
    }
  }, { passive: true });

  if (miniPrevBtn) {
    miniPrevBtn.addEventListener('click', () => {
      playTrackByIndex(currentTrackIndex - 1, { autoplay: true, notifyToast: true });
    });
  }

  if (miniNextBtn) {
    miniNextBtn.addEventListener('click', () => {
      playTrackByIndex(currentTrackIndex + 1, { autoplay: true, notifyToast: true });
    });
  }

  if (miniJumpToStageBtn) {
    miniJumpToStageBtn.addEventListener('click', () => {
      stageCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // ==========================================================================
  // MODALE TIMER DI TRANQUILLITÀ / SPEGNIMENTO AUTOMATICO
  // ==========================================================================

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  if (openSleepTimerBtn) {
    openSleepTimerBtn.addEventListener('click', () => {
      sleepTimerModal.classList.remove('hidden');
    });
  }

  if (closeSleepTimerBtn) {
    closeSleepTimerBtn.addEventListener('click', () => {
      sleepTimerModal.classList.add('hidden');
    });
  }

  if (sleepTimerModal) {
    sleepTimerModal.addEventListener('click', (e) => {
      if (e.target === sleepTimerModal) {
        sleepTimerModal.classList.add('hidden');
      }
    });
  }

  sleepPresets.forEach((btn) => {
    btn.addEventListener('click', () => {
      const minutes = parseInt(btn.dataset.minutes, 10);
      clearInterval(sleepTimerInterval);

      sleepSecondsLeft = minutes * 60;
      activeTimerBox.classList.remove('hidden');
      remainingTimeText.textContent = formatTime(sleepSecondsLeft);
      sleepTimerLabel.textContent = `${minutes}m`;
      showToast(`Timer di riposo impostato: ${minutes} minuti`);
      sleepTimerModal.classList.add('hidden');

      sleepTimerInterval = setInterval(() => {
        sleepSecondsLeft--;
        if (sleepSecondsLeft <= 0) {
          clearInterval(sleepTimerInterval);
          mainVideoFrame.src = '';
          activeTimerBox.classList.add('hidden');
          sleepTimerLabel.textContent = 'Timer Riposo';
          nowPlayingStatus.textContent = 'Riproduzione terminata dal timer di riposo 🌙';
          showToast('Timer di riposo scaduto: buona notte!');
        } else {
          remainingTimeText.textContent = formatTime(sleepSecondsLeft);
          sleepTimerLabel.textContent = `${Math.ceil(sleepSecondsLeft / 60)}m`;
        }
      }, 1000);
    });
  });

  if (cancelSleepTimerBtn) {
    cancelSleepTimerBtn.addEventListener('click', () => {
      clearInterval(sleepTimerInterval);
      activeTimerBox.classList.add('hidden');
      sleepTimerLabel.textContent = 'Timer Riposo';
      showToast('Timer di riposo annullato.');
    });
  }

  // ==========================================================================
  // TOAST FEEDBACK & BACK TO TOP
  // ==========================================================================

  let toastTimeout = null;
  function showToast(message) {
    if (!toastBox || !toastMsg) return;
    toastMsg.textContent = message;
    toastBox.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastBox.classList.remove('show');
    }, 2800);
  }

  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Keyboard Shortcuts (Space per play/pause iframe non è diretto, frecce per tracce)
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight') {
      playTrackByIndex(currentTrackIndex + 1, { autoplay: true, notifyToast: true });
    } else if (e.key === 'ArrowLeft') {
      playTrackByIndex(currentTrackIndex - 1, { autoplay: true, notifyToast: true });
    }
  });


  // ==========================================================================
  // CATEGORIA NAVIGATION (DESKTOP + MOBILE DRAWER + FOOTER)
  // ==========================================================================

  function switchCategory(cat) {
    activeFilter = cat;

    // Aggiorna tab del catalogo
    filterTabs.forEach((tab) => {
      if (tab.dataset.filter === cat) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Aggiorna pulsanti header desktop
    document.querySelectorAll('.nav-cat-btn').forEach((btn) => {
      if (btn.dataset.category === cat) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Aggiorna pulsanti mobile drawer
    document.querySelectorAll('.drawer-cat-btn').forEach((btn) => {
      if (btn.dataset.category === cat) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Applica filtro al grid
    applyFiltersAndSearch();

    // Scroll verso la sezione rilevante
    if (cat === 'rocky') {
      const el = document.getElementById('rocky-camp');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (cat === 'cremonini') {
      const el = document.getElementById('cremonini-sanctuary');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else {
      const el = document.getElementById('esplora');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Header desktop category buttons
  document.querySelectorAll('.nav-cat-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchCategory(btn.dataset.category);
    });
  });

  // Footer category buttons
  document.querySelectorAll('.footer-nav-btn[data-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchCategory(btn.dataset.category);
    });
  });

  // Mobile Drawer category buttons
  document.querySelectorAll('.drawer-cat-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchCategory(btn.dataset.category);
      closeMobileDrawer();
    });
  });

  // ==========================================================================
  // MOBILE DRAWER OPEN / CLOSE
  // ==========================================================================

  const mobileDrawerBackdrop = document.getElementById('mobileDrawerBackdrop');
  const openMobileMenuBtn = document.getElementById('openMobileMenuBtn');
  const closeMobileMenuBtn = document.getElementById('closeMobileMenuBtn');
  const openSleepTimerDrawerBtn = document.getElementById('openSleepTimerDrawerBtn');
  const openLegalDrawerBtn = document.getElementById('openLegalDrawerBtn');
  const openPrivacyDrawerBtn = document.getElementById('openPrivacyDrawerBtn');

  function openMobileDrawer() {
    if (!mobileDrawerBackdrop) return;
    mobileDrawerBackdrop.classList.add('active');
    mobileDrawerBackdrop.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (window.lucide) lucide.createIcons();
  }

  function closeMobileDrawer() {
    if (!mobileDrawerBackdrop) return;
    mobileDrawerBackdrop.classList.remove('active');
    mobileDrawerBackdrop.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (openMobileMenuBtn) {
    openMobileMenuBtn.addEventListener('click', openMobileDrawer);
  }

  if (closeMobileMenuBtn) {
    closeMobileMenuBtn.addEventListener('click', closeMobileDrawer);
  }

  if (mobileDrawerBackdrop) {
    mobileDrawerBackdrop.addEventListener('click', (e) => {
      if (e.target === mobileDrawerBackdrop) {
        closeMobileDrawer();
      }
    });
  }

  // Chiudi drawer al click sui normali link nav
  document.querySelectorAll('.drawer-nav-item[href]').forEach((link) => {
    link.addEventListener('click', closeMobileDrawer);
  });

  if (openSleepTimerDrawerBtn) {
    openSleepTimerDrawerBtn.addEventListener('click', () => {
      closeMobileDrawer();
      if (sleepTimerModal) {
        sleepTimerModal.classList.add('active');
        sleepTimerModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      }
    });
  }

  // ==========================================================================
  // COOKIE CONSENT BANNER LOGIC
  // ==========================================================================

  const cookieBanner = document.getElementById('cookieBanner');
  const acceptCookieBtn = document.getElementById('acceptCookieBtn');
  const openLegalFromCookieBtn = document.getElementById('openLegalFromCookieBtn');

  const COOKIE_CONSENT_KEY = 'sanctuary_cookie_consent';

  function initCookieBanner() {
    if (!cookieBanner) return;
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      setTimeout(() => {
        cookieBanner.style.display = 'block';
        if (window.lucide) lucide.createIcons();
      }, 700);
    }
  }

  if (acceptCookieBtn) {
    acceptCookieBtn.addEventListener('click', () => {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
      if (cookieBanner) {
        cookieBanner.style.animation = 'none';
        cookieBanner.style.opacity = '0';
        cookieBanner.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
          cookieBanner.style.display = 'none';
        }, 300);
      }
      showToast('Preferenze privacy memorizzate.');
    });
  }

  initCookieBanner();

  // ==========================================================================
  // LEGAL & PRIVACY MODAL
  // ==========================================================================

  const legalModal = document.getElementById('legalModal');
  const openLegalModalBtn = document.getElementById('openLegalModalBtn');
  const closeLegalModalBtn = document.getElementById('closeLegalModalBtn');
  const confirmLegalModalBtn = document.getElementById('confirmLegalModalBtn');
  const footerOpenLegalBtn = document.getElementById('footerOpenLegalBtn');
  const footerOpenPrivacyBtn = document.getElementById('footerOpenPrivacyBtn');
  const footerOpenNoticeBtn = document.getElementById('footerOpenNoticeBtn');

  function openLegalModal() {
    if (!legalModal) return;
    legalModal.classList.add('active');
    legalModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (window.lucide) lucide.createIcons();
  }

  function closeLegalModal() {
    if (!legalModal) return;
    legalModal.classList.remove('active');
    legalModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (openLegalModalBtn) openLegalModalBtn.addEventListener('click', openLegalModal);
  if (closeLegalModalBtn) closeLegalModalBtn.addEventListener('click', closeLegalModal);
  if (confirmLegalModalBtn) confirmLegalModalBtn.addEventListener('click', closeLegalModal);

  if (openLegalFromCookieBtn) {
    openLegalFromCookieBtn.addEventListener('click', openLegalModal);
  }

  if (openLegalDrawerBtn) {
    openLegalDrawerBtn.addEventListener('click', () => {
      closeMobileDrawer();
      openLegalModal();
    });
  }

  if (openPrivacyDrawerBtn) {
    openPrivacyDrawerBtn.addEventListener('click', () => {
      closeMobileDrawer();
      openLegalModal();
    });
  }

  if (footerOpenLegalBtn) footerOpenLegalBtn.addEventListener('click', openLegalModal);
  if (footerOpenPrivacyBtn) footerOpenPrivacyBtn.addEventListener('click', openLegalModal);
  if (footerOpenNoticeBtn) footerOpenNoticeBtn.addEventListener('click', openLegalModal);

  if (legalModal) {
    legalModal.addEventListener('click', (e) => {
      if (e.target === legalModal) {
        closeLegalModal();
      }
    });
  }

  // Chiusura con tasto Escape per tutti i modali
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMobileDrawer();
      closeLegalModal();
      if (sleepTimerModal && sleepTimerModal.classList.contains('active')) {
        sleepTimerModal.classList.remove('active');
        sleepTimerModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
      }
    }
  });

  // Aggiorna icone finali
  if (window.lucide) lucide.createIcons();
});
