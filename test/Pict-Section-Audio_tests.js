/*
	Unit tests for Pict-Section-Audio

	Run against a real jsdom document (browser-env). jsdom has no media pipeline, so the media methods are stubbed
	to quiet no-ops at the prototype and the media events are simulated by invoking the element-property handlers
	directly. The peaks waveform draws to a <canvas> whose 2d context jsdom does not implement, so the renderer
	guards getContext and a zero-size canvas — the test asserts it does not throw rather than inspecting pixels.
*/

const libBrowserEnv = require('browser-env');
libBrowserEnv();

// jsdom does not implement the media pipeline; make play/pause/load quiet no-ops so the tests emit no jsdom noise.
if ((typeof window !== 'undefined') && window.HTMLMediaElement)
{
	window.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
	window.HTMLMediaElement.prototype.pause = function () {};
	window.HTMLMediaElement.prototype.load = function () {};
}

const Chai = require('chai');
const Expect = Chai.expect;

const libPict = require('pict');
const libPictSectionAudio = require('../source/Pict-Section-Audio.js');

let _HostSerial = 0;

/** Stand up a pict app with a real host div and a mounted audio view. Returns { pict, view, hostId, viewHash }. */
function buildView(pConfigOverrides)
{
	const tmpHostId = 'AudioHost' + (++_HostSerial);
	const tmpHost = document.createElement('div');
	tmpHost.id = tmpHostId;
	document.body.appendChild(tmpHost);

	const tmpPict = new libPict();
	const tmpViewHash = 'TestAudio' + _HostSerial;

	const tmpConfig = Object.assign({}, libPictSectionAudio.default_configuration,
	{
		RenderOnLoad: false,
		DefaultDestinationAddress: '#' + tmpHostId,
		TargetElementAddress: '#' + tmpHostId,
		Renderables: [ { RenderableHash: 'AudioPlayer-Wrap', TemplateHash: 'AudioPlayer-Container', DestinationAddress: '#' + tmpHostId } ]
	}, pConfigOverrides || {});

	tmpPict.addView(tmpViewHash, tmpConfig, libPictSectionAudio);
	const tmpView = tmpPict.views[tmpViewHash];
	tmpView.render();

	return { pict: tmpPict, view: tmpView, hostId: tmpHostId, viewHash: tmpViewHash };
}

function simulateMetadata(pView, pDuration)
{
	Object.defineProperty(pView._audioElement, 'duration', { configurable: true, value: pDuration });
	if (typeof pView._audioElement.onloadedmetadata === 'function') { pView._audioElement.onloadedmetadata(); }
}

function simulateTimeUpdate(pView, pCurrentTime)
{
	Object.defineProperty(pView._audioElement, 'currentTime', { configurable: true, get: function () { return pCurrentTime; } });
	if (typeof pView._audioElement.ontimeupdate === 'function') { pView._audioElement.ontimeupdate(); }
}

