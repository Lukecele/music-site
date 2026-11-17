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
      navigator.serviceWorker.register('/sw.js?v=2.4').catch(() => {
        // SW opzionale in ambienti locali
      });
    });
  }

  // Parse tracce direttamente dal DOM per reattività immediata e immunità da errori di rete
  function parseTracksFromDOM() {
    const cards = document.querySelectorAll('.track-card');
    const list = [];
    cards.forEach((card) => {
      const id = card.dataset.id;
      if (!id) return;
      const title = card.querySelector('.track-title')?.textContent.trim() || card.dataset.title || '';
      const artist = card.querySelector('.track-artist')?.textContent.trim() || card.dataset.artist || '';
      const quote = card.querySelector('.track-quote')?.textContent.replace(/^[«\s]+|[»\s]+$/g, '').trim() || card.dataset.lyrics || '';
      const catLabel = card.querySelector('.badge-cat')?.textContent.trim() || card.dataset.category || '';
      const year = card.querySelector('.track-year-badge')?.textContent.trim() || '';
      const vibe = card.querySelector('.badge-vibe')?.textContent.trim() || '';
      const extLink = card.querySelector('a.btn-yt-ext')?.href || '';
      const ytIdMatch = extLink.match(/v=([a-zA-Z0-9_\-]+)/);
      const ytImgMatch = card.querySelector('img')?.src.match(/vi\/([a-zA-Z0-9_\-]+)\//);
      const youtubeId = ytIdMatch ? ytIdMatch[1] : (ytImgMatch ? ytImgMatch[1] : '');

      list.push({
        id,
        title,
        artist,
        category: card.dataset.category || '',
        categoryLabel: catLabel,
        youtubeId,
        year,
        vibe,
        lyricsQuote: quote,
        keywords: card.dataset.keywords || ''
      });
    });
    return list;
  }

  // Inizializzazione immediata da DOM (garantisce reattività al 100% fin dal primo frame)
  let tracks = parseTracksFromDOM();

  // Caricamento asincrono di tracks.json per arricchimento/aggiornamento
  fetch('tracks.json?v=2.4')
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data) && data.length > 0) {
        tracks = data;
        refillShuffleQueue(currentTrackIndex);
      }
    })
    .catch(err => {
      console.warn('Uso catalogo DOM locale:', err);
    });

  // Stato Globale
  let currentTrackIndex = 0;
  let activeFilter = 'all';
  let sleepTimerInterval = null;
  let sleepSecondsLeft = 0;

  // Stato Riproduzione Casuale Continua (Loop Random Mode)
  const LOOP_RANDOM_STORAGE_KEY = 'sanctuary_loop_random_mode';
  // Attivo di default (true) come richiesto
  let isRandomLoopActive = localStorage.getItem(LOOP_RANDOM_STORAGE_KEY) !== 'false';
  let shuffleQueue = [];
  let playbackHistory = [];
  let lastEndedTimestamp = 0;
  let hasUserStartedPlayback = false;

  // YouTube IFrame API Player
  let ytPlayer = null;
  let isPlayerReady = false;

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
  const stageSoundwave = document.getElementById('stageSoundwave');

  // Pulsanti Loop & Modalità Casuale Continua
  const loopRandomToggleBtn = document.getElementById('loopRandomToggleBtn');
  const loopRandomBtnLabel = document.getElementById('loopRandomBtnLabel');
  const loopStatusPill = document.getElementById('loopStatusPill');
  const loopStatusPillText = document.getElementById('loopStatusPillText');
  const startContinuousLoopBtn = document.getElementById('startContinuousLoopBtn');

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
  // FUNZIONI AUDIO PLAYER, CODA SHUFFLE & RIPRODUZIONE CONTINUA
  // ==========================================================================

  // Riempie la coda con tutti i 52 brani mescolati (Fisher-Yates) evitando ripetizioni immediate
  function refillShuffleQueue(excludeIndex = -1) {
    if (!tracks || tracks.length === 0) return;
    const indices = [];
    for (let i = 0; i < tracks.length; i++) {
      if (i !== excludeIndex) {
        indices.push(i);
      }
    }
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    // Se escluso, inseriscilo in fondo alla coda così da essere riprodotto per ultimo
    if (excludeIndex >= 0 && tracks.length > 1) {
      indices.push(excludeIndex);
    }
    shuffleQueue = indices;
  }

  // Preleva il prossimo brano dalla coda casuale di tutte le canzoni
  function getNextRandomTrackIndex() {
    if (!tracks || tracks.length === 0) return 0;
    if (tracks.length === 1) return 0;

    if (!shuffleQueue || shuffleQueue.length === 0) {
      refillShuffleQueue(currentTrackIndex);
    }

    let nextIdx = shuffleQueue.shift();
    if (nextIdx === currentTrackIndex && tracks.length > 1) {
      if (shuffleQueue.length > 0) {
        const alt = shuffleQueue.shift();
        shuffleQueue.push(nextIdx);
        nextIdx = alt;
      } else {
        refillShuffleQueue(currentTrackIndex);
        nextIdx = shuffleQueue.shift();
      }
    }
    return nextIdx;
  }

  // Aggiorna indicatori visivi della Modalità Loop Casuale Continuo
  function updateLoopUI() {
    if (loopRandomToggleBtn) {
      if (isRandomLoopActive) {
        loopRandomToggleBtn.classList.add('active');
        if (loopRandomBtnLabel) loopRandomBtnLabel.textContent = 'Loop: ON';
        loopRandomToggleBtn.setAttribute('aria-pressed', 'true');
        loopRandomToggleBtn.title = 'Modalità Loop Casuale ATTIVA: riproduzione continua automatica di tutte le canzoni. Clicca per disattivare.';
      } else {
        loopRandomToggleBtn.classList.remove('active');
        if (loopRandomBtnLabel) loopRandomBtnLabel.textContent = 'Loop: OFF';
        loopRandomToggleBtn.setAttribute('aria-pressed', 'false');
        loopRandomToggleBtn.title = 'Modalità Loop Casuale DISATTIVA. Clicca per attivare la riproduzione continua di tutte le canzoni.';
      }
    }

    if (loopStatusPill) {
      if (isRandomLoopActive) {
        loopStatusPill.classList.add('active');
        if (loopStatusPillText) loopStatusPillText.textContent = 'Loop Continuo ON';
        loopStatusPill.title = 'Riproduzione continua casuale attiva: quando un brano finisce, il prossimo parte da solo! Clicca per disattivare.';
      } else {
        loopStatusPill.classList.remove('active');
        if (loopStatusPillText) loopStatusPillText.textContent = 'Loop: Spento';
        loopStatusPill.title = 'Riproduzione continua disattivata. Clicca per riattivare la musica continua.';
      }
    }
    if (window.lucide) lucide.createIcons();
  }

  function updateSoundwave(isPlaying) {
    if (stageSoundwave) {
      if (isPlaying) {
        stageSoundwave.classList.remove('paused');
      } else {
        stageSoundwave.classList.add('paused');
      }
    }
  }

  // Gestione termine brano: quando un brano finisce, la musica deve continuare da sola!
  function handleTrackEnded() {
    const now = Date.now();
    // Protezione debounce: evita trigger duplicati entro 2 secondi
    if (now - lastEndedTimestamp < 2000) return;
    lastEndedTimestamp = now;

    console.log('[Sanctuary] Brano terminato. isRandomLoopActive =', isRandomLoopActive);

    if (isRandomLoopActive) {
      const nextIdx = getNextRandomTrackIndex();
      const nextTrack = tracks[nextIdx];
      if (nextTrack) {
        showToast(`🎵 Brano completato! Avvio automatico: ${nextTrack.title} – ${nextTrack.artist}`);
      }

      // Transizione fluida continua per il browser
      setTimeout(() => {
        playTrackByIndex(nextIdx, { autoplay: true, notifyToast: false, scrollToPlayer: false });
      }, 400);
    } else {
      updateSoundwave(false);
      const cur = tracks[currentTrackIndex];
      nowPlayingStatus.textContent = `Brano terminato: ${cur ? cur.title : ''}. Attiva il Loop Casuale per continuare automaticamente.`;
    }
  }

  // Inizializzazione YouTube IFrame Player API
  function initYouTubePlayer() {
    if (typeof YT === 'undefined' || !YT.Player) {
      return;
    }
    if (ytPlayer) return;

    try {
      ytPlayer = new YT.Player('mainVideoFrame', {
        events: {
          'onReady': () => {
            isPlayerReady = true;
            console.log('[Sanctuary] YouTube IFrame Player API collegato con successo');
          },
          'onStateChange': (event) => {
            // YT.PlayerState: ENDED = 0, PLAYING = 1, PAUSED = 2, BUFFERING = 3, CUED = 5
            if (event.data === 0) {
              handleTrackEnded();
            } else if (event.data === 1) {
              hasUserStartedPlayback = true;
              updateSoundwave(true);
            } else if (event.data === 2) {
              updateSoundwave(false);
            }
          },
          'onError': (event) => {
            console.warn('[Sanctuary] Errore riproduzione YouTube Player:', event.data);
            if (isRandomLoopActive) {
              showToast('⚠️ Brano non disponibile, passo al successivo in riproduzione continua...');
              setTimeout(() => {
                const nextIdx = getNextRandomTrackIndex();
                playTrackByIndex(nextIdx, { autoplay: true, notifyToast: false });
              }, 1200);
            }
          }
        }
      });
    } catch (err) {
      console.warn('[Sanctuary] Inizializzazione YT.Player fallita, userò iframe fallback:', err);
    }
  }

  // Listener fallback per messaggi postMessage di YouTube
  window.addEventListener('message', (event) => {
    if (typeof event.origin === 'string' && !event.origin.includes('youtube.com') && !event.origin.includes('youtube-nocookie.com')) {
      return;
    }
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (!data) return;

      const isEnded = (data.event === 'onStateChange' && data.info === 0) ||
                      (data.info && data.info.playerState === 0);
      if (isEnded) {
        handleTrackEnded();
      } else if ((data.event === 'onStateChange' && data.info === 1) || (data.info && data.info.playerState === 1)) {
        hasUserStartedPlayback = true;
        updateSoundwave(true);
      } else if ((data.event === 'onStateChange' && data.info === 2) || (data.info && data.info.playerState === 2)) {
        updateSoundwave(false);
      }
    } catch (e) {
      // Ignora messaggi non-JSON
    }
  });

  if (window.YT && window.YT.Player) {
    initYouTubePlayer();
  } else {
    window.onYouTubeIframeAPIReady = function() {
      initYouTubePlayer();
    };
  }

  function playTrackByIndex(index, options = {}) {
    if (index < 0) index = tracks.length - 1;
    if (index >= tracks.length) index = 0;

    // Registra nello storico per il pulsante "Precedente"
    if (currentTrackIndex !== index && currentTrackIndex >= 0) {
      playbackHistory.push(currentTrackIndex);
      if (playbackHistory.length > 50) playbackHistory.shift();
    }

    currentTrackIndex = index;
    const track = tracks[currentTrackIndex];
    if (!track) return;

    hasUserStartedPlayback = true;

    // Rimuovi dal mazzo shuffle corrente per non ripetere fino al completamento del ciclo
    const inQueueIdx = shuffleQueue.indexOf(currentTrackIndex);
    if (inQueueIdx !== -1) {
      shuffleQueue.splice(inQueueIdx, 1);
    }

    // URL YouTube con parametri di sicurezza, jsapi e autoplay
    const originParam = (window.location.origin && window.location.origin !== 'null')
      ? `&origin=${encodeURIComponent(window.location.origin)}`
      : '';
    let embedUrl = `https://www.youtube-nocookie.com/embed/${track.youtubeId}?enablejsapi=1&rel=0${originParam}`;
    if (options.autoplay) {
      embedUrl += '&autoplay=1';
    }
    if (options.startSeconds) {
      embedUrl += `&start=${options.startSeconds}`;
    }

    // Se YT.Player è già collegato e pronto, usiamo loadVideoById per transizione continua e fluida
    if (ytPlayer && isPlayerReady && typeof ytPlayer.loadVideoById === 'function') {
      try {
        if (options.startSeconds) {
          ytPlayer.loadVideoById({
            videoId: track.youtubeId,
            startSeconds: options.startSeconds
          });
        } else {
          ytPlayer.loadVideoById(track.youtubeId);
        }
      } catch (err) {
        console.warn('Fallback a iframe.src:', err);
        mainVideoFrame.src = embedUrl;
      }
    } else {
      mainVideoFrame.src = embedUrl;
    }

    // Aggiornamento Dati Palcoscenico
    stageSongTitle.textContent = track.title;
    stageSongArtist.textContent = track.artist;
    stageSongQuote.textContent = `«${track.lyricsQuote}»`;
    stageCatBadge.textContent = track.categoryLabel;
    stageYearBadge.textContent = track.year;
    stageVibeBadge.textContent = track.vibe;

    const remainingInQueue = shuffleQueue.length;
    const totalCount = tracks.length;
    const playedInCycle = totalCount - remainingInQueue;
    const cycleInfo = isRandomLoopActive ? ` • [${playedInCycle}/${totalCount}]` : '';

    nowPlayingStatus.textContent = `In riproduzione: ${track.title} – ${track.artist} (${track.year})${cycleInfo}`;

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

    updateSoundwave(true);
    if (window.lucide) lucide.createIcons();
  }

  function playTrackById(trackId, options = {}) {
    let idx = tracks.findIndex(t => t.id === trackId);
    if (idx === -1) {
      // Fallback DOM se la traccia non è ancora nella memoria
      const card = document.getElementById('card-' + trackId) || document.querySelector(`.track-card[data-id="${trackId}"]`);
      if (card) {
        const title = card.querySelector('.track-title')?.textContent.trim() || card.dataset.title || '';
        const artist = card.querySelector('.track-artist')?.textContent.trim() || card.dataset.artist || '';
        const quote = card.querySelector('.track-quote')?.textContent.replace(/^[«\s]+|[»\s]+$/g, '').trim() || card.dataset.lyrics || '';
        const catLabel = card.querySelector('.badge-cat')?.textContent.trim() || card.dataset.category || '';
        const year = card.querySelector('.track-year-badge')?.textContent.trim() || '';
        const vibe = card.querySelector('.badge-vibe')?.textContent.trim() || '';
        const extLink = card.querySelector('a.btn-yt-ext')?.href || '';
        const ytIdMatch = extLink.match(/v=([a-zA-Z0-9_\-]+)/);
        const ytImgMatch = card.querySelector('img')?.src.match(/vi\/([a-zA-Z0-9_\-]+)\//);
        const youtubeId = ytIdMatch ? ytIdMatch[1] : (ytImgMatch ? ytImgMatch[1] : '');

        const fallbackTrack = {
          id: trackId,
          title,
          artist,
          lyricsQuote: quote,
          category: card.dataset.category || '',
          categoryLabel: catLabel,
          year,
          vibe,
          youtubeId,
          keywords: card.dataset.keywords || ''
        };
        tracks.push(fallbackTrack);
        idx = tracks.length - 1;
      }
    }

    if (idx !== -1) {
      playTrackByIndex(idx, { autoplay: true, ...options });
    } else {
      console.warn('Track non trovata:', trackId);
      showToast('Impossibile riprodurre il brano richiesto');
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
      if (playbackHistory.length > 0) {
        const prevIdx = playbackHistory.pop();
        playTrackByIndex(prevIdx, { autoplay: true, notifyToast: true });
      } else {
        playTrackByIndex(currentTrackIndex - 1, { autoplay: true, notifyToast: true });
      }
    });
  }

  if (nextTrackBtn) {
    nextTrackBtn.addEventListener('click', () => {
      if (isRandomLoopActive) {
        const nextIdx = getNextRandomTrackIndex();
        playTrackByIndex(nextIdx, { autoplay: true, notifyToast: true });
      } else {
        playTrackByIndex(currentTrackIndex + 1, { autoplay: true, notifyToast: true });
      }
    });
  }

  if (randomTrackBtn) {
    randomTrackBtn.addEventListener('click', () => {
      // Cliccando Casuale ci assicuriamo che il loop continuo sia attivo per proseguire da solo
      if (!isRandomLoopActive) {
        isRandomLoopActive = true;
        localStorage.setItem(LOOP_RANDOM_STORAGE_KEY, 'true');
        updateLoopUI();
      }
      const randIdx = getNextRandomTrackIndex();
      playTrackByIndex(randIdx, { autoplay: true, scrollToPlayer: true, notifyToast: true });
      showToast(`🎲 Brano casuale: ${tracks[randIdx].title}`);
    });
  }

  function toggleRandomLoopMode() {
    isRandomLoopActive = !isRandomLoopActive;
    localStorage.setItem(LOOP_RANDOM_STORAGE_KEY, isRandomLoopActive ? 'true' : 'false');
    updateLoopUI();

    if (isRandomLoopActive) {
      showToast('🔀 Loop Casuale Continuo ATTIVATO! La musica proseguirà da sola.');
      if (!hasUserStartedPlayback) {
        const nextIdx = getNextRandomTrackIndex();
        playTrackByIndex(nextIdx, { autoplay: true, scrollToPlayer: true });
      }
    } else {
      showToast('⏹️ Loop Casuale Continuo Disattivato.');
    }
  }

  if (loopRandomToggleBtn) {
    loopRandomToggleBtn.addEventListener('click', toggleRandomLoopMode);
  }

  if (loopStatusPill) {
    loopStatusPill.addEventListener('click', toggleRandomLoopMode);
  }

  if (startContinuousLoopBtn) {
    startContinuousLoopBtn.addEventListener('click', () => {
      isRandomLoopActive = true;
      localStorage.setItem(LOOP_RANDOM_STORAGE_KEY, 'true');
      updateLoopUI();
      const nextIdx = getNextRandomTrackIndex();
      playTrackByIndex(nextIdx, { autoplay: true, scrollToPlayer: true });
      showToast('✨ Loop Casuale Continuo Avviato! La musica proseguirà da sola all\'infinito.');
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
  // FILTRI & RICERCA IN TEMPO REALE (Globale con Normalizzazione Avanzata)
  // ==========================================================================

  function normalizeSearchText(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function stripPunctuation(str) {
    return normalizeSearchText(str).replace(/[^a-z0-9]/g, '');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[m]);
  }

  function applyFiltersAndSearch() {
    const rawQuery = trackSearchInput ? trackSearchInput.value.trim() : '';
    const isSearching = rawQuery.length > 0;
    const qNorm = normalizeSearchText(rawQuery);
    const qClean = stripPunctuation(rawQuery);
    const qTokens = qNorm.split(/\s+/).filter(t => t.length > 0);

    let visibleCount = 0;

    trackCards.forEach((card) => {
      const category = card.dataset.category || '';
      const title = card.dataset.title || '';
      const artist = card.dataset.artist || '';
      const lyrics = card.dataset.lyrics || '';
      const keywords = card.dataset.keywords || '';

      // Se l'utente digita nell'input di ricerca, la ricerca è GLOBALE su tutte le 52 tracce
      const matchesFilter = isSearching ? true : (activeFilter === 'all' || category === activeFilter);

      // Normalizzazione per ricerche flessibili (accenti, spazi, trattini, punteggiatura)
      const cardTextNorm = normalizeSearchText(`${title} ${artist} ${lyrics} ${category} ${keywords}`);
      const cardTextClean = stripPunctuation(`${title} ${artist} ${lyrics} ${category} ${keywords}`);

      const matchesSearch = !isSearching ||
        cardTextNorm.includes(qNorm) ||
        (qClean.length >= 3 && cardTextClean.includes(qClean)) ||
        (qTokens.length > 1 && qTokens.every(tok => cardTextNorm.includes(tok) || (tok.length >= 3 && cardTextClean.includes(stripPunctuation(tok)))));

      if (matchesFilter && matchesSearch) {
        card.classList.remove('hidden');
        visibleCount++;
      } else {
        card.classList.add('hidden');
      }
    });

    if (searchCountFeedback) {
      if (isSearching) {
        searchCountFeedback.innerHTML = `Risultati per "<strong>${escapeHtml(rawQuery)}</strong>": ${visibleCount} di ${trackCards.length} brani`;
      } else {
        searchCountFeedback.textContent = `Mostrati ${visibleCount} di ${trackCards.length} brani`;
      }
    }

    if (emptySearchState) {
      if (visibleCount === 0) {
        emptySearchState.classList.remove('hidden');
      } else {
        emptySearchState.classList.add('hidden');
      }
    }

    if (clearSearchBtn) {
      if (isSearching) {
        clearSearchBtn.classList.remove('hidden');
      } else {
        clearSearchBtn.classList.add('hidden');
      }
    }
  }

  filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      switchCategory(tab.dataset.filter, { scroll: false });
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
      switchCategory('all', { scroll: false });
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

  // Keyboard Shortcuts (Frecce per tracce, L per toggle loop, S per shuffle)
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight') {
      if (isRandomLoopActive) {
        const nextIdx = getNextRandomTrackIndex();
        playTrackByIndex(nextIdx, { autoplay: true, notifyToast: true });
      } else {
        playTrackByIndex(currentTrackIndex + 1, { autoplay: true, notifyToast: true });
      }
    } else if (e.key === 'ArrowLeft') {
      if (playbackHistory.length > 0) {
        const prevIdx = playbackHistory.pop();
        playTrackByIndex(prevIdx, { autoplay: true, notifyToast: true });
      } else {
        playTrackByIndex(currentTrackIndex - 1, { autoplay: true, notifyToast: true });
      }
    } else if (e.key === 'l' || e.key === 'L') {
      toggleRandomLoopMode();
    } else if (e.key === 's' || e.key === 'S') {
      const nextIdx = getNextRandomTrackIndex();
      playTrackByIndex(nextIdx, { autoplay: true, notifyToast: true });
    }
  });


  // ==========================================================================
  // CATEGORIA NAVIGATION (DESKTOP + MOBILE DRAWER + FOOTER)
  // ==========================================================================

  function switchCategory(cat, options = {}) {
    activeFilter = cat;

    // Resetta eventuale ricerca testuale per mostrare immediatamente l'intera categoria selezionata
    if (trackSearchInput && trackSearchInput.value !== '') {
      trackSearchInput.value = '';
    }

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

    // Scroll verso il catalogo solo se richiesto (default true)
    if (options.scroll !== false) {
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

  const closeCookieBannerBtn = document.getElementById('closeCookieBannerBtn');

  if (closeCookieBannerBtn) {
    closeCookieBannerBtn.addEventListener('click', () => {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'dismissed');
      if (cookieBanner) {
        cookieBanner.style.display = 'none';
      }
    });
  }

  if (acceptCookieBtn) {
    acceptCookieBtn.addEventListener('click', () => {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
      if (cookieBanner) {
        cookieBanner.style.display = 'none';
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
  const footerOpenLicenseBtn = document.getElementById('footerOpenLicenseBtn');
  const footerOpenPrivacyBtn = document.getElementById('footerOpenPrivacyBtn');
  const footerOpenNoticeBtn = document.getElementById('footerOpenNoticeBtn');
  const openLicenseDrawerBtn = document.getElementById('openLicenseDrawerBtn');

  function openLegalModal() {
    if (!legalModal) return;
    legalModal.classList.remove('hidden');
    legalModal.classList.add('active');
    legalModal.setAttribute('aria-hidden', 'false');
    legalModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (window.lucide) lucide.createIcons();
  }

  function closeLegalModal() {
    if (!legalModal) return;
    legalModal.classList.add('hidden');
    legalModal.classList.remove('active');
    legalModal.setAttribute('aria-hidden', 'true');
    legalModal.style.display = 'none';
    document.body.style.overflow = '';
  }

  // Assicurati che legalModal sia chiuso di default
  closeLegalModal();

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

  if (openLicenseDrawerBtn) {
    openLicenseDrawerBtn.addEventListener('click', () => {
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
  if (footerOpenLicenseBtn) footerOpenLicenseBtn.addEventListener('click', openLegalModal);
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

  // Inizializza coda casuale e stato UI del loop
  refillShuffleQueue(currentTrackIndex);
  updateLoopUI();

  // Aggiorna icone finali
  if (window.lucide) lucide.createIcons();
});
