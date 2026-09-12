import { updateViewCount } from "./database.js";
import { fetchDiscordStatus, startDiscordPolling } from "./discord.js";

const titleTagText = document.querySelector("title")?.textContent.trim() || "Welcome";

document.addEventListener("DOMContentLoaded", () => {
  if (typeof config === 'undefined') {
    console.error("config.js not found!");
    return;
  }

  const enterGate = document.getElementById('enter-gate');
  const bgVideo = document.getElementById('bg-video');
  const bgAudio = document.getElementById('bg-audio');
  const audioToggle = document.getElementById('audio-toggle');
  const audioIcon = document.getElementById('audio-icon');
  const volumeSlider = document.getElementById('volume-slider');
  const playPauseBtn = document.getElementById('play-pause-btn');
  const playPauseIcon = document.getElementById('play-pause-icon');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const avatarElem = document.getElementById('user-avatar');
  const nameElem = document.getElementById('user-name');
  const badgesElem = document.getElementById('user-badges');
  const bioElem = document.getElementById('user-bio');
  const socialContainer = document.getElementById('social-links');
  const progressBar = document.getElementById('progress-bar');
  const currentTimeElem = document.getElementById('current-time');
  const durationElem = document.getElementById('duration');
  const songTitleElem = document.getElementById('song-title');
  const songArtistElem = document.getElementById('song-artist');
  const songImgElem = document.getElementById('song-img');
  const playlist = Array.isArray(config.songs) && config.songs.length
    ? config.songs
    : [{ audio: config.audio, title: config.musicTitle, artist: config.musicArtist }];
  let currentTrackIndex = 0;
  let isMuted = false;
  let isPlaying = false;
  let metadataRequestId = 0;
  let generatedArtworkUrl = null;

  function readSynchsafeSize(bytes, start) {
    return (bytes[start] << 21) | (bytes[start + 1] << 14) | (bytes[start + 2] << 7) | bytes[start + 3];
  }

  function readFrameSize(bytes, start, isV24) {
    return isV24
      ? readSynchsafeSize(bytes, start)
      : (bytes[start] << 24) | (bytes[start + 1] << 16) | (bytes[start + 2] << 8) | bytes[start + 3];
  }

  function readTextFrame(frame) {
    const encoding = frame[0];
    const decoder = encoding === 1 || encoding === 2 ? 'utf-16' : encoding === 3 ? 'utf-8' : 'windows-1252';
    try {
      return new TextDecoder(decoder).decode(frame.slice(1)).replace(/\0/g, '').trim();
    } catch {
      return new TextDecoder().decode(frame.slice(1)).replace(/\0/g, '').trim();
    }
  }

  function readEmbeddedMetadata(buffer) {
    const bytes = new Uint8Array(buffer);
    if (bytes.length < 10 || String.fromCharCode(...bytes.slice(0, 3)) !== 'ID3') return {};

    const version = bytes[3];
    if (version < 3 || version > 4) return {};

    const tagEnd = Math.min(bytes.length, 10 + readSynchsafeSize(bytes, 6));
    const isV24 = version === 4;
    let offset = 10;
    let title = '';
    let artist = '';
    let picture = null;

    while (offset + 10 <= tagEnd) {
      const frameId = String.fromCharCode(...bytes.slice(offset, offset + 4));
      const frameSize = readFrameSize(bytes, offset + 4, isV24);
      if (!frameId.trim() || frameSize <= 0) break;

      const frame = bytes.slice(offset + 10, offset + 10 + frameSize);
      if (frameId === 'TIT2') title = readTextFrame(frame);
      if (frameId === 'TPE1') artist = readTextFrame(frame);

      if (frameId === 'APIC' && frame.length > 4) {
        const encoding = frame[0];
        const mimeEnd = frame.indexOf(0, 1);
        if (mimeEnd >= 0) {
          const mime = new TextDecoder().decode(frame.slice(1, mimeEnd)) || 'image/jpeg';
          let cursor = mimeEnd + 2;
          const doubleByteText = encoding === 1 || encoding === 2;

          while (cursor < frame.length) {
            const atTerminator = doubleByteText
              ? frame[cursor] === 0 && frame[cursor + 1] === 0
              : frame[cursor] === 0;
            if (atTerminator) {
              cursor += doubleByteText ? 2 : 1;
              break;
            }
            cursor += doubleByteText ? 2 : 1;
          }

          picture = { mime, data: frame.slice(cursor) };
        }
      }

      offset += 10 + frameSize;
    }

    return { title, artist, picture };
  }

  async function getEmbeddedMetadata(url) {
    const response = await fetch(url);
    if (!response.ok) return {};
    return readEmbeddedMetadata(await response.arrayBuffer());
  }

  function setPlaybackState(playing) {
    isPlaying = playing;
    if (playPauseIcon) playPauseIcon.className = `fas fa-${playing ? 'pause' : 'play'} text-xl`;

    const playingIndicator = document.getElementById('playing-indicator');
    if (playingIndicator) {
      playingIndicator.classList.toggle('is-playing', playing);
      playingIndicator.setAttribute('aria-label', playing ? 'Playing' : 'Paused');
      playingIndicator.title = playing ? 'Playing' : 'Paused';
    }
    if (playPauseBtn) playPauseBtn.setAttribute('aria-label', playing ? 'Pause track' : 'Play track');
  }

  function updateTrackArtwork(track, requestId) {
    if (!songImgElem) return;

    if (generatedArtworkUrl) {
      URL.revokeObjectURL(generatedArtworkUrl);
      generatedArtworkUrl = null;
    }

    songImgElem.src = track?.cover || config.avatar || './assets/favicon.png';
    songImgElem.alt = `${track?.title || 'Song'} artwork`;

    if (!track?.audio) return;

    getEmbeddedMetadata(track.audio).then(metadata => {
      if (requestId !== metadataRequestId) return;
      if (songTitleElem && metadata.title) songTitleElem.textContent = metadata.title;
      if (songArtistElem && metadata.artist) songArtistElem.textContent = metadata.artist;
      if (!metadata.picture?.data?.length) return;

      generatedArtworkUrl = URL.createObjectURL(new Blob([metadata.picture.data], { type: metadata.picture.mime }));
      songImgElem.src = generatedArtworkUrl;
      songImgElem.alt = `${metadata.title || track.title || 'Song'} artwork`;
    }).catch(() => {
      // Configured artwork remains visible when the MP3 has no readable metadata.
    });
  }

  function loadTrack(index, autoplay = false) {
    currentTrackIndex = (index + playlist.length) % playlist.length;
    const track = playlist[currentTrackIndex];
    if (!bgAudio || !track?.audio) return;

    bgAudio.src = track.audio;

    if (songTitleElem) songTitleElem.textContent = track.title || 'Now playing';
    if (songArtistElem) songArtistElem.textContent = track.artist || config.username || '';
    const requestId = ++metadataRequestId;
    updateTrackArtwork(track, requestId);
    if (progressBar) progressBar.style.width = '0%';
    if (currentTimeElem) currentTimeElem.textContent = '0:00';
    if (durationElem) durationElem.textContent = '0:00';

    bgAudio.load();
    if (autoplay) {
      bgAudio.play()
        .then(() => setPlaybackState(true))
        .catch(error => {
          console.log("Playback error:", error);
          setPlaybackState(false);
        });
    } else {
      setPlaybackState(false);
    }
  }

  if (nameElem && config.username) {
    nameElem.textContent = config.username;
  }
  if (badgesElem && Array.isArray(config.badges)) {
    badgesElem.innerHTML = config.badges.filter(badge => badge?.icon).map(badge => `
      <span class="profile-badge" style="--badge-color: ${badge.color || '#64748b'}" title="${badge.label || 'Profile badge'}" aria-label="${badge.label || 'Profile badge'}">
        ${/^https?:\/\//i.test(badge.icon)
          ? `<img src="${badge.icon}" alt="" aria-hidden="true">`
          : `<span class="iconify" data-icon="${badge.icon}" aria-hidden="true"></span>`}
      </span>
    `).join('');
    badgesElem.hidden = !badgesElem.childElementCount;
    if (window.Iconify) window.Iconify.scan(badgesElem);
  }
  if (bioElem && config.bio) bioElem.textContent = config.bio;
  if (avatarElem && config.avatar) avatarElem.src = config.avatar;
  if (bgVideo && config.background) bgVideo.src = config.background;
  loadTrack(currentTrackIndex);

  if (socialContainer && config.socials && Array.isArray(config.socials)) {
    socialContainer.innerHTML = config.socials.map(link => `
      <a href="${link.url}" target="_blank" rel="noopener noreferrer" 
         class="social-link p-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl backdrop-blur-md transition-all duration-300 hover:scale-110 flex items-center justify-center"
        aria-label="${link.title || link.label || 'Social profile'}" title="${link.title || link.label || 'Social profile'}">
        <i class="${link.icon} text-gray-700 text-xl" aria-hidden="true"></i>
      </a>
    `).join('');
  }

  function updateAudioIcon() {
    if (!audioIcon) return;
    
    let iconName = 'volume-2';

    if (isMuted || bgAudio.volume === 0) {
      iconName = 'volume-x';
    } else if (bgAudio.volume <= 0.5) {
      iconName = 'volume-1';
    } else {
      iconName = "volume-2";
    }

    const currentIcon = document.querySelector('#audio-toggle [data-lucide]') || audioIcon;
    currentIcon.setAttribute('data-lucide', iconName);
    
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  if (audioToggle && bgAudio) {
    audioToggle.addEventListener('click', () => {
      isMuted = !isMuted;
      bgAudio.muted = isMuted;
      updateAudioIcon();
    });
  }

  function updateVolumeSliderVisual() {
    if (!volumeSlider) return;

    const min = Number(volumeSlider.min || 0);
    const max = Number(volumeSlider.max || 1);
    const value = Number(volumeSlider.value || 0);
    const percent = ((value - min) / (max - min)) * 100;

    volumeSlider.style.setProperty('--volume-level', `${percent}%`);
  }

  if (volumeSlider && bgAudio) {
    volumeSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      bgAudio.volume = val;
      
      isMuted = (val === 0);
      bgAudio.muted = isMuted;
      updateVolumeSliderVisual();
      updateAudioIcon();
    });
    
    bgAudio.volume = parseFloat(volumeSlider.value);
    updateVolumeSliderVisual();
  }

  if (playPauseBtn && bgAudio) {
    playPauseBtn.addEventListener('click', () => {
      if (isPlaying) {
        bgAudio.pause();
        setPlaybackState(false);
      } else {
        bgAudio.play()
          .then(() => setPlaybackState(true))
          .catch(err => {
            console.log("Playback error:", err);
            setPlaybackState(false);
          });
      }
    });
  }

  if (bgAudio) {
    bgAudio.addEventListener('play', () => setPlaybackState(true));
    bgAudio.addEventListener('pause', () => setPlaybackState(false));
    bgAudio.addEventListener('error', () => setPlaybackState(false));
    bgAudio.addEventListener('loadedmetadata', () => {
      if (durationElem) durationElem.textContent = formatTime(bgAudio.duration);
    });
    bgAudio.addEventListener('timeupdate', () => {
      if (bgAudio.duration) {
        const percent = (bgAudio.currentTime / bgAudio.duration) * 100;
        if (progressBar) progressBar.style.width = percent + '%';
        if (currentTimeElem) currentTimeElem.textContent = formatTime(bgAudio.currentTime);
        if (durationElem) durationElem.textContent = formatTime(bgAudio.duration);
      }
    });
    bgAudio.addEventListener('ended', () => {
      const nextIndex = (currentTrackIndex + 1) % playlist.length;
      loadTrack(nextIndex, true);
    });
  }

  const progressContainer = document.getElementById('progress-container');
  if (progressContainer && bgAudio) {
    function seekFromPosition(position) {
      if (!bgAudio.duration) return;
      bgAudio.currentTime = Math.max(0, Math.min(position, 1)) * bgAudio.duration;
    }

    progressContainer.addEventListener('click', (event) => {
      const bounds = progressContainer.getBoundingClientRect();
      seekFromPosition((event.clientX - bounds.left) / bounds.width);
    });

    progressContainer.addEventListener('keydown', (event) => {
      if (!bgAudio.duration) return;
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const currentPosition = bgAudio.currentTime / bgAudio.duration;
      const nextPosition = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? 1
          : currentPosition + (event.key === 'ArrowRight' ? 0.05 : -0.05);
      seekFromPosition(nextPosition);
    });
  }

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  if (nextBtn && bgAudio) {
    nextBtn.addEventListener('click', () => {
      loadTrack(currentTrackIndex + 1, isPlaying);
    });
  }

  if (prevBtn && bgAudio) {
    prevBtn.addEventListener('click', () => {
      loadTrack(currentTrackIndex - 1, isPlaying);
    });
  }

  if (enterGate) {
    enterGate.addEventListener('click', () => {
      enterGate.classList.add('opacity-0');
      document.body.classList.add('entered');
      setTimeout(() => enterGate.remove(), 700);

      if (bgAudio && playlist.length) {
        bgAudio.play()
          .then(() => setPlaybackState(true))
          .catch(err => {
            console.log("Autoplay blocked:", err);
            setPlaybackState(false);
          });
      }

      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
      }
    });
  }

  updateAudioIcon();

  // --- Live local time for Georgia (Tbilisi) ---
  const localTimeElem = document.getElementById('local-time');
  if (localTimeElem) {
    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Tbilisi'
    });
    const renderLocalTime = () => {
      localTimeElem.textContent = `· ${timeFormatter.format(new Date())}`;
    };
    renderLocalTime();
    setInterval(renderLocalTime, 30000);
  }

  // --- Share / copy link ---
  const shareBtn = document.getElementById('share-btn');
  const toast = document.getElementById('toast');
  let toastTimer = null;
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('toast-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('toast-show'), 2200);
  }
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const url = window.location.href;
      const shareData = { title: document.title || config.username || 'Bio', url };
      if (navigator.share) {
        try {
          await navigator.share(shareData);
          return;
        } catch {
          // User dismissed the share sheet or it failed — fall back to copy.
        }
      }
      showToast(await copyToClipboard(url) ? 'Link copied to clipboard' : url);
    });
  }

  // --- Theme toggle ---
  const themeToggle = document.getElementById('theme-toggle');
  function syncThemeIcon() {
    const icon = document.querySelector('#theme-toggle [data-lucide]');
    if (!icon || !window.themeController) return;
    // Show the icon for the theme you'll switch *to*.
    icon.setAttribute('data-lucide', window.themeController.getTheme() === 'dark' ? 'sun' : 'moon');
    if (window.lucide) lucide.createIcons();
  }
  function switchTheme() {
    if (!window.themeController) return;
    const next = window.themeController.toggleTheme();
    syncThemeIcon();
    showToast(next === 'dark' ? 'Dark theme' : 'Light theme');
  }
  syncThemeIcon();
  if (themeToggle) themeToggle.addEventListener('click', switchTheme);

  // --- Keyboard shortcuts ---
  function adjustVolume(delta) {
    if (!bgAudio) return;
    const next = Math.min(1, Math.max(0, (isNaN(bgAudio.volume) ? 1 : bgAudio.volume) + delta));
    bgAudio.volume = next;
    isMuted = next === 0;
    bgAudio.muted = isMuted;
    if (volumeSlider) volumeSlider.value = String(next);
    updateVolumeSliderVisual();
    updateAudioIcon();
  }

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
    if (isTyping || event.metaKey || event.ctrlKey || event.altKey) return;
    if (!bgAudio) return;

    switch (event.key) {
      case ' ':
      case 'Spacebar':
        event.preventDefault();
        if (playPauseBtn) playPauseBtn.click();
        break;
      case 'ArrowRight':
        if (bgAudio.duration) {
          event.preventDefault();
          bgAudio.currentTime = Math.min(bgAudio.duration, bgAudio.currentTime + 5);
        }
        break;
      case 'ArrowLeft':
        if (bgAudio.duration) {
          event.preventDefault();
          bgAudio.currentTime = Math.max(0, bgAudio.currentTime - 5);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        adjustVolume(0.05);
        break;
      case 'ArrowDown':
        event.preventDefault();
        adjustVolume(-0.05);
        break;
      case 'n':
      case 'N':
        loadTrack(currentTrackIndex + 1, isPlaying);
        break;
      case 'p':
      case 'P':
        loadTrack(currentTrackIndex - 1, isPlaying);
        break;
      case 'm':
      case 'M':
        isMuted = !isMuted;
        bgAudio.muted = isMuted;
        updateAudioIcon();
        showToast(isMuted ? 'Muted' : 'Unmuted');
        break;
      case 't':
      case 'T':
        switchTheme();
        break;
      default:
        break;
    }
  });
});

if (window.lucide) {
  lucide.createIcons();
}


document.addEventListener("DOMContentLoaded", fetchDiscordStatus);
document.addEventListener("DOMContentLoaded", () => startDiscordPolling());
document.addEventListener("DOMContentLoaded", updateViewCount);

  function startTitleAnimation(speed = 350, pauseDuration = 2000) {

  const originalTitle = titleTagText;
  let index = 0;
  let isWaiting = false;

  setInterval(() => {
    if (isWaiting) return;


    index++;
    document.title = originalTitle.substring(0, index);


  if (index === originalTitle.length) {
      isWaiting = true;
      setTimeout(() => {
        index = 0;
        isWaiting = false;
      }, pauseDuration); 
    }
  }, speed);
}


document.addEventListener("DOMContentLoaded", () => {
  startTitleAnimation(2000, 2000); 

});
