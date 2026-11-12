module.exports = (
{
	"RenderOnLoad": true,

	"DefaultRenderable": "AudioPlayer-Wrap",
	"DefaultDestinationAddress": "#AudioPlayer-Container-Div",

	"Templates":
	[
		{
			"Hash": "AudioPlayer-Container",
			// A stub — the player DOM is built imperatively in onAfterInitialRender (an <audio> element and its
			// load/timeupdate/play/pause events, plus the peaks <canvas>, have no template equivalent). Mirrors
			// pict-section-image / pict-section-video.
			"Template": "<!-- AudioPlayer-Container rendering soon -->"
		}
	],

	"Renderables":
	[
		{
			"RenderableHash": "AudioPlayer-Wrap",
			"TemplateHash": "AudioPlayer-Container",
			"DestinationAddress": "#AudioPlayer-Container-Div"
		}
	],

	// The element the player DOM is built into (defaults to the same div the stub renders into).
	"TargetElementAddress": "#AudioPlayer-Container-Div",

	// The initial audio: a URL string, or false for an empty player until setAudio() is called.
	"AudioURL": false,
	// Optional cover art (an image URL) shown in the player header.
	"PosterURL": false,
	// A human title shown in the header and used as the download filename hint.
	"Title": "",
	// An optional secondary line under the title (artist, album, MIME/size, …).
	"Subtitle": "",
	// An optional precomputed waveform: an array of 0..1 amplitude samples. When present, a waveform is drawn and
	// a click on it seeks. Absent ⇒ computed client-side (ComputePeaks) or just the slider scrubber.
	"Peaks": false,
	// When no precomputed Peaks are supplied, decode the track in the browser (Web Audio) and draw a waveform from
	// it. Best-effort: a fetch/HTTP failure, an oversized file, no AudioContext, or a codec the browser's decoder
	// rejects all leave the slider-only chrome with no waveform (playback is never affected). Set false to opt out.
	"ComputePeaks": true,
	// How many amplitude bars to downsample a decoded track to for the client-side waveform.
	"PeakBuckets": 400,
	// Skip client-side peak computation for files larger than this (bytes) — decoding a huge track in the browser is
	// slow and memory-heavy; those keep the slider-only chrome (or a host/rendition-service-supplied Peaks array).
	"MaxPeaksBytes": 48000000,
	// An explicit download href + filename hint. DownloadURL defaults to AudioURL.
	"DownloadURL": false,
	"DownloadName": "",

	// Playback toggles (mapped straight onto the <audio> element).
	"AutoPlay": false,
	"Loop": false,
	"Muted": false,
	"Preload": "metadata",

	// Chrome + behavior toggles.
	"ShowToolbar": true,       // the bespoke control bar (play / seek / time / volume / rate / download)
	"ShowDownload": true,      // the download affordance in the control bar
	"ShowArtwork": true,       // the header (cover art / icon + title)

	// The playback-rate cycle the rate button steps through (1x is the resting value).
	"PlaybackRates": [ 0.5, 1, 1.25, 1.5, 2 ],
	// Initial volume (0..1).
	"Volume": 1,

	"CSS": `.psa-root
{
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 0.9rem;
	min-height: 0;
	height: 100%;
	width: 100%;
	box-sizing: border-box;
	padding: 1.1rem 1.25rem;
	background: var(--theme-color-background-panel, #ffffff);
	color: var(--theme-color-text-primary, #1f2733);
}
.psa-header { display: flex; align-items: center; gap: 0.9rem; min-width: 0; }
.psa-art
{
	flex: 0 0 auto;
	width: 56px;
	height: 56px;
	border-radius: 10px;
	overflow: hidden;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 1.7rem;
	color: var(--theme-color-brand-primary, #5650e6);
	background: var(--theme-color-background-secondary, #f2f4f8);
}
.psa-art img { width: 100%; height: 100%; object-fit: cover; display: block; }
.psa-meta { min-width: 0; flex: 1 1 auto; }
.psa-title { font-size: 1rem; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.psa-sub { font-size: 0.78rem; color: var(--theme-color-text-muted, #6b7686); margin-top: 0.15rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.psa-wave { display: block; width: 100%; height: 60px; cursor: pointer; border-radius: 6px; background: var(--theme-color-background-secondary, #f2f4f8); }
.psa-audio { display: none; }
.psa-controls
{
	display: flex;
	align-items: center;
	gap: 0.5rem;
}
.psa-spacer { flex: 1 1 auto; }
.psa-btn
{
	font-size: 0.8rem;
	font-weight: 600;
	padding: 0.3rem 0.5rem;
	min-width: 2rem;
	border-radius: 6px;
	border: 1px solid var(--theme-color-border-medium, #d5dbe3);
	background: var(--theme-color-background-panel, #ffffff);
	color: var(--theme-color-text-secondary, #45505f);
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0.3rem;
	text-decoration: none;
	line-height: 1;
}
.psa-btn:hover { border-color: var(--theme-color-brand-primary, #5650e6); color: var(--theme-color-text-primary, #1f2733); text-decoration: none; }
.psa-btn[disabled] { opacity: 0.45; cursor: default; }
.psa-rate { font-variant-numeric: tabular-nums; min-width: 2.6rem; }
.psa-time { font-size: 0.74rem; color: var(--theme-color-text-muted, #6b7686); font-variant-numeric: tabular-nums; min-width: 2.8rem; text-align: center; user-select: none; }
.psa-seek { flex: 1 1 auto; min-width: 4rem; accent-color: var(--theme-color-brand-primary, #5650e6); cursor: pointer; }
.psa-volume { width: 4.5rem; flex: 0 0 auto; accent-color: var(--theme-color-brand-primary, #5650e6); cursor: pointer; }
.psa-error { text-align: center; color: var(--theme-color-text-muted, #8a94a3); padding: 1.2rem; display: flex; flex-direction: column; align-items: center; gap: 0.55rem; }
`
});
