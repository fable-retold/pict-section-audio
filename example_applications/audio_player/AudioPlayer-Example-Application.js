const libPictApplication = require('pict-application');

// The standalone audio section — used here directly (no pict-section-fileview), with its own titled header + control
// bar. This is the same class fileview mounts as its audio lens; on its own it is a complete player.
const libPictSectionAudio = require('../../source/Pict-Section-Audio.js');

// A deterministic, decorative peaks array (0..1 amplitudes) for the waveform player. In production these are
// precomputed server-side alongside the file; here we synthesize a pleasant shape so the demo needs no analysis.
function buildPeaks(pCount)
{
	const tmpPeaks = [];
	for (let i = 0; i < pCount; i++)
	{
		const tmpBase = 0.5 + 0.4 * Math.sin(i / 3);
		const tmpRipple = 0.1 * Math.sin(i / 1.3);
		let tmpValue = tmpBase + tmpRipple;
		if (tmpValue < 0.05) { tmpValue = 0.05; }
		if (tmpValue > 1) { tmpValue = 1; }
		tmpPeaks.push(Math.round(tmpValue * 100) / 100);
	}
	return tmpPeaks;
}

// Each player: a distinct ViewIdentifier + the div it builds into + the track it opens. The default configuration
// points every element id at #AudioPlayer-Container-Div, so each instance overrides the renderable/destination/
// target to its own div — that is what lets two players coexist on one page (ids derive from the instance).
function buildPlayerConfig(pIdentifier, pDestination, pOverrides)
{
	return Object.assign({}, libPictSectionAudio.default_configuration,
	{
		"ViewIdentifier": pIdentifier,
		"RenderOnLoad": false,
		"DefaultRenderable": pIdentifier + '-Wrap',
		"DefaultDestinationAddress": pDestination,
		"TargetElementAddress": pDestination,
		"Templates": [ { "Hash": pIdentifier + '-Container', "Template": '<!-- audio player host -->' } ],
		"Renderables": [ { "RenderableHash": pIdentifier + '-Wrap', "TemplateHash": pIdentifier + '-Container', "DestinationAddress": pDestination, "RenderMethod": 'replace' } ]
	}, pOverrides || {});
}

const _Players =
[
	{
		Identifier: 'AudCover', Destination: '#Aud-Cover',
		Config: { AudioURL: './sample.mp3', Title: 'Sample Tone', Subtitle: 'With cover art', PosterURL: './cover.jpg', DownloadName: 'sample.mp3' }
	},
	{
		Identifier: 'AudWave', Destination: '#Aud-Wave',
		Config: { AudioURL: './sample.mp3', Title: 'Sample Tone', Subtitle: 'With a click-to-seek waveform', Peaks: buildPeaks(48), DownloadName: 'sample.mp3' }
	}
];

class AudioPlayerExampleApplication extends libPictApplication
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		for (let i = 0; i < _Players.length; i++)
		{
			const tmpPlayer = _Players[i];
			this.pict.addView(tmpPlayer.Identifier,
				buildPlayerConfig(tmpPlayer.Identifier, tmpPlayer.Destination, tmpPlayer.Config),
				libPictSectionAudio);
		}
	}

	onAfterInitialize()
	{
		super.onAfterInitialize();

		for (let i = 0; i < _Players.length; i++)
		{
			const tmpView = this.pict.views[_Players[i].Identifier];
			if (tmpView) { tmpView.render(); }
		}
	}
}

module.exports = AudioPlayerExampleApplication;

module.exports.default_configuration =
{
	"Name": "Audio Player Example",
	"Hash": "AudioPlayerExample",
	"pict_configuration":
	{
		"Product": "AudioPlayer-Example"
	}
};
