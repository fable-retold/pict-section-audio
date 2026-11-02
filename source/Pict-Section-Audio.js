const libPictViewClass = require('pict-view');
const _DefaultConfiguration = require('./Pict-Section-Audio-DefaultConfiguration.js');

/**
 * pict-section-audio — a bespoke audio player section.
 *
 * Drop it on a page, point it at an audio URL, and it shows a titled player with cover art (or a music glyph), an
 * optional precomputed waveform, and a control bar (play/pause, a seek scrubber, a time readout, mute + volume, a
 * playback-rate cycle and download). Seeking rides the browser's native HTTP Range requests, so a range-served file
 * (orator-file-service, a Sluice depot, a bare 206 URL) scrubs without downloading the whole track.
 *
 * It is a single pict-view in the lightweight single-view shape (like pict-section-image / pict-section-video): a
 * stub container template, with the player DOM built imperatively in onAfterInitialRender — an <audio> element, its
 * media events, and the peaks <canvas> have no template equivalent.
 *
 * Standalone, or driven as the audio renderer inside pict-section-fileview: the fileview delegate mounts it with
 * ShowDownload:false (fileview owns the download) but keeps the control bar + header, and feeds files through
 * setAudio().
 *
 * Event wiring note: the control-bar buttons, the seek/volume inputs, the waveform canvas and the <audio>'s media
 * events use element-property handlers (`el.onclick = ...`, `audio.ontimeupdate = ...`), not addEventListener and
 * not template inline handlers — the same programmatic-element exception pict-section-image / pict-section-video
 * document (a built-once imperative widget whose media events have no template-handler equivalent).
 */
