# What Note Is This?

A note identification and practice app for band and orchestra students.
Play a note on your instrument and the app names it, shows it on a staff,
and tells you whether you're in tune.

**Live at [whatnoteisthis.com](https://whatnoteisthis.com)**

## Features

- **Listen:** press Listen, play a note, and see its name, its position on
  the staff, and a tuner meter showing how many cents sharp or flat you are.
- **Written pitch for your instrument:** pick your instrument and notes are
  shown as written for it (Bb trumpet, Eb alto sax, F horn, and so on), with
  concert pitch alongside.
- **Target notes:** tap the staff to choose a note. The app shows its
  fingering and plays it back, and celebrates with fireworks when you play
  it correctly.
- **Fingering charts** for flute, oboe, clarinet, bassoon, saxophones,
  trumpet, horn, trombone, euphonium and tuba, plus a piano keyboard for
  every instrument.
- **Kid mode (the default):** a simplified, colorful view with just the
  instrument picker, Listen, a big note name, and a "Too low / Just right! /
  Too high" meter. Turn on **Advanced mode** in the header for everything
  else.

Supported instruments: flute, oboe, clarinet, bass clarinet, bassoon, alto,
tenor and bari sax, trumpet, horn, trombone, euphonium, tuba, glockenspiel,
or plain treble/bass clef at concert pitch.

## Running locally

There's no build step. Serve the folder with any static web server:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Browsers only allow microphone access on
`https://` pages or `localhost`, so opening `index.html` directly from disk
won't work for listening.

## How it works

- Pitch detection uses the McLeod Pitch Method (normalized square
  difference function) on live microphone audio via the Web Audio API.
- Staff notation is drawn with [VexFlow](https://www.vexflow.com/).
- Playback is synthesized in the browser with per-instrument timbres.

All app code lives in `js/notetrainer.js` and `js/fingerings.js`; the page
and its styles are in `index.html`.

## Credits

Originally forked from Chris Wilson's
[PitchDetect](https://github.com/cwilso/PitchDetect) demo (2014), and since
rebuilt from the ground up.

## License

MIT. See [LICENSE.txt](LICENSE.txt).
