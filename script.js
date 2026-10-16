// ==========================================================================
// SANCTUARY | Il Mio Rifugio Musicale – Logica Interattiva
// Player YouTube, Ricerca Live, Workout Timer, Sleep Timer & Filtri Mood
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Inizializza icone Lucide
  if (window.lucide) {
    lucide.createIcons();
  }

  // Registrazione Service Worker PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service Worker registration skipped:', err);
      });
    });
  }

  // Database Brani
  let tracks = [];
  try {
    const res = await fetch('/tracks.json?v=1.0.0');
    tracks = await res.json();
  } catch (err) {
    console.error('Errore nel caricamento di tracks.json:', err);
  }

  // Stato Globale dell'App
  let currentTrackIndex = 0;
  let activeFilter = 'all';
  let workoutTimerInterval = null;
  let workoutSecondsLeft = 180; // 3 minuti di default
  let workoutIsRest = false;
  let workoutIsRunning = false;
  let sleepTimerTimeout = null;
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

  // Workout Rocky Controls
  const workoutToggleBtn = document.getElementById('workoutToggleBtn');
  const startRockyPlaylistBtn = document.getElementById('startRockyPlaylistBtn');
  const timerDigits = document.getElementById('timerDigits');
  const timerPhaseLabel = document.getElementById('timerPhaseLabel');
  const timerToggleBtn = document.getElementById('timerToggleBtn');
  const timerToggleText = document.getElementById('timerToggleText');
  const timerResetBtn = document.getElementById('timerResetBtn');
  const rockyPills = document.querySelectorAll('.rocky-pill-btn');

  // Cremonini Controls
  const cremoniniToggleBtn = document.getElementById('cremoniniToggleBtn');
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
    if (!tracks.length || index < 0 || index >= tracks.length) return;
    currentTrackIndex = index;
    const track = tracks[currentTrackIndex];

    let embedUrl = `https://www.youtube-nocookie.com/embed/${track.youtubeId}?autoplay=1&enablejsapi=1&rel=0`;

    // Se richiesto uno specifico timestamp di avvio (es. ritornello Mulan)
    if (options.startTime) {
      embedUrl += `&start=${options.startTime}`;
    }

    // Aggiorna iframe
    mainVideoFrame.src = embedUrl;

    // Aggiorna UI dello Stage Player
    stageSongTitle.textContent = track.title;
    stageSongArtist.textContent = track.artist;
    stageSongQuote.textContent = `«${track.lyricsQuote}»`;
    stageYearBadge.textContent = track.year;
    stageVibeBadge.textContent = track.vibe;
    stageCatBadge.textContent = track.categoryLabel;

    // Stile badge categoria
    stageCatBadge.className = 'badge-cat cat-' + track.category;
    nowPlayingStatus.textContent = `In riproduzione: ${track.title} – ${track.artist}`;
    openYtStageLink.href = `https://www.youtube.com/watch?v=${track.youtubeId}`;

    // Aggiorna Mini Player
    miniTrackTitle.textContent = track.title;
    miniTrackArtist.textContent = track.artist;
    miniThumbImg.src = `https://img.youtube.com/vi/${track.youtubeId}/default.jpg`;
    miniThumbImg.alt = `${track.title} – ${track.artist}`;

    // Evidenzia card attiva nella griglia
    trackCards.forEach((c) => c.classList.remove('active-playing'));
    const activeCard = document.getElementById(`card-${track.id}`);
    if (activeCard) {
      activeCard.classList.add('active-playing');
    }

    // Gestione Pulsanti Speciali (Mulan & Hercules)
    if (track.id === 'faro-di-te-un-uomo') {
      mulanChorusHeroBtn.classList.remove('hidden');
    } else {
      mulanChorusHeroBtn.classList.add('hidden');
    }

    if (track.hasLanguageToggle) {
      herculesLangHeroBtn.classList.remove('hidden');
      herculesLangHeroText.textContent =
        track.id === 'posso-farcela'
          ? 'Ascolta Versione Originale Inglese (Roger Bart)'
          : 'Ascolta Versione Storica Italiana (Alex Baroni)';
    } else {
      herculesLangHeroBtn.classList.add('hidden');
    }

    // Effetto glow tematico sullo Stage
    updateStageAmbiance(track.category);

    if (options.scrollToPlayer && window.innerWidth <= 768) {
      stageCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function playTrackById(trackId, options = {}) {
    const idx = tracks.findIndex((t) => t.id === trackId);
    if (idx !== -1) {
      playTrackByIndex(idx, options);
    }
  }

  function updateStageAmbiance(category) {
    let glowColor = 'rgba(56, 189, 248, 0.2)';
    let borderColor = 'rgba(56, 189, 248, 0.35)';

    if (category === 'rocky') {
      glowColor = 'rgba(239, 68, 68, 0.3)';
      borderColor = 'rgba(239, 68, 68, 0.5)';
    } else if (category === 'rock') {
      glowColor = 'rgba(168, 85, 247, 0.25)';
      borderColor = 'rgba(168, 85, 247, 0.4)';
    } else if (category === 'cremonini') {
      glowColor = 'rgba(249, 115, 22, 0.25)';
      borderColor = 'rgba(249, 115, 22, 0.45)';
    } else if (category === 'epica') {
      glowColor = 'rgba(251, 191, 36, 0.25)';
      borderColor = 'rgba(251, 191, 36, 0.45)';
    }

    stageCard.style.boxShadow = `0 4px 20px rgba(0, 0, 0, 0.4), 0 0 35px ${glowColor}`;
    stageCard.style.borderColor = borderColor;
  }

  // ==========================================================================
  // PULSANTI DI CONTROLLO & EVENTI PLAYBACK
  // ==========================================================================

  prevTrackBtn.addEventListener('click', () => {
    let nextIdx = currentTrackIndex - 1;
    if (nextIdx < 0) nextIdx = tracks.length - 1;
    playTrackByIndex(nextIdx, { scrollToPlayer: true });
  });

  nextTrackBtn.addEventListener('click', () => {
    let nextIdx = (currentTrackIndex + 1) % tracks.length;
    playTrackByIndex(nextIdx, { scrollToPlayer: true });
  });

  randomTrackBtn.addEventListener('click', () => {
    if (!tracks.length) return;
    let randIdx = Math.floor(Math.random() * tracks.length);
    if (randIdx === currentTrackIndex && tracks.length > 1) {
      randIdx = (randIdx + 1) % tracks.length;
    }
    playTrackByIndex(randIdx, { scrollToPlayer: true });
    showToast(`In riproduzione brano casuale: ${tracks[randIdx].title}`);
  });

  // Salta al ritornello di Mulan
  mulanChorusHeroBtn.addEventListener('click', () => {
    playTrackById('faro-di-te-un-uomo', { startTime: 88 });
    showToast('⚡ Saltato al ritornello cult: «Uomini, uniti e fieri...»');
  });

  // Switch lingua Hercules
  herculesLangHeroBtn.addEventListener('click', () => {
    const cur = tracks[currentTrackIndex];
    if (cur.id === 'posso-farcela') {
      playTrackById('go-the-distance-eng');
      showToast('Passato a Hercules (Versione Originale Inglese)');
    } else {
      playTrackById('posso-farcela');
      showToast('Passato a Hercules (Versione Italiana di Alex Baroni)');
    }
  });

  // Click su play all'interno delle card
  document.addEventListener('click', (e) => {
    // Play button su card
    const playBtn = e.target.closest('.btn-play-track, .play-overlay-btn');
    if (playBtn) {
      const trackId = playBtn.dataset.id;
      playTrackById(trackId, { scrollToPlayer: true });
      return;
    }

    // Ritornello button su card Mulan
    const chorusBtn = e.target.closest('.btn-chorus');
    if (chorusBtn) {
      const trackId = chorusBtn.dataset.id;
      const seek = parseInt(chorusBtn.dataset.seek || '88', 10);
      playTrackById(trackId, { startTime: seek, scrollToPlayer: true });
      showToast('⚡ Riproduzione dal ritornello cult!');
      return;
    }

    // Toggle lingua su card Hercules
    const langBtn = e.target.closest('.btn-lang-toggle');
    if (langBtn) {
      const trackId = langBtn.dataset.id;
      const nextId = trackId === 'posso-farcela' ? 'go-the-distance-eng' : 'posso-farcela';
      playTrackById(nextId, { scrollToPlayer: true });
      return;
    }

    // Copia citazione
    const copyBtn = e.target.closest('.btn-copy-lyric');
    if (copyBtn) {
      const quote = copyBtn.dataset.quote;
      const song = copyBtn.dataset.song;
      copyToClipboard(`«${quote}» – ${song}`);
      showToast('Citazione musicale copiata negli appunti!');
      return;
    }
  });

  copyStageQuoteBtn.addEventListener('click', () => {
    const cur = tracks[currentTrackIndex];
    if (cur) {
      copyToClipboard(`«${cur.lyricsQuote}» – ${cur.title} (${cur.artist})`);
      showToast('Verso copiato negli appunti!');
    }
  });

  // Mini Player Controls
  miniPrevBtn.addEventListener('click', () => prevTrackBtn.click());
  miniNextBtn.addEventListener('click', () => nextTrackBtn.click());
  miniJumpToStageBtn.addEventListener('click', () => {
    stageCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Sticky Player apparizione allo scroll
  window.addEventListener('scroll', () => {
    const stageBottom = stageCard.getBoundingClientRect().bottom;
    if (stageBottom < 0) {
      stickyMiniPlayer.classList.remove('hidden');
    } else {
      stickyMiniPlayer.classList.add('hidden');
    }
  });

  // ==========================================================================
  // FILTRI MOOD & RICERCA IN TEMPO REALE
  // ==========================================================================

  function applyFilters() {
    const query = trackSearchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    trackCards.forEach((card) => {
      const cat = card.dataset.category;
      const title = card.dataset.title;
      const artist = card.dataset.artist;
      const lyrics = card.dataset.lyrics;

      const matchesCat = activeFilter === 'all' || cat === activeFilter;
      const matchesQuery =
        !query ||
        title.includes(query) ||
        artist.includes(query) ||
        lyrics.includes(query);

      if (matchesCat && matchesQuery) {
        card.style.display = 'flex';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    searchCountFeedback.innerHTML = `Mostrando <strong>${visibleCount}</strong> brani su ${tracks.length}`;

    if (visibleCount === 0) {
      emptySearchState.classList.remove('hidden');
    } else {
      emptySearchState.classList.add('hidden');
    }
  }

  filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      filterTabs.forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      activeFilter = tab.dataset.category;
      applyFilters();
    });
  });

  trackSearchInput.addEventListener('input', () => {
    if (trackSearchInput.value.trim()) {
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
    }
    applyFilters();
  });

  clearSearchBtn.addEventListener('click', () => {
    trackSearchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    applyFilters();
    trackSearchInput.focus();
  });

  resetFiltersBtn.addEventListener('click', () => {
    trackSearchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    activeFilter = 'all';
    filterTabs.forEach((t) => {
      t.classList.toggle('active', t.dataset.category === 'all');
      t.setAttribute('aria-selected', t.dataset.category === 'all' ? 'true' : 'false');
    });
    applyFilters();
  });

  // ==========================================================================
  // SEZIONE WORKOUT ROCKY 🥊 & INTERVAL TIMER
  // ==========================================================================

  workoutToggleBtn.addEventListener('click', () => {
    const rockySection = document.getElementById('rocky-camp');
    rockySection.scrollIntoView({ behavior: 'smooth' });
    showToast('Entrato nel Rocky Balboa Training Camp 🥊');
  });

  startRockyPlaylistBtn.addEventListener('click', () => {
    playTrackById('eye-of-the-tiger', { scrollToPlayer: true });
    showToast('Avviata colonna sonora di Rocky!');
  });

  rockyPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const trackId = pill.dataset.id;
      playTrackById(trackId, { scrollToPlayer: true });
    });
  });

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function playBellSound(isHigh = false) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isHigh ? 880 : 440, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch (e) {
      // audio context opzionale
    }
  }

  timerToggleBtn.addEventListener('click', () => {
    if (workoutIsRunning) {
      // Pausa
      clearInterval(workoutTimerInterval);
      workoutIsRunning = false;
      timerToggleText.textContent = 'Riprendi Round';
      timerToggleBtn.querySelector('i').setAttribute('data-lucide', 'play');
    } else {
      // Avvia
      workoutIsRunning = true;
      timerToggleText.textContent = 'Pausa';
      timerToggleBtn.querySelector('i').setAttribute('data-lucide', 'pause');
      playBellSound(true);

      workoutTimerInterval = setInterval(() => {
        workoutSecondsLeft--;
        if (workoutSecondsLeft <= 0) {
          playBellSound(false);
          if (!workoutIsRest) {
            // Fine lavoro -> Inizio recupero (60s)
            workoutIsRest = true;
            workoutSecondsLeft = 60;
            timerPhaseLabel.textContent = 'RECUPERO // 1 MINUTO';
            timerDigits.style.color = 'var(--accent-cyan)';
            showToast('Fine Round! 1 minuto di recupero.');
          } else {
            // Fine recupero -> Nuovo Round (180s)
            workoutIsRest = false;
            workoutSecondsLeft = 180;
            timerPhaseLabel.textContent = 'ROUND SUCCESSIVO // LAVORO';
            timerDigits.style.color = '#fff';
            showToast('GONG! Inizia il nuovo round!');
          }
        }
        timerDigits.textContent = formatTime(workoutSecondsLeft);
      }, 1000);
    }
    if (window.lucide) lucide.createIcons();
  });

  timerResetBtn.addEventListener('click', () => {
    clearInterval(workoutTimerInterval);
    workoutIsRunning = false;
    workoutIsRest = false;
    workoutSecondsLeft = 180;
    timerDigits.textContent = '03:00';
    timerDigits.style.color = '#fff';
    timerPhaseLabel.textContent = 'ROUND 1 // LAVORO';
    timerToggleText.textContent = 'Avvia Round';
    if (window.lucide) lucide.createIcons();
  });

  // ==========================================================================
  // SEZIONE CESARE CREMONINI & MELODIA ITALIANA
  // ==========================================================================

  cremoniniToggleBtn.addEventListener('click', () => {
    const cremSection = document.getElementById('cremonini-sanctuary');
    cremSection.scrollIntoView({ behavior: 'smooth' });
    showToast('Benvenuto nel mondo poetico di Cesare Cremonini 🇮🇹');
  });

  cremPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const trackId = pill.dataset.id;
      playTrackById(trackId, { scrollToPlayer: true });
    });
  });

  // ==========================================================================
  // MODALE TIMER DI TRANQUILLITÀ / SLEEP TIMER
  // ==========================================================================

  openSleepTimerBtn.addEventListener('click', () => {
    sleepTimerModal.classList.remove('hidden');
  });

  closeSleepTimerBtn.addEventListener('click', () => {
    sleepTimerModal.classList.add('hidden');
  });

  sleepTimerModal.addEventListener('click', (e) => {
    if (e.target === sleepTimerModal) {
      sleepTimerModal.classList.add('hidden');
    }
  });

  sleepPresets.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mins = parseInt(btn.dataset.minutes, 10);
      setSleepTimer(mins);
      sleepTimerModal.classList.add('hidden');
      showToast(`Timer di spegnimento impostato su ${mins} minuti 🌙`);
    });
  });

  function setSleepTimer(minutes) {
    clearTimeout(sleepTimerTimeout);
    clearInterval(sleepTimerInterval);

    sleepSecondsLeft = minutes * 60;
    activeTimerBox.classList.remove('hidden');
    sleepTimerLabel.textContent = `${minutes}m rimanenti`;

    sleepTimerInterval = setInterval(() => {
      sleepSecondsLeft--;
      if (sleepSecondsLeft <= 0) {
        clearInterval(sleepTimerInterval);
        // Interrompi riproduzione player
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
  }

  cancelSleepTimerBtn.addEventListener('click', () => {
    clearInterval(sleepTimerInterval);
    sleepSecondsLeft = 0;
    activeTimerBox.classList.add('hidden');
    sleepTimerLabel.textContent = 'Timer Riposo';
    showToast('Timer di riposo annullato.');
  });

  // ==========================================================================
  // UTILITY: CLIPBOARD & TOAST
  // ==========================================================================

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  function showToast(message) {
    toastMsg.textContent = message;
    toastBox.classList.add('show');
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => {
      toastBox.classList.remove('show');
    }, 3200);
  }

  backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Scorciatoie da tastiera (Accessibilità avanzata)
  window.addEventListener('keydown', (e) => {
    // Non intercettare se l'utente sta digitando nella barra di ricerca
    if (document.activeElement === trackSearchInput) return;

    if (e.key === 'ArrowRight') {
      nextTrackBtn.click();
    } else if (e.key === 'ArrowLeft') {
      prevTrackBtn.click();
    } else if (e.key.toLowerCase() === 'r') {
      randomTrackBtn.click();
    }
  });

  // Riproduci la prima traccia (Young and Beautiful) come default senza forzare audio molesto
  // L'utente può cliccare per avviare
});
