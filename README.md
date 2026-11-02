# pict-section-audio

A bespoke **audio player** section for the Retold/Pict ecosystem. Point it at an audio URL and it shows a titled
player — cover art (or a music glyph), an optional precomputed waveform, and a control bar (play/pause, a seek
scrubber, a time readout, mute + volume, a playback-rate cycle, and download). Seeking rides the browser's native
HTTP **Range** requests, so a range-served file (an
[`orator-file-service`](https://github.com/fable-retold/orator-file-service) route, a Sluice depot, a bare 206 URL)
scrubs without downloading the whole track.

It is a single [`pict-view`](https://github.com/fable-retold/pict-view) in the lightweight single-view shape
(like `pict-section-image` / `pict-section-video`): a stub container template, with the player DOM built
imperatively — an `<audio>` element, its media events, and the peaks `<canvas>` have no template equivalent.

Usable on its own, or driven as the audio renderer inside
[`pict-section-fileview`](https://github.com/fable-retold/pict-section-fileview).

## Install

```bash
npm install pict-section-audio
```

The only hard dependency is `pict-view`.

## Usage

```javascript
const libPictSectionAudio = require('pict-section-audio');

pict.addView('MyAudio', Object.assign({}, libPictSectionAudio.default_configuration,
    {
        DefaultDestinationAddress: '#SomeDiv',
        TargetElementAddress:      '#SomeDiv',
        AudioURL:                  'https://host/song.mp3'
    }), libPictSectionAudio);

pict.views.MyAudio.render();

// …or point it at a track later (with cover art + an optional waveform):
pict.views.MyAudio.setAudio({
    URL:       'https://host/track.mp3',
    Title:     'Track One',
    Subtitle:  'The Album',
    PosterURL: 'https://host/cover.jpg',
    Peaks:     [ 0.1, 0.4, 0.9, 0.6, 0.2, /* … 0..1 amplitudes … */ ]
});
```

### Configuration

| Key | Meaning |
|---|---|
| `AudioURL` | Initial audio URL (or `false` for an empty player until `setAudio()`). |
| `PosterURL` | Optional cover art (an image URL) shown in the header. |
| `Title` / `Subtitle` | The header title and an optional second line (artist, album, type…). |
| `Peaks` | An optional array of `0..1` amplitude samples — draws a waveform you can click to seek. |
| `DownloadURL` / `DownloadName` | Explicit download href + filename hint (`DownloadURL` defaults to the audio URL). |
| `AutoPlay` / `Loop` / `Muted` | Mapped onto the `<audio>` element (defaults off). |
| `Preload` | `'metadata'` (default), `'none'`, or `'auto'`. |
| `ShowToolbar` | Render the control bar (default on). |
| `ShowDownload` | Show the download affordance in the control bar (default on). Set `false` when a host owns it. |
| `ShowArtwork` | Render the cover-art / title header (default on). |
| `PlaybackRates` | The rate cycle the speed button steps through (default `[0.5, 1, 1.25, 1.5, 2]`). |
| `Volume` | Initial volume `0..1` (default `1`). |
| `TargetElementAddress`, `DefaultDestinationAddress`, `RenderOnLoad` | Standard pict-view placement. |

### Public API

| Method | Does |
|---|---|
| `setAudio(urlOrDescriptor)` | Point the player at a track; resets playback. A change in whether `Peaks` are present rebuilds the player (canvas or not). |
| `play()` / `pause()` / `togglePlay()` | Playback control. |
| `seekTo(seconds)` | Seek to an absolute time (clamped to the duration). |
| `setVolume(0..1)` / `toggleMute()` | Volume control. |
| `setPlaybackRate(rate)` / `cyclePlaybackRate()` | Playback speed. |
| `getState()` | `{ URL, Title, Loaded, Error, Playing, Duration, CurrentTime, Muted, Volume, PlaybackRate, HasWaveform }`. |
| `destroy()` | Detach handlers and clear the player. |

### Waveform

When a descriptor carries a `Peaks` array (precomputed `0..1` amplitude samples — produced server-side alongside
the file, e.g. by a rendition service), the player draws a waveform behind the transport and tints the played
portion in the accent color; a click on it seeks. Without peaks, the slider scrubber is the whole seek surface.
The colors are read from `pict-provider-theme` tokens when present, with hand-picked fallbacks otherwise.

### Formats

The player hands the URL straight to an `<audio>` element, so it plays whatever the host browser plays — MP3, M4A/AAC,
Ogg/Opus, WAV and FLAC. A format a browser cannot decode (WMA, AIFF, …) is the host's problem to transcode; inside
`pict-section-fileview` such a file degrades to the download card.

## Examples

`example_applications/audio_player` is a runnable demo: standalone players — one with cover art, one with a
precomputed waveform — independent on one page.

```bash
cd example_applications/audio_player && npm run build   # build the example's browser bundle
npm run example-serve   # (from the module root) serve at http://localhost:<port>/audio_player/dist/index.html
```

## Development

```bash
npm test        # Mocha TDD via quackage (real jsdom document)
npm run build   # browser bundle via quackage
```

MIT © Steven Velozo