suite
(
	'PictSectionAudio',
	() =>
	{
		suite
		(
			'Module Exports',
			() =>
			{
				test('Main class should be exported', (fDone) =>
				{
					Expect(libPictSectionAudio).to.be.a('function');
					return fDone();
				});
				test('Default configuration should be exported with the player keys', (fDone) =>
				{
					const tmpConfiguration = libPictSectionAudio.default_configuration;
					Expect(tmpConfiguration).to.be.an('object');
					Expect(tmpConfiguration).to.have.property('DefaultRenderable');
					Expect(tmpConfiguration).to.have.property('TargetElementAddress');
					Expect(tmpConfiguration).to.have.property('PlaybackRates');
					Expect(tmpConfiguration).to.have.property('CSS');
					return fDone();
				});
			}
		);

		suite
		(
			'Rendering the chrome',
			() =>
			{
				test('builds the <audio>, the header and the control bar', (fDone) =>
				{
					const tmpHarness = buildView();
					const tmpAudio = document.getElementById(tmpHarness.viewHash + '-Audio');
					Expect(tmpAudio).to.not.equal(null);
					Expect(tmpAudio.tagName.toLowerCase()).to.equal('audio');
					Expect(document.getElementById(tmpHarness.viewHash + '-Header')).to.not.equal(null);
					Expect(document.getElementById(tmpHarness.viewHash + '-Controls')).to.not.equal(null);
					Expect(document.getElementById(tmpHarness.viewHash + '-PlayBtn')).to.not.equal(null);
					Expect(document.getElementById(tmpHarness.viewHash + '-Seek')).to.not.equal(null);
					return fDone();
				});
				test('omits the header when ShowArtwork is false', (fDone) =>
				{
					const tmpHarness = buildView({ ShowArtwork: false });
					Expect(document.getElementById(tmpHarness.viewHash + '-Header')).to.equal(null);
					Expect(document.getElementById(tmpHarness.viewHash + '-Controls')).to.not.equal(null);
					return fDone();
				});
				test('shows the title in the header', (fDone) =>
				{
					const tmpHarness = buildView({ Title: 'Interlude', Subtitle: 'Demo' });
					Expect(document.getElementById(tmpHarness.viewHash + '-Title').textContent).to.equal('Interlude');
					Expect(document.getElementById(tmpHarness.viewHash + '-Sub').textContent).to.equal('Demo');
					return fDone();
				});
				test('renders a waveform canvas only when peaks are present', (fDone) =>
				{
					// Opt out of client-side peaks: with none supplied and ComputePeaks:false there is no canvas.
					const tmpWithout = buildView({ ComputePeaks: false });
					Expect(document.getElementById(tmpWithout.viewHash + '-Wave')).to.equal(null);
					// Default (ComputePeaks on) with no peaks yet: the canvas exists but starts hidden until computed.
					const tmpPending = buildView();
					const tmpPendingCanvas = document.getElementById(tmpPending.viewHash + '-Wave');
					Expect(tmpPendingCanvas).to.not.equal(null);
					Expect(tmpPendingCanvas.style.display).to.equal('none');
					Expect(tmpPending.view.getState().HasWaveform).to.equal(false);
					const tmpWith = buildView({ Peaks: [ 0.1, 0.5, 0.9, 0.3 ] });
					Expect(document.getElementById(tmpWith.viewHash + '-Wave')).to.not.equal(null);
					Expect(tmpWith.view.getState().HasWaveform).to.equal(true);
					return fDone();
				});
				test('a re-render self-heals the player DOM after the stub template re-stamps', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.pict.ContentAssignment.assignContent('#' + tmpHarness.hostId, '<!-- stub -->');
					Expect(document.getElementById(tmpHarness.viewHash + '-Controls')).to.equal(null);
					tmpHarness.view.render();
					Expect(document.getElementById(tmpHarness.viewHash + '-Controls')).to.not.equal(null);
					return fDone();
				});
			}
		);

		suite
		(
			'Loading audio',
			() =>
			{
				test('setAudio assigns the src', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setAudio('https://host/song.mp3');
					Expect(tmpHarness.view._audioElement.getAttribute('src')).to.equal('https://host/song.mp3');
					Expect(tmpHarness.view.getState().Loaded).to.equal(false);
					return fDone();
				});
				test('seeds the initial audio from config', (fDone) =>
				{
					const tmpHarness = buildView({ AudioURL: 'https://host/seed.mp3' });
					Expect(tmpHarness.view._audioElement.getAttribute('src')).to.equal('https://host/seed.mp3');
					return fDone();
				});
				test('on loadedmetadata the duration shows and the scrubber enables', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setAudio('https://host/song.mp3');
					simulateMetadata(tmpHarness.view, 184);   // 3:04
					Expect(tmpHarness.view.getState().Loaded).to.equal(true);
					Expect(tmpHarness.view.getState().Duration).to.equal(184);
					Expect(tmpHarness.view._durationElement.textContent).to.equal('3:04');
					Expect(tmpHarness.view._seekElement.disabled).to.equal(false);
					return fDone();
				});
				test('timeupdate advances the readout and the scrubber', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setAudio('https://host/song.mp3');
					simulateMetadata(tmpHarness.view, 100);
					simulateTimeUpdate(tmpHarness.view, 25);
					Expect(tmpHarness.view.getState().CurrentTime).to.equal(25);
					Expect(tmpHarness.view._currentTimeElement.textContent).to.equal('0:25');
					Expect(tmpHarness.view._seekElement.value).to.equal('250');
					return fDone();
				});
				test('reveals the download affordance once a URL is set', (fDone) =>
				{
					const tmpHarness = buildView();
					Expect(tmpHarness.view._downloadElement.style.display).to.equal('none');
					tmpHarness.view.setAudio('https://host/song.mp3');
					Expect(tmpHarness.view._downloadElement.style.display).to.equal('inline-flex');
					return fDone();
				});
				test('a timeupdate with a peaks waveform redraws without throwing (headless canvas)', (fDone) =>
				{
					const tmpHarness = buildView({ Peaks: [ 0.2, 0.8, 0.4, 0.95, 0.1 ] });
					tmpHarness.view.setAudio('https://host/song.mp3');
					simulateMetadata(tmpHarness.view, 60);
					simulateTimeUpdate(tmpHarness.view, 30);
					Expect(tmpHarness.view.getState().CurrentTime).to.equal(30);
					return fDone();
				});
			}
		);

		suite
		(
			'Playback controls',
			() =>
			{
				test('togglePlay drives the media element and the glyph tracks the media events', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setAudio('https://host/song.mp3');
					const tmpCalls = { play: 0, pause: 0 };
					tmpHarness.view._audioElement.play = function () { tmpCalls.play++; return Promise.resolve(); };
					tmpHarness.view._audioElement.pause = function () { tmpCalls.pause++; };

					tmpHarness.view.togglePlay();
					Expect(tmpCalls.play).to.equal(1);
					tmpHarness.view._audioElement.onplay();
					Expect(tmpHarness.view.getState().Playing).to.equal(true);

					tmpHarness.view.togglePlay();
					Expect(tmpCalls.pause).to.equal(1);
					tmpHarness.view._audioElement.onpause();
					Expect(tmpHarness.view.getState().Playing).to.equal(false);
					return fDone();
				});
				test('the seek slider maps its position onto an absolute time', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setAudio('https://host/song.mp3');
					simulateMetadata(tmpHarness.view, 240);
					tmpHarness.view._seekElement.value = '250';
					tmpHarness.view._seekElement.oninput();   // 250/1000 * 240 = 60s
					Expect(tmpHarness.view.getState().CurrentTime).to.equal(60);
					return fDone();
				});
				test('toggleMute and setVolume drive the element', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setAudio('https://host/song.mp3');
					tmpHarness.view.toggleMute();
					Expect(tmpHarness.view._audioElement.muted).to.equal(true);
					tmpHarness.view.setVolume(0.25);
					Expect(tmpHarness.view._audioElement.volume).to.equal(0.25);
					Expect(tmpHarness.view.getState().Volume).to.equal(0.25);
					tmpHarness.view.setVolume(0);
					Expect(tmpHarness.view.getState().Muted).to.equal(true);
					return fDone();
				});
				test('cyclePlaybackRate steps through the configured rates and sets the element', (fDone) =>
				{
					const tmpHarness = buildView({ PlaybackRates: [ 1, 1.5, 2 ] });
					tmpHarness.view.setAudio('https://host/song.mp3');
					tmpHarness.view.cyclePlaybackRate();   // 1 → 1.5
					Expect(tmpHarness.view.getState().PlaybackRate).to.equal(1.5);
					Expect(tmpHarness.view._audioElement.playbackRate).to.equal(1.5);
					return fDone();
				});
			}
		);

		suite
		(
			'Error handling + lifecycle',
			() =>
			{
				test('a media error paints the error state', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setAudio('https://host/missing.mp3');
					tmpHarness.view._audioElement.onerror();
					Expect(tmpHarness.view.getState().Error).to.equal(true);
					const tmpRoot = document.getElementById(tmpHarness.viewHash + '-Root');
					Expect(tmpRoot.querySelector('.psa-error')).to.not.equal(null);
					return fDone();
				});
				test('setAudio after an error rebuilds a fresh <audio> and recovers', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setAudio('https://host/missing.mp3');
					tmpHarness.view._audioElement.onerror();
					Expect(tmpHarness.view.getState().Error).to.equal(true);

					tmpHarness.view.setAudio('https://host/good.mp3');
					Expect(tmpHarness.view._audioElement).to.not.equal(null);
					Expect(tmpHarness.view._audioElement.getAttribute('src')).to.equal('https://host/good.mp3');
					simulateMetadata(tmpHarness.view, 10);
					Expect(tmpHarness.view.getState().Error).to.equal(false);
					Expect(tmpHarness.view.getState().Loaded).to.equal(true);
					return fDone();
				});
				test('setAudio accepts a descriptor (URL, Title, Subtitle, PosterURL)', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setAudio({ URL: 'https://host/track.mp3', Title: 'Track One', Subtitle: 'The Album', PosterURL: 'https://host/cover.jpg', Name: 'track.mp3' });
					Expect(tmpHarness.view._audioElement.getAttribute('src')).to.equal('https://host/track.mp3');
					Expect(document.getElementById(tmpHarness.viewHash + '-Title').textContent).to.equal('Track One');
					Expect(document.getElementById(tmpHarness.viewHash + '-Sub').textContent).to.equal('The Album');
					const tmpArt = document.getElementById(tmpHarness.viewHash + '-Art');
					Expect(tmpArt.querySelector('img')).to.not.equal(null);
					Expect(tmpArt.querySelector('img').getAttribute('src')).to.equal('https://host/cover.jpg');
					return fDone();
				});
				test('setAudio toggling peaks on rebuilds with a waveform canvas', (fDone) =>
				{
					const tmpHarness = buildView({ ComputePeaks: false });
					Expect(document.getElementById(tmpHarness.viewHash + '-Wave')).to.equal(null);
					tmpHarness.view.setAudio({ URL: 'https://host/track.mp3', Peaks: [ 0.3, 0.7, 0.2 ] });
					Expect(document.getElementById(tmpHarness.viewHash + '-Wave')).to.not.equal(null);
					Expect(tmpHarness.view.getState().HasWaveform).to.equal(true);
					return fDone();
				});
				test('destroy clears the player and detaches handlers', (fDone) =>
				{
					const tmpHarness = buildView();
					tmpHarness.view.setAudio('https://host/song.mp3');
					tmpHarness.view.destroy();
					Expect(tmpHarness.view._audioElement).to.equal(null);
					Expect(document.getElementById(tmpHarness.viewHash + '-Controls')).to.equal(null);
					return fDone();
				});
				test('two instances on one page do not collide (distinct ids)', (fDone) =>
				{
					const tmpA = buildView();
					const tmpB = buildView();
					Expect(tmpA.viewHash).to.not.equal(tmpB.viewHash);
					tmpA.view.setAudio('https://host/a.mp3');
					tmpB.view.setAudio('https://host/b.mp3');
					Expect(tmpA.view._audioElement.getAttribute('src')).to.equal('https://host/a.mp3');
					Expect(tmpB.view._audioElement.getAttribute('src')).to.equal('https://host/b.mp3');
					return fDone();
				});
			}
		);
	}
);
