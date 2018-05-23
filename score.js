$(document).ready(function() {
  let app = new PIXI.Application({width: 800, height: 600, backgroundColor: 0xffffff});
  $('#score').append(app.view);

  let loader = new PIXI.loaders.Loader();
  loader.add('g_clef', 'assets/img/g_clef_240px.png')
        .add('f_clef', 'assets/img/f_clef_240px.png')
        .add('whole_note', 'assets/img/whole_note.png')
        .add('explosion', 'assets/img/explosion.json')
        .add('explosion_sound', 'assets/audio/explosion.mp3');
  loader.load(function(loader, res) {
    const LINE_TOP = 52;
    const LINE_SPACING = 31
    const SCORE_WIDTH = 770;
    const NOTE_SPEED = 2;

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
      return note + octave * 7;
    }
    function noteIdToName(id) {
      note = ['C', 'D', 'E', 'F', 'G', 'A', 'B'][id % 7];
      octave = Math.floor(id / 7);
      return note + octave.toString();
    }

    const SCORE_LEFT_BOUNDARY = Math.max(res.g_clef.texture.width, res.f_clef.texture.width) + 30;
    const SCORE_RIGHT_BOUNDARY = SCORE_WIDTH - res.whole_note.texture.width;

    class Clef extends PIXI.Container {
      constructor(width) {
        super();
        this.addChild(this._createClefView(width));
        this._notes = [];
      }
      _createClefView(width) { }
      _getMiddleLineNodeName() { }
      addNote(name) {
        let position = noteNameToId(name) - noteNameToId(this._getMiddleLineNodeName());
        let note = createNote(position);
        note.x = SCORE_RIGHT_BOUNDARY;
        this.addChild(note);
        this._notes.push(note);
      }
      tick(delta) {
        for (let i = this._notes.length-1; i >= 0; i--) {
          let note = this._notes[i];
          note.x -= delta * NOTE_SPEED;
          if (note.x <= SCORE_LEFT_BOUNDARY) {
            if (this._on_note_timeup_callback)
              this._on_note_timeup_callback(note);
            note.parent.removeChild(note);
            this._notes.splice(i, 1);
          }
        }
      }
      onNoteTimeup(callback) {
        this._on_note_timeup_callback = callback;
      }
    }

    class TrebleClef extends Clef {
      constructor(width) { super(width); }
      _createClefView(width) { return createTrebleClefView(width); }
      _getMiddleLineNodeName() { return 'B4'; }
    }

    class BassClef extends Clef {
      constructor(width) { super(width); }
      _createClefView(width) { return createBassClefView(width); }
      _getMiddleLineNodeName() { return 'D3'; }
    }

    let treble_clef = new TrebleClef(SCORE_WIDTH);
    treble_clef.x = 30;
    treble_clef.y = 30;
    app.stage.addChild(treble_clef);

    let bass_clef = new BassClef(SCORE_WIDTH);
    bass_clef.x = 30;
    bass_clef.y = 300;
    app.stage.addChild(bass_clef);

    function randomChoice(choices) {
      let index = Math.floor(Math.random() * choices.length);
      return choices[index];
    }
    function noteRange(begin, end) {
      let begin_id = noteNameToId(begin);
      let end_id = noteNameToId(end);
      let notes = [];
      for (let id = begin_id; id <= end_id; id++) {
        notes.push(noteIdToName(id));
      }
      return notes;
    }
    function addNotes() {
      if (randomChoice([0, 1]) == 1) {
        let treble_note = randomChoice(noteRange('A3', 'D4'))
        treble_clef.addNote(treble_note);
      } else {
        let bass_note = randomChoice(noteRange('A2', 'D3'));
        bass_clef.addNote(bass_note);
      }
      setTimeout(addNotes, 2000);
    }
    addNotes();

    // explosion
    let explosionTextures = [];
    for (i = 0; i < 26; i++) {
      let texture = PIXI.Texture.fromFrame('Explosion_Sequence_A ' + (i+1) + '.png');
      explosionTextures.push(texture);
    }
    function showExplosionAt(x, y) {
      let explosionSprite = new PIXI.extras.AnimatedSprite(explosionTextures);
      explosionSprite.x = x;
      explosionSprite.y = y;
      explosionSprite.loop = false;
      explosionSprite.anchor.set(0.5);
      explosionSprite.onComplete = function() {
        app.stage.removeChild(explosionSprite);
        explosionSprite.stop();
      };
      explosionSprite.play();
      res.explosion_sound.sound.play();
      app.stage.addChild(explosionSprite);
    }
    function noteTimeup(note) {
      showExplosionAt(note.parent.x + note.x, note.parent.y + note.y);
    }
    treble_clef.onNoteTimeup(noteTimeup);
    bass_clef.onNoteTimeup(noteTimeup);

    app.ticker.add(function(delta) {
      treble_clef.tick(delta);
      bass_clef.tick(delta);
    });
  });

});
