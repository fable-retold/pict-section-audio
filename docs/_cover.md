# Pict Section Audio

> Bespoke audio player section for Pict — titled, optional waveform, full transport.

- **Titled player** — cover art (or a music glyph), title and subtitle header
- **Optional peaks waveform** — a precomputed `0..1` waveform you can click to seek
- **Full transport** — play/pause, a seek scrubber, time readouts, mute + volume, a playback-rate cycle, download
- **Scrubs over native HTTP Range** — seeking jumps without downloading the whole track
- **Self-contained** — one `pict-view`, built-once imperative `<audio>`; multiple players coexist on a page
- **Embeddable** — standalone, or the audio lens inside `pict-section-fileview`

[Overview](README.md)
[Configuration](configuration.md)
[Architecture](architecture.md)
[GitHub](https://github.com/fable-retold/pict-section-audio)

<!-- docuserve:examples:start -->
| Example | Complexity | Launch |
|---------|------------|--------|
| [Audio Player](examples/audio%5Fplayer/README.md) | Basic | [Launch](examples/audio%5Fplayer/index.html) |
<!-- docuserve:examples:end -->
