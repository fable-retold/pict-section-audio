# Configuration

```javascript
const libPictSectionAudio = require('pict-section-audio');

pict.addView('MyAudio', Object.assign({}, libPictSectionAudio.default_configuration,
    {
        DefaultDestinationAddress: '#SomeDiv',
        TargetElementAddress:      '#SomeDiv',
        AudioURL:                  'https://host/song.mp3'
    }), libPictSectionAudio);

pict.views.MyAudio.render();
pict.views.MyAudio.setAudio({
    URL:       'https://host/track.mp3',
    Title:     'Track One',
    Subtitle:  'The Album',
    PosterURL: 'https://host/cover.jpg',
    Peaks:     [ 0.1, 0.4, 0.9, 0.6, 0.2 /* … 0..1 amplitudes … */ ]
});
```

## Options

| Key | Default | Meaning |
|---|---|---|
| `AudioURL` | `false` | Initial audio URL (or `false` for an empty player until `setAudio()`). |
| `PosterURL` | `false` | Optional cover art (an image URL) shown in the header. |
| `Title` / `Subtitle` | `''` | Header title and an optional second line (artist, album, type…). |
| `Peaks` | `false` | An array of `0..1` amplitude samples — draws a waveform you can click to seek. |
| `DownloadURL` / `DownloadName` | `false` / `''` | Explicit download href + filename hint (`DownloadURL` defaults to the audio URL). |
| `AutoPlay` / `Loop` / `Muted` | `false` | Mapped straight onto the `<audio>` element. |
| `Preload` | `'metadata'` | `'metadata'`, `'none'`, or `'auto'`. |
| `ShowToolbar` | `true` | Render the control bar. |
| `ShowDownload` | `true` | Show the download affordance. Set `false` when a host owns it. |
| `ShowArtwork` | `true` | Render the cover-art / title header. |
| `PlaybackRates` | `[0.5, 1, 1.25, 1.5, 2]` | The rate cycle the speed button steps through. |
| `Volume` | `1` | Initial volume `0..1`. |
| `TargetElementAddress`, `DefaultDestinationAddress`, `RenderOnLoad` | — | Standard `pict-view` placement. |

## Public API

| Method | Does |
|---|---|
| `setAudio(urlOrDescriptor)` | Point the player at a track (`{ URL, Title?, Name?, Subtitle?, PosterURL?, Peaks?, DownloadURL?, DownloadName? }`). A change in whether `Peaks` are present rebuilds the player. |
| `play()` / `pause()` / `togglePlay()` | Playback control. |
| `seekTo(seconds)` | Seek to an absolute time (clamped to the duration). |
| `setVolume(0..1)` / `toggleMute()` | Volume control. |
| `setPlaybackRate(rate)` / `cyclePlaybackRate()` | Playback speed. |
| `getState()` | `{ URL, Title, Loaded, Error, Playing, Duration, CurrentTime, Muted, Volume, PlaybackRate, HasWaveform }`. |
| `destroy()` | Detach handlers and clear the player. |

## Formats

The player hands the URL straight to an `<audio>` element, so it plays whatever the host browser plays — MP3,
M4A/AAC, Ogg/Opus, WAV, and FLAC. A format a browser cannot decode (WMA, AIFF, …) is the host's problem to
transcode; inside [`pict-section-fileview`](https://fable-retold.github.io/pict-section-fileview/) such a file
degrades to the download card.

## Styling

All styling is the `.psa-*` CSS family, wired through `pict-provider-theme` tokens (`var(--theme-color-*,
fallback)`) and registered through the Pict CSS cascade. Append per-instance overrides via `CSSExtra`.
