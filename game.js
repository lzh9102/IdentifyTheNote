$(document).ready(function() {

  MIDI.loadPlugin({
    soundfontUrl: "assets/soundfont/",
    instrument: "acoustic_grand_piano",
    onprogress: function(state, progress) {
      console.log(state, progress);
    },
    onsuccess: function() {
      MIDI.setVolume(0, 127);
      loadAssets();
    }
  });

  function loadAssets() {
    let loader = new PIXI.loaders.Loader();
    loader.add('g_clef', 'assets/img/g_clef_240px.png')
      .add('f_clef', 'assets/img/f_clef_240px.png')
      .add('whole_note', 'assets/img/whole_note.png')
      .add('whole_note_red', 'assets/img/whole_note_red.png')
      .add('explosion', 'assets/img/explosion.json')
      .add('explosion_sound', 'assets/audio/explosion.mp3')
      .add('wrong_sound', 'assets/audio/wrong.mp3');
    loader.load(assetLoadComplete);
  }

  function assetLoadComplete(loader, res) {
    PIXI.sound.volumeAll = 0.2; // lower volume to match midi volume

    let app = new PIXI.Application({width: 800, height: 600,
                                    backgroundColor: 0xffffff,
                                    sharedTicker: true});
    $(app.view).hide();
    $('#score').empty().append(app.view);
    $(app.view).fadeIn();

    $('#pause').click(function() {
      if ($(this).val() === 'pause') {
        app.stop();
        $(this).val('continue');
      } else {
        app.start();
        $(this).val('pause');
      }
    });

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
    class Note extends PIXI.Container {
      static _positionToY(position) {
        return LINE_TOP + 2 * LINE_SPACING - position * (LINE_SPACING/2);
      }

      _redrawLedgerLines(color) {
        if (!this._ledger_lines)
          return;
        this._ledger_lines.clear();

        // ledger lines are drawn at +6, -6, +8, -8, +10, -10, ...
        let position = this._position;
        let begin = (position > 0) ? 6 : -6;
        let incr = (position > 0) ? 2 : -2;
        let count = Math.floor(Math.abs(position - begin) / 2) + 1;
        for (let i = 0; i < count; i++) {
          let ledger_pos = begin + incr * i;
          let ledger_y = Note._positionToY(ledger_pos);
          this._ledger_lines.lineStyle(3, color);
          this._ledger_lines.moveTo(-10, ledger_y);
          this._ledger_lines.lineTo(res.whole_note.texture.width + 10, ledger_y);
        }
      }

      _createLedgerLines() {
        let position = this._position;
        if (position > -6 && position < 6) // ledger line not needed
          return;

        let ledger_lines = new PIXI.Graphics();
        ledger_lines.y = -this.y; // position ledger lines relative to clef

        this._ledger_lines = ledger_lines;
        this._redrawLedgerLines(0x000000);

        this.addChild(ledger_lines);
      }

      _createNoteBody() {
        let note_body = new PIXI.Sprite(res.whole_note.texture);
        note_body.y = -note_body.height / 2; // y-center the note
        this.addChild(note_body);
        this._note_body = note_body;
      }

      markAsError() {
        this._note_body.setTexture(res.whole_note_red.texture);
        this._redrawLedgerLines(0xee0000); // red
      }

      resetMark() {
        this._note_body.setTexture(res.whole_note.texture);
        this._redrawLedgerLines(0x000000);
      }

      constructor(position) {
        super();
        this.y = Note._positionToY(position);
        this._position = position;
        this._createNoteBody();
        this._createLedgerLines();
      }
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
        let note = new Note(position);
        note.x = SCORE_RIGHT_BOUNDARY;
        this.addChild(note);
        this._notes.push({name: name, note: note});
      }
      getFirstNote() {
        if (this._notes.length > 0)
          return this._notes[0].note;
        return null;
      }
      getFirstNoteName() {
        if (this._notes.length > 0)
          return this._notes[0].name;
        return null;
      }
      removeFirstNote() {
        let note = this._notes[0].note;
        note.parent.removeChild(note);
        this._notes.shift();
      }
      tick(delta) {
        for (let i = this._notes.length-1; i >= 0; i--) {
          let note = this._notes[i].note;
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

    let deadline = new PIXI.Graphics();
    deadline.lineStyle(3, 0xff0000);
    deadline.moveTo(30 + SCORE_LEFT_BOUNDARY, 15);
    deadline.lineTo(30 + SCORE_LEFT_BOUNDARY, 550);
    app.stage.addChild(deadline);

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
      PIXI.setTimeout(2/*seconds*/, addNotes);
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

    // handle keyboard events
    const KEYCODE_A = 65, KEYCODE_B = 66, KEYCODE_C = 67, KEYCODE_D = 68, KEYCODE_E = 69, KEYCODE_F = 70, KEYCODE_G = 71;
    function keycodeToNoteName(keycode) {
      switch (keycode) {
        case KEYCODE_A: return 'A';
        case KEYCODE_B: return 'B';
        case KEYCODE_C: return 'C';
        case KEYCODE_D: return 'D';
        case KEYCODE_E: return 'E';
        case KEYCODE_F: return 'F';
        case KEYCODE_G: return 'G';
        default: return null;
      }
    }
    function noteNameToMidiNote(name) {
      let note = name[0].toUpperCase();
      let octave = parseInt(name[1]);
      // A0 is note number 21 in midi
      return 21 + octave*12 + {'A': 0, 'B': 2, 'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}[note];
    }

    let input_disabled = false;
    $(document).keydown(function(event) {
      if (input_disabled)
        return;
      let notename = keycodeToNoteName(event.which);
      if (!notename)
        return;
      submitAnswer(notename);
    });

    function submitAnswer(notename) {
      // select the clef with the first node
      let clef = null;
      let treble_first_note = treble_clef.getFirstNote();
      let bass_first_note = bass_clef.getFirstNote();
      if (treble_first_note && bass_first_note)
        clef = (treble_first_note.x < bass_first_note.x) ? treble_clef : bass_clef;
      else if (treble_first_note || bass_first_note)
        clef = treble_first_note ? treble_clef : bass_clef;
      if (!clef)
        return;

      if (notename.toUpperCase() === clef.getFirstNoteName()[0].toUpperCase()) {
        let midiNote = noteNameToMidiNote(clef.getFirstNoteName());
        MIDI.noteOn(0, midiNote, 127, 0);
        MIDI.noteOff(0, midiNote, 0);
        clef.removeFirstNote();
      } else { // wrong answer
        let firstNote = clef.getFirstNote();
        res.wrong_sound.sound.play();
        // as a penalty, disable the input for a short period of time
        input_disabled = true;
        firstNote.markAsError();
        PIXI.setTimeout(1.5/*seconds*/, function() {
          input_disabled = false;
          firstNote.resetMark();
        });
      }
    }

    app.ticker.add(function(delta) {
      treble_clef.tick(delta);
      bass_clef.tick(delta);
    });
  }

});