class PictSectionAudio extends libPictViewClass
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DefaultConfiguration, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		this.initialRenderComplete = false;

		// DOM handles — built once in onAfterInitialRender.
		this.targetElement = false;
		this._rootElement = null;
		this._audioElement = null;
		this._artElement = null;
		this._titleElement = null;
		this._subtitleElement = null;
		this._waveElement = null;
		this._controlsElement = null;
		this._playButtonElement = null;
		this._seekElement = null;
		this._currentTimeElement = null;
		this._durationElement = null;
		this._muteButtonElement = null;
		this._volumeElement = null;
		this._rateButtonElement = null;
		this._downloadElement = null;

		// View state.
		this._url = this.options.AudioURL || '';
		this._posterURL = this.options.PosterURL || '';
		this._title = this.options.Title || '';
		this._subtitle = this.options.Subtitle || '';
		this._peaks = Array.isArray(this.options.Peaks) ? this.options.Peaks.slice() : null;
		this._downloadURL = this.options.DownloadURL || '';
		this._downloadName = this.options.DownloadName || '';

		this._loaded = false;       // metadata (duration) available
		this._error = false;
		this._playing = false;
		this._duration = 0;
		this._currentTime = 0;
		this._muted = !!this.options.Muted;
		this._volume = (typeof this.options.Volume === 'number') ? Math.min(1, Math.max(0, this.options.Volume)) : 1;
		this._playbackRate = 1;

		this._playbackRates = (Array.isArray(this.options.PlaybackRates) && this.options.PlaybackRates.length)
			? this.options.PlaybackRates.slice() : [ 1 ];
	}

	onBeforeInitialize()
	{
		super.onBeforeInitialize();
		this.targetElement = false;
	}

	onAfterRender(pRenderable)
	{
		// Ensure the CSS from all registered views is injected (pict rule for lazy-rendered views).
		this.pict.CSSMap.injectCSS();

		// Build the player when it isn't present — the first render, or a host re-render that re-stamped the stub.
		// Instance state (_url, _currentTime) persists, so a rebuild re-loads the current track (self-healing).
		if (!this._playerPresent())
		{
			this.onAfterInitialRender();
			this.initialRenderComplete = true;
		}

		return super.onAfterRender(pRenderable);
	}

	/** Is the player DOM currently present in the target (false after the first render or a stub re-stamp)? */
	_playerPresent()
	{
		return !!this._queryOwned('#' + this.Hash + '-Controls') || !!this._queryOwned('#' + this.Hash + '-Audio');
	}

	onAfterInitialRender()
	{
		let tmpTargetElementSet = this.services.ContentAssignment.getElement(this.options.TargetElementAddress);
		if (!tmpTargetElementSet || tmpTargetElementSet.length < 1)
		{
			this.log.error(`PICT-Audio Could not find target element [${this.options.TargetElementAddress}]!`);
			this.targetElement = false;
			return false;
		}
		this.targetElement = tmpTargetElementSet[0];

		this._buildPlayerDOM();

		if (this._url)
		{
			this._loadAudio(this._url);
		}
	}

	// -----------------------------------------------------------------------------------------------------------
	// DOM construction (once)
	// -----------------------------------------------------------------------------------------------------------

	_buildPlayerDOM()
	{
		const tmpBase = this.Hash;
		this._ensureIcons();

		let tmpHeader = '';
		if (this.options.ShowArtwork)
		{
			tmpHeader = '<div class="psa-header" id="' + tmpBase + '-Header">'
				+ '<div class="psa-art" id="' + tmpBase + '-Art">' + this._artHTML() + '</div>'
				+ '<div class="psa-meta">'
				+ '<div class="psa-title" id="' + tmpBase + '-Title">' + this._esc(this._title || 'Audio') + '</div>'
				+ '<div class="psa-sub" id="' + tmpBase + '-Sub">' + this._esc(this._subtitle) + '</div>'
				+ '</div>'
				+ '</div>';
		}

		const tmpWave = this._peaks ? ('<canvas class="psa-wave" id="' + tmpBase + '-Wave"></canvas>') : '';

		let tmpControls = '';
		if (this.options.ShowToolbar)
		{
			let tmpDownload = '';
			if (this.options.ShowDownload)
			{
				tmpDownload = '<a class="psa-btn psa-download" id="' + tmpBase + '-Download" style="display:none" href="#" download>'
					+ this._icon('Download') + '</a>';
			}
			tmpControls = '<div class="psa-controls" id="' + tmpBase + '-Controls">'
				+ '<button type="button" class="psa-btn psa-play-btn" id="' + tmpBase + '-PlayBtn" title="Play">' + this._icon('Play') + '</button>'
				+ '<span class="psa-time psa-current" id="' + tmpBase + '-Current">0:00</span>'
				+ '<input type="range" class="psa-seek" id="' + tmpBase + '-Seek" min="0" max="1000" value="0" step="1" disabled title="Seek" />'
				+ '<span class="psa-time psa-duration" id="' + tmpBase + '-Duration">0:00</span>'
				+ '<button type="button" class="psa-btn psa-mute-btn" id="' + tmpBase + '-MuteBtn" title="Mute">' + this._icon(this._muted ? 'VolumeMute' : 'VolumeHigh') + '</button>'
				+ '<input type="range" class="psa-volume" id="' + tmpBase + '-Volume" min="0" max="100" value="' + Math.round(this._volume * 100) + '" step="1" title="Volume" />'
				+ '<button type="button" class="psa-btn psa-rate" id="' + tmpBase + '-RateBtn" title="Playback speed">1&times;</button>'
				+ '<span class="psa-spacer"></span>'
				+ tmpDownload
				+ '</div>';
		}

		const tmpPreload = this._esc(this.options.Preload || 'metadata');
		const tmpAudioAttributes = ''
			+ (this.options.AutoPlay ? ' autoplay' : '')
			+ (this.options.Loop ? ' loop' : '')
			+ (this._muted ? ' muted' : '')
			+ ' preload="' + tmpPreload + '"';

		const tmpHTML = '<div class="psa-root" id="' + tmpBase + '-Root">'
			+ tmpHeader
			+ tmpWave
			+ '<audio class="psa-audio" id="' + tmpBase + '-Audio"' + tmpAudioAttributes + '></audio>'
			+ tmpControls
			+ '</div>';

		this.pict.ContentAssignment.assignContent(this.options.TargetElementAddress, tmpHTML);

		this._rootElement = this._queryOwned('#' + tmpBase + '-Root');
		this._audioElement = this._queryOwned('#' + tmpBase + '-Audio');
		this._artElement = this._queryOwned('#' + tmpBase + '-Art');
		this._titleElement = this._queryOwned('#' + tmpBase + '-Title');
		this._subtitleElement = this._queryOwned('#' + tmpBase + '-Sub');
		this._waveElement = this._queryOwned('#' + tmpBase + '-Wave');
		this._controlsElement = this._queryOwned('#' + tmpBase + '-Controls');
		this._playButtonElement = this._queryOwned('#' + tmpBase + '-PlayBtn');
		this._seekElement = this._queryOwned('#' + tmpBase + '-Seek');
		this._currentTimeElement = this._queryOwned('#' + tmpBase + '-Current');
		this._durationElement = this._queryOwned('#' + tmpBase + '-Duration');
		this._muteButtonElement = this._queryOwned('#' + tmpBase + '-MuteBtn');
		this._volumeElement = this._queryOwned('#' + tmpBase + '-Volume');
		this._rateButtonElement = this._queryOwned('#' + tmpBase + '-RateBtn');
		this._downloadElement = this._queryOwned('#' + tmpBase + '-Download');

		this._wireMediaElement();
		this._wireControls();

		if (this._audioElement)
		{
			try { this._audioElement.volume = this._volume; } catch (pError) { /* headless */ }
			this._audioElement.muted = this._muted;
		}

		this._renderWaveform();
	}

	/** Wire the <audio>'s media events (element-property handlers; see the class note). */
	_wireMediaElement()
	{
		if (!this._audioElement) { return; }
		let tmpSelf = this;
		this._audioElement.onloadedmetadata = function () { tmpSelf._onLoadedMetadata(); };
		this._audioElement.ontimeupdate = function () { tmpSelf._onTimeUpdate(); };
		this._audioElement.onplay = function () { tmpSelf._onPlay(); };
		this._audioElement.onpause = function () { tmpSelf._onPause(); };
		this._audioElement.onended = function () { tmpSelf._onEnded(); };
		this._audioElement.onvolumechange = function () { tmpSelf._onVolumeChange(); };
		this._audioElement.onratechange = function () { tmpSelf._onRateChange(); };
		this._audioElement.onerror = function () { tmpSelf._onError(); };
	}

	/** Wire the control-bar buttons + sliders + the waveform click-to-seek (element-property handlers). */
	_wireControls()
	{
		let tmpSelf = this;
		if (this._playButtonElement) { this._playButtonElement.onclick = function () { tmpSelf.togglePlay(); }; }
		if (this._muteButtonElement) { this._muteButtonElement.onclick = function () { tmpSelf.toggleMute(); }; }
		if (this._rateButtonElement) { this._rateButtonElement.onclick = function () { tmpSelf.cyclePlaybackRate(); }; }
		if (this._seekElement) { this._seekElement.oninput = function () { tmpSelf._onSeekInput(); }; }
		if (this._volumeElement) { this._volumeElement.oninput = function () { tmpSelf._onVolumeInput(); }; }
		if (this._waveElement) { this._waveElement.onclick = function (pEvent) { tmpSelf._onWaveformClick(pEvent); }; }
	}

	/** querySelector scoped to the player subtree, via ContentAssignment, returning the element or null. */
	_queryOwned(pSelector)
	{
		let tmpSet = this.services.ContentAssignment.getElement(pSelector);
		return (tmpSet && tmpSet.length > 0) ? tmpSet[0] : null;
	}

	/** The art cell's inner HTML — a cover <img> when a poster is set, otherwise a music glyph. */
	_artHTML()
	{
		if (this._posterURL) { return '<img alt="' + this._esc(this._title || 'Cover art') + '" src="' + this._esc(this._posterURL) + '" />'; }
		return this._icon('MusicNote');
	}

	// -----------------------------------------------------------------------------------------------------------
	// Media loading
	// -----------------------------------------------------------------------------------------------------------

	_loadAudio(pURL)
	{
		this._loaded = false;
		this._error = false;
		this._playing = false;
		this._duration = 0;
		this._currentTime = 0;

		// Recover from a prior error: _paintErrorState replaced the root contents and dropped the <audio>, so
		// rebuild the player DOM before loading.
		if (!this._audioElement && this.targetElement)
		{
			this._buildPlayerDOM();
		}
		if (!this._audioElement) { return; }

		if (!pURL)
		{
			this._audioElement.removeAttribute('src');
			this._refreshControls();
			return;
		}

		this._audioElement.setAttribute('src', pURL);
		try { if (typeof this._audioElement.load === 'function') { this._audioElement.load(); } }
		catch (pError) { /* headless / unsupported */ }

		this._refreshControls();
	}

	_onLoadedMetadata()
	{
		this._loaded = true;
		this._error = false;
		this._duration = this._readDuration();
		this._refreshControls();
	}

	_onTimeUpdate()
	{
		this._currentTime = this._audioElement ? (this._audioElement.currentTime || 0) : 0;
		if (!this._duration) { this._duration = this._readDuration(); }
		this._refreshTimeDisplay();
		this._refreshSeek();
		this._renderWaveform();
	}

	_onPlay() { this._playing = true; this._refreshPlayButton(); }
	_onPause() { this._playing = false; this._refreshPlayButton(); }
	_onEnded() { this._playing = false; this._refreshPlayButton(); }

	_onVolumeChange()
	{
		if (!this._audioElement) { return; }
		this._muted = !!this._audioElement.muted;
		this._volume = (typeof this._audioElement.volume === 'number') ? this._audioElement.volume : this._volume;
		this._refreshVolume();
	}

	_onRateChange()
	{
		if (!this._audioElement) { return; }
		this._playbackRate = this._audioElement.playbackRate || 1;
		this._refreshRate();
	}

	_onError()
	{
		this._loaded = false;
		this._error = true;
		this._playing = false;
		this._paintErrorState();
	}

	_readDuration()
	{
		if (!this._audioElement) { return 0; }
		const tmpDuration = this._audioElement.duration;
		return (typeof tmpDuration === 'number' && isFinite(tmpDuration) && tmpDuration > 0) ? tmpDuration : 0;
	}

	_paintErrorState()
	{
		if (!this._rootElement) { return; }
		let tmpDownload = '';
		if (this._downloadURL || this._url)
		{
			tmpDownload = '<a class="psa-btn" href="' + this._esc(this._downloadURL || this._url) + '" download'
				+ (this._downloadName ? ('="' + this._esc(this._downloadName) + '"') : '')
				+ '>' + this._icon('Download') + ' Download</a>';
		}
		const tmpBase = this.Hash;
		this.pict.ContentAssignment.assignContent('#' + tmpBase + '-Root',
			'<div class="psa-error"><span class="psa-error-glyph">' + this._icon('MusicNote') + '</span>'
			+ '<p>This audio could not be played.</p>' + tmpDownload + '</div>');
		// The <audio> node was replaced by the error block; drop stale references so a later setAudio rebuilds.
		this._audioElement = null;
		this._controlsElement = null;
		this._waveElement = null;
	}

	// -----------------------------------------------------------------------------------------------------------
	// Control-bar input handlers
	// -----------------------------------------------------------------------------------------------------------

	_onSeekInput()
	{
		if (!this._audioElement || !this._seekElement) { return; }
		const tmpDuration = this._duration || this._readDuration();
		if (!tmpDuration) { return; }
		const tmpFraction = Number(this._seekElement.value) / 1000;
		this.seekTo(tmpFraction * tmpDuration);
	}

	_onVolumeInput()
	{
		if (!this._volumeElement) { return; }
		this.setVolume(Number(this._volumeElement.value) / 100);
	}

	/** A click on the waveform seeks to the corresponding fraction of the track. */
	_onWaveformClick(pEvent)
	{
		if (!this._waveElement) { return; }
		const tmpWidth = this._waveElement.clientWidth || this._waveElement.width || 0;
		const tmpOffset = (pEvent && typeof pEvent.offsetX === 'number') ? pEvent.offsetX : 0;
		if (!tmpWidth) { return; }
		const tmpDuration = this._duration || this._readDuration();
		if (!tmpDuration) { return; }
		this.seekTo((tmpOffset / tmpWidth) * tmpDuration);
	}

	// -----------------------------------------------------------------------------------------------------------
	// Control refresh
	// -----------------------------------------------------------------------------------------------------------

	_refreshControls()
	{
		this._refreshPlayButton();
		this._refreshTimeDisplay();
		this._refreshSeek();
		this._refreshVolume();
		this._refreshRate();
		this._refreshDownload();
	}

	_refreshPlayButton()
	{
		if (!this._playButtonElement) { return; }
		this._playButtonElement.innerHTML = this._icon(this._playing ? 'Pause' : 'Play');
		this._playButtonElement.setAttribute('title', this._playing ? 'Pause' : 'Play');
	}

	_refreshTimeDisplay()
	{
		if (this._currentTimeElement) { this._currentTimeElement.textContent = this._formatTime(this._currentTime); }
		if (this._durationElement) { this._durationElement.textContent = this._formatTime(this._duration); }
	}

	_refreshSeek()
	{
		if (!this._seekElement) { return; }
		const tmpDuration = this._duration || this._readDuration();
		this._seekElement.disabled = !tmpDuration;
		if (this._isElementFocused(this._seekElement)) { return; }
		const tmpValue = tmpDuration ? Math.round((this._currentTime / tmpDuration) * 1000) : 0;
		this._seekElement.value = String(Math.max(0, Math.min(1000, tmpValue)));
	}

	_refreshVolume()
	{
		if (this._muteButtonElement)
		{
			const tmpSilent = this._muted || this._volume <= 0;
			this._muteButtonElement.innerHTML = this._icon(tmpSilent ? 'VolumeMute' : 'VolumeHigh');
			this._muteButtonElement.setAttribute('title', tmpSilent ? 'Unmute' : 'Mute');
		}
		if (this._volumeElement && !this._isElementFocused(this._volumeElement))
		{
			this._volumeElement.value = String(Math.round((this._muted ? 0 : this._volume) * 100));
		}
	}

	_refreshRate()
	{
		if (!this._rateButtonElement) { return; }
		const tmpRate = this._playbackRate || 1;
		const tmpLabel = (Math.round(tmpRate * 100) / 100).toString();
		this._rateButtonElement.innerHTML = tmpLabel + '&times;';
	}

	_refreshDownload()
	{
		if (!this._downloadElement) { return; }
		const tmpHref = this._downloadURL || this._url;
		if (tmpHref)
		{
			this._downloadElement.setAttribute('href', tmpHref);
			if (this._downloadName) { this._downloadElement.setAttribute('download', this._downloadName); }
			this._downloadElement.style.display = 'inline-flex';
		}
		else
		{
			this._downloadElement.style.display = 'none';
		}
	}

	_isElementFocused(pElement)
	{
		return !!(pElement && (typeof document !== 'undefined') && document.activeElement === pElement);
	}

	// -----------------------------------------------------------------------------------------------------------
	// Waveform
	// -----------------------------------------------------------------------------------------------------------

	/**
	 * Draw the precomputed peaks to the canvas: the whole waveform in a muted color, then the played portion (up to
	 * the current time) in the accent color. A no-op when there are no peaks, no canvas, no 2d context (headless),
	 * or the canvas has no measurable width.
	 */
	_renderWaveform()
	{
		if (!this._peaks || !this._peaks.length || !this._waveElement) { return; }

		let tmpContext = null;
		try { tmpContext = (typeof this._waveElement.getContext === 'function') ? this._waveElement.getContext('2d') : null; }
		catch (pError) { tmpContext = null; }   // headless canvases have no 2d context
		if (!tmpContext) { return; }

		const tmpWidth = this._waveElement.clientWidth || this._waveElement.width || 0;
		const tmpHeight = this._waveElement.clientHeight || this._waveElement.height || 0;
		if (!tmpWidth || !tmpHeight) { return; }
		this._waveElement.width = tmpWidth;
		this._waveElement.height = tmpHeight;

		const tmpColors = this._waveformColors();
		const tmpDuration = this._duration || this._readDuration();
		const tmpProgress = tmpDuration ? (this._currentTime / tmpDuration) : 0;
		const tmpPlayedX = tmpProgress * tmpWidth;

		const tmpCount = this._peaks.length;
		const tmpBarWidth = tmpWidth / tmpCount;
		const tmpGap = Math.min(1, tmpBarWidth * 0.2);

		tmpContext.clearRect(0, 0, tmpWidth, tmpHeight);
		for (let i = 0; i < tmpCount; i++)
		{
			let tmpAmplitude = Number(this._peaks[i]);
			if (!isFinite(tmpAmplitude)) { tmpAmplitude = 0; }
			tmpAmplitude = Math.max(0, Math.min(1, tmpAmplitude));
			const tmpBarHeight = Math.max(1, tmpAmplitude * (tmpHeight - 4));
			const tmpX = i * tmpBarWidth;
			const tmpY = (tmpHeight - tmpBarHeight) / 2;
			tmpContext.fillStyle = ((tmpX + tmpBarWidth) <= tmpPlayedX) ? tmpColors.Played : tmpColors.Unplayed;
			tmpContext.fillRect(tmpX, tmpY, Math.max(1, tmpBarWidth - tmpGap), tmpBarHeight);
		}
	}

	/** The played/unplayed waveform colors, read from theme tokens when available (hand-picked fallbacks otherwise). */
	_waveformColors()
	{
		let tmpPlayed = '#5650e6';
		let tmpUnplayed = '#c7cdd8';
		try
		{
			if ((typeof window !== 'undefined') && (typeof window.getComputedStyle === 'function') && this._rootElement)
			{
				const tmpStyle = window.getComputedStyle(this._rootElement);
				const tmpBrand = (tmpStyle.getPropertyValue('--theme-color-brand-primary') || '').trim();
				const tmpMuted = (tmpStyle.getPropertyValue('--theme-color-border-medium') || '').trim();
				if (tmpBrand) { tmpPlayed = tmpBrand; }
				if (tmpMuted) { tmpUnplayed = tmpMuted; }
			}
		}
		catch (pError) { /* fall back to the defaults */ }
		return { Played: tmpPlayed, Unplayed: tmpUnplayed };
	}

	// -----------------------------------------------------------------------------------------------------------
	// Public API
	// -----------------------------------------------------------------------------------------------------------

	/**
	 * Point the player at an audio file. Accepts a URL string or a descriptor object
	 * ({ URL, Title?, Name?, Subtitle?, PosterURL?, Peaks?, DownloadURL?, DownloadName? }). Resets playback.
	 * @param {(string|Object)} pInput
	 */
	setAudio(pInput)
	{
		let tmpURL = '';
		let tmpTitle = this._title;
		let tmpSubtitle = this._subtitle;
		let tmpPoster = '';
		let tmpPeaks = null;
		let tmpDownloadURL = '';
		let tmpDownloadName = '';

		if (typeof pInput === 'string')
		{
			tmpURL = pInput;
		}
		else if (pInput && typeof pInput === 'object')
		{
			tmpURL = pInput.URL || pInput.Url || pInput.AudioURL || '';
			tmpTitle = pInput.Title || pInput.Name || this._title;
			tmpSubtitle = (typeof pInput.Subtitle === 'string') ? pInput.Subtitle : this._subtitle;
			tmpPoster = pInput.PosterURL || pInput.Poster || '';
			tmpPeaks = Array.isArray(pInput.Peaks) ? pInput.Peaks.slice() : null;
			tmpDownloadURL = pInput.DownloadURL || '';
			tmpDownloadName = pInput.DownloadName || pInput.Name || '';
		}

		this._url = tmpURL;
		this._title = tmpTitle || '';
		this._subtitle = tmpSubtitle || '';
		this._posterURL = tmpPoster || '';
		this._downloadURL = tmpDownloadURL || tmpURL;
		this._downloadName = tmpDownloadName || '';

		// A change in whether peaks are present changes the DOM shape (canvas or not), so rebuild on a mismatch.
		const tmpHadPeaks = !!(this._peaks && this._peaks.length);
		const tmpHasPeaks = !!(tmpPeaks && tmpPeaks.length);
		this._peaks = tmpPeaks;

		if (this.targetElement && (tmpHadPeaks !== tmpHasPeaks))
		{
			this._buildPlayerDOM();
		}

		// Refresh the header to the new track, then (re)load.
		this._refreshHeader();
		if (this.targetElement) { this._loadAudio(tmpURL); }
	}

	/** Repaint the artwork + title + subtitle from current state. */
	_refreshHeader()
	{
		if (this._artElement) { this._artElement.innerHTML = this._artHTML(); }
		if (this._titleElement) { this._titleElement.textContent = this._title || 'Audio'; }
		if (this._subtitleElement) { this._subtitleElement.textContent = this._subtitle || ''; }
	}

	play()
	{
		if (!this._audioElement) { return; }
		try
		{
			const tmpResult = this._audioElement.play();
			if (tmpResult && (typeof tmpResult.catch === 'function')) { tmpResult.catch(() => { /* autoplay rejected */ }); }
		}
		catch (pError) { /* headless / unsupported */ }
	}

	pause()
	{
		if (!this._audioElement) { return; }
		try { this._audioElement.pause(); } catch (pError) { /* headless */ }
	}

	togglePlay()
	{
		if (this._playing) { this.pause(); } else { this.play(); }
	}

	seekTo(pSeconds)
	{
		if (!this._audioElement) { return; }
		let tmpSeconds = Number(pSeconds);
		if (!isFinite(tmpSeconds) || tmpSeconds < 0) { tmpSeconds = 0; }
		const tmpDuration = this._duration || this._readDuration();
		if (tmpDuration && tmpSeconds > tmpDuration) { tmpSeconds = tmpDuration; }
		try { this._audioElement.currentTime = tmpSeconds; } catch (pError) { /* headless */ }
		this._currentTime = tmpSeconds;
		this._refreshTimeDisplay();
		this._refreshSeek();
		this._renderWaveform();
	}

	setVolume(pVolume)
	{
		let tmpVolume = Number(pVolume);
		if (!isFinite(tmpVolume)) { tmpVolume = 0; }
		tmpVolume = Math.min(1, Math.max(0, tmpVolume));
		this._volume = tmpVolume;
		if (this._audioElement)
		{
			try { this._audioElement.volume = tmpVolume; } catch (pError) { /* headless */ }
			this._audioElement.muted = (tmpVolume <= 0);
		}
		this._muted = (tmpVolume <= 0);
		this._refreshVolume();
	}

	toggleMute()
	{
		this._muted = !this._muted;
		if (this._audioElement) { this._audioElement.muted = this._muted; }
		this._refreshVolume();
	}

	cyclePlaybackRate()
	{
		if (!this._playbackRates.length) { return; }
		let tmpIndex = this._playbackRates.indexOf(this._playbackRate);
		tmpIndex = (tmpIndex + 1) % this._playbackRates.length;
		this.setPlaybackRate(this._playbackRates[tmpIndex]);
	}

	setPlaybackRate(pRate)
	{
		let tmpRate = Number(pRate);
		if (!isFinite(tmpRate) || tmpRate <= 0) { tmpRate = 1; }
		this._playbackRate = tmpRate;
		if (this._audioElement) { try { this._audioElement.playbackRate = tmpRate; } catch (pError) { /* headless */ } }
		this._refreshRate();
	}

	/** Register the player glyphs in the icon registry (idempotent; no-op without an Icon provider). */
	_ensureIcons()
	{
		if (!this.pict || !this.pict.providers || !this.pict.providers.Icon || (typeof this.pict.providers.Icon.registerSet !== 'function')) { return; }
		this.pict.providers.Icon.registerSet(
		{
			Outline:
			{
				Play: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z"/></svg>',
				Pause: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
				VolumeHigh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8a5 5 0 0 1 0 8M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
				VolumeMute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>',
				MusicNote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>'
			}
		});
	}

	/** A snapshot of the player's current state (handy for hosts and tests). */
	getState()
	{
		return (
		{
			URL: this._url,
			Title: this._title,
			Loaded: this._loaded,
			Error: this._error,
			Playing: this._playing,
			Duration: this._duration,
			CurrentTime: this._currentTime,
			Muted: this._muted,
			Volume: this._volume,
			PlaybackRate: this._playbackRate,
			HasWaveform: !!(this._peaks && this._peaks.length)
		});
	}

	/** Tear down handlers and clear the player. */
	destroy()
	{
		if (this._audioElement)
		{
			try { this._audioElement.pause(); } catch (pError) { /* ok */ }
			this._audioElement.onloadedmetadata = null;
			this._audioElement.ontimeupdate = null;
			this._audioElement.onplay = null;
			this._audioElement.onpause = null;
			this._audioElement.onended = null;
			this._audioElement.onvolumechange = null;
			this._audioElement.onratechange = null;
			this._audioElement.onerror = null;
			this._audioElement.removeAttribute('src');
			try { if (typeof this._audioElement.load === 'function') { this._audioElement.load(); } } catch (pError) { /* ok */ }
		}
		if (this._playButtonElement) { this._playButtonElement.onclick = null; }
		if (this._muteButtonElement) { this._muteButtonElement.onclick = null; }
		if (this._rateButtonElement) { this._rateButtonElement.onclick = null; }
		if (this._seekElement) { this._seekElement.oninput = null; }
		if (this._volumeElement) { this._volumeElement.oninput = null; }
		if (this._waveElement) { this._waveElement.onclick = null; }

		if (this.targetElement && this.pict && this.pict.ContentAssignment)
		{
			this.pict.ContentAssignment.assignContent(this.options.TargetElementAddress, '');
		}
		this._rootElement = null;
		this._audioElement = null;
		this._artElement = null;
		this._titleElement = null;
		this._subtitleElement = null;
		this._waveElement = null;
		this._controlsElement = null;
		this._playButtonElement = null;
		this._seekElement = null;
		this._currentTimeElement = null;
		this._durationElement = null;
		this._muteButtonElement = null;
		this._volumeElement = null;
		this._rateButtonElement = null;
		this._downloadElement = null;
	}

	// -----------------------------------------------------------------------------------------------------------
	// Small utilities
	// -----------------------------------------------------------------------------------------------------------

	/** A themable glyph from the icon registry; '' when no registry is present. */
	_icon(pName)
	{
		if (!this.pict || (typeof this.pict.icon !== 'function')) { return ''; }
		try { return this.pict.icon(pName); }
		catch (pError) { return ''; }
	}

	/** Format seconds as m:ss (or h:mm:ss past an hour); '0:00' for an unknown/zero duration. */
	_formatTime(pSeconds)
	{
		let tmpSeconds = Number(pSeconds);
		if (!isFinite(tmpSeconds) || tmpSeconds < 0) { tmpSeconds = 0; }
		tmpSeconds = Math.floor(tmpSeconds);
		const tmpHours = Math.floor(tmpSeconds / 3600);
		const tmpMinutes = Math.floor((tmpSeconds % 3600) / 60);
		const tmpSecs = tmpSeconds % 60;
		const tmpPad = function (pValue) { return (pValue < 10) ? ('0' + pValue) : String(pValue); };
		if (tmpHours > 0) { return tmpHours + ':' + tmpPad(tmpMinutes) + ':' + tmpPad(tmpSecs); }
		return tmpMinutes + ':' + tmpPad(tmpSecs);
	}

	/** Escape HTML metacharacters for safe interpolation into built markup. */
	_esc(pText)
	{
		if (pText === null || typeof pText === 'undefined') { return ''; }
		return String(pText)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}
}

module.exports = PictSectionAudio;

module.exports.default_configuration = _DefaultConfiguration;
