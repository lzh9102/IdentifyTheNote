$(document).ready(function() {
  let app = new PIXI.Application({width: 800, height: 600, backgroundColor: 0xffffff});
  $('#score').append(app.view);

  let loader = new PIXI.loaders.Loader();
  loader.add('g_clef', 'assets/img/g_clef_240px.png')
        .add('f_clef', 'assets/img/f_clef_240px.png')
        .add('whole_note', 'assets/img/whole_note.png')
  loader.load(function(loader, res) {
    const LINE_TOP = 52;
    const LINE_SPACING = 31
    const SCORE_WIDTH = 770;

    function createStaffLines(width) {
      let lines = new PIXI.Graphics();
      for (let i = 0; i < 5; i++) {
        let pos = LINE_TOP + LINE_SPACING * i;
        lines.lineStyle(3, 0x00000000);
        lines.moveTo(0, pos);
        lines.lineTo(width, pos);
      }
      return lines;
    }

    // position: the middle line is 0; upward is positive; downward is negative
    // example: middle C in treble clef -> createNote(-6)
    function createNote(position) {
      function positionToY(position) {
        return LINE_TOP + 2 * LINE_SPACING - position * (LINE_SPACING/2);
      }

      function createLedgerLines(width, position) {
        if (position <= -6 || position >= 6) {
          // ledger lines are drawn at +6, -6, +8, -8, +10, -10, ...
          let begin = (position > 0) ? 6 : -6;
          let incr = (position > 0) ? 2 : -2;
          let count = Math.floor(Math.abs(position - begin) / 2) + 1;
          let ledger_lines = new PIXI.Graphics();
          for (let i = 0; i < count; i++) {
            let ledger_pos = begin + incr * i;
            let ledger_y = positionToY(ledger_pos);
            ledger_lines.lineStyle(3, 0x00000000);
            ledger_lines.moveTo(-10, ledger_y);
            ledger_lines.lineTo(width + 10, ledger_y);
          }
          return ledger_lines;
        }
        return null;
      }

      let note = new PIXI.Container();
      note.y = positionToY(position);

      let note_body = new PIXI.Sprite(res.whole_note.texture);
      note_body.y = -note_body.height / 2; // y-center the note
      note.addChild(note_body);

      let ledger_lines = createLedgerLines(note.width, position);
      if (ledger_lines) {
        ledger_lines.y = -note.y; // position ledger lines relative to note
        note.addChild(ledger_lines);
      }

      return note;
    }

    function createTrebleClefView(width) {
      let treble_clef = new PIXI.Container();
      treble_clef.addChild(new PIXI.Sprite(res.g_clef.texture)); // G-clef
      treble_clef.addChild(createStaffLines(width));
      return treble_clef;
    }

    function createBassClefView(width) {
      let bass_clef = new PIXI.Container();
      bass_clef.addChild(new PIXI.Sprite(res.f_clef.texture)); // F-clef
      bass_clef.addChild(createStaffLines(width));
      return bass_clef;
    }

    function noteNameToId(name) {
      name = name.toUpperCase()
      octave = parseInt(name[1]);
      note = {C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6}[name[0]];
      return note + octave * 8;
    }

    const SCORE_LEFT_BOUNDARY = Math.min(res.g_clef.texture.width, res.f_clef.texture.width);
    const SCORE_RIGHT_BOUNDARY = SCORE_WIDTH - res.whole_note.texture.width;

    class TrebleClef {
      constructor(width) {
        this.view = createTrebleClefView(width);
        this.notes = [];
      }
      addNote(name) {
        let position = noteNameToId(name) - noteNameToId('B4');
        let note = createNote(position);
        note.x = SCORE_LEFT_BOUNDARY + 30;
        this.view.addChild(note);
        this.notes.push(note);
      }
    }

    class BassClef {
      constructor(width) {
        this.view = createBassClefView(width);
        this.notes = [];
      }
      addNote(name) {
        let position = noteNameToId(name) - noteNameToId('D3');
        let note = createNote(position);
        note.x = SCORE_LEFT_BOUNDARY + 30;
        this.view.addChild(note);
        this.notes.push(note);
      }
    }

    let treble_clef = new TrebleClef(SCORE_WIDTH);
    treble_clef.view.x = 30;
    treble_clef.view.y = 30;
    app.stage.addChild(treble_clef.view);

    let bass_clef = new BassClef(SCORE_WIDTH);
    bass_clef.view.x = 30;
    bass_clef.view.y = 300;
    app.stage.addChild(bass_clef.view);

    treble_clef.addNote('C4');
    bass_clef.addNote('C3');
  });

});
