"use strict";

$(function() {

  function noteNameToId(name) {
    name = name.toUpperCase()
    let octave = parseInt(name[1]);
    let note = {C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6}[name[0]];
    return note + octave * 7;
  }

  function noteIdToName(id) {
    let note = ['C', 'D', 'E', 'F', 'G', 'A', 'B'][id % 7];
    let octave = Math.floor(id / 7);
    return note + octave.toString();
  }

  function noteRange(begin, end) {
    let begin_id = noteNameToId(begin);
    let end_id = noteNameToId(end);
    let notes = [];
    if (begin_id <= end_id) { // ascending
      for (let id = begin_id; id <= end_id; id++) {
        notes.push(noteIdToName(id));
      }
    } else { // descending
      for (let id = begin_id; id >= end_id; id--) {
        notes.push(noteIdToName(id));
      }
    }
    return notes;
  }

  function initializeMenu(game) {
    // populate range options
    let treble_range = noteRange('G3', 'D6');
    let bass_range = noteRange('B1', 'F4');
    function populateSelectInput($sel, choices) {
      for (let choice of choices) {
        $sel.append($('<option>', {
          value: choice,
          text: choice
        }));
      }
    }
    populateSelectInput($('#treble-low'), treble_range);
    populateSelectInput($('#treble-high'), treble_range);
    populateSelectInput($('#bass-low'), bass_range);
    populateSelectInput($('#bass-high'), bass_range);

    // default values
    $('#treble-low').val(treble_range[0]);
    $('#treble-high').val(treble_range[treble_range.length-1]);
    $('#bass-low').val(bass_range[0]);
    $('#bass-high').val(bass_range[bass_range.length-1]);
    $('#treble-enable').prop('checked', true);
    $('#bass-enable').prop('checked', true);

    // save/restore
    function saveMenuState() {
      $('#menu').find('.option').each(function() {
        if (this.id) {
          let option_name = 'option/' + this.id;
          if ($(this).is(':checkbox'))
            Cookies.set(option_name, $(this).prop('checked'));
          else
            Cookies.set(option_name, $(this).val());
        }
      });
    }
    function restoreMenuState() {
      $('#menu').find('.option').each(function() {
        if (this.id) {
          let option = Cookies.get('option/' + this.id);
          if (option === undefined)
            return;
          if ($(this).is(':checkbox'))
            $(this).prop('checked', option === "true"); // cookie value is string
          else
            $(this).val(option);
        }
      });
    }
    restoreMenuState();

    // event handling
    function updateGameOptions() {
      game.setTrebleEnabled($('#treble-enable').prop('checked'));
      game.setBassEnabled($('#bass-enable').prop('checked'));
      game.setTrebleNoteRange($('#treble-low').val(), $('#treble-high').val());
      game.setBassNoteRange($('#bass-low').val(), $('#bass-high').val());
      console.log("game option updated");
    }
    $('#start').click(updateGameOptions);
    $('#start').click(saveMenuState);
  }

  MIDI.loadPlugin({
    soundfontUrl: "assets/soundfont/",
    instrument: "acoustic_grand_piano",
    onprogress: function(state, progress) {
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
    let game = new Game(res);
    initializeMenu(game);

    let $game_view = $(game.getView());
    let $menu_view = $('#menu');

    function switchToView($view) {
      // detach views first so that they won't be destroyed by empty()
      $game_view.hide().detach();
      $menu_view.hide().detach();

      $('#score').empty().append($view);
      $view.fadeIn();
    }

    switchToView($menu_view);

    $('#start').click(function() {
      console.log("start");
      switchToView($game_view);
      game.start();
    });

    game.onQuit(function() {
      switchToView($menu_view);
    });
  }

  class Game {

    constructor(res) {
      let game = this;

      game._option = {
        treble_begin: 'G3',
        treble_end:   'D6',
        bass_begin:   'B1',
        bass_end:     'F4',
        treble_enabled: true,
        bass_enabled: true
      };

      let app = new PIXI.Application({width: 1000, height: 700,
        backgroundColor: 0xffffff,
        sharedTicker: true});

      const LINE_TOP = 52;
      const LINE_SPACING = 31
      const SCORE_WIDTH = 900;
      const NOTE_SPEED = 2;

      PIXI.sound.volumeAll = 0.2; // lower sfx volume to match midi volume

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

      const SCORE_LEFT_BOUNDARY = Math.max(res.g_clef.texture.width, res.f_clef.texture.width) + 30;
      const SCORE_RIGHT_BOUNDARY = SCORE_WIDTH - res.whole_note.texture.width;

      class Clef extends PIXI.Container {
        // virtual methods
        _getMiddleLineNodeName() { throw new Error('Clef._getMiddleLineNodeName should be implemented'); }
        _getClefTexture() { throw new Error('Clef._getClefTexture should be implemented'); }

        constructor(width) {
          super();
          this._createClefView(width);
          this._notes = [];
        }
        _createClefView(width) {
          let clef = new PIXI.Container();
          clef.addChild(new PIXI.Sprite(this._getClefTexture()));
          clef.addChild(createStaffLines(width));
          this.addChild(clef);
        }
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
        advanceNotes(x_delta) {
          for (let i = this._notes.length-1; i >= 0; i--) {
            let note = this._notes[i].note;
            note.x -= x_delta;
            if (note.x <= SCORE_LEFT_BOUNDARY) {
              if (this._on_note_timeup_callback)
                this._on_note_timeup_callback(note);
              note.parent.removeChild(note);
              this._notes.splice(i, 1);
            }
          }
        }
        clearNotes() {
          for (let item of this._notes)
            item.note.parent.removeChild(item.note);
          this._notes = [];
        }
        onNoteTimeup(callback) {
          this._on_note_timeup_callback = callback;
        }
      }

      class TrebleClef extends Clef {
        constructor(width) { super(width); }
        _getClefTexture() { return res.g_clef.texture; }
        _getMiddleLineNodeName() { return 'B4'; }
      }

      class BassClef extends Clef {
        constructor(width) { super(width); }
        _getClefTexture() { return res.f_clef.texture; }
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
        if (choices.length == 0)
          return null;
        let index = Math.floor(Math.random() * choices.length);
        return choices[index];
      }
      function addNotes() {
        let clefs = [];
        if (game._option.treble_enabled)
          clefs.push("treble");
        if (game._option.bass_enabled)
          clefs.push("bass");

        let choice = randomChoice(clefs);
        if (choice === "treble") {
          let treble_note = randomChoice(noteRange(game._option.treble_begin, game._option.treble_end));
          treble_clef.addNote(treble_note);
        } else if (choice === "bass") {
          let bass_note = randomChoice(noteRange(game._option.bass_begin, game._option.bass_end));
          bass_clef.addNote(bass_note);
        }

        PIXI.setTimeout(2/*seconds*/, addNotes);
      }
      PIXI.setTimeout(2/*seconds*/, addNotes);

      // explosion
      let explosionTextures = [];
      for (let i = 0; i < 26; i++) {
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
      const KEYCODE_1 = 49, KEYCODE_2 = 50, KEYCODE_3 = 51, KEYCODE_4 = 52, KEYCODE_5 = 53, KEYCODE_6 = 54, KEYCODE_7 = 55;
      const KEYCODE_ESC = 27;
      function keycodeToNoteName(keycode) {
        switch (keycode) {
          case KEYCODE_A: case KEYCODE_6: return 'A';
          case KEYCODE_B: case KEYCODE_7: return 'B';
          case KEYCODE_C: case KEYCODE_1: return 'C';
          case KEYCODE_D: case KEYCODE_2: return 'D';
          case KEYCODE_E: case KEYCODE_3: return 'E';
          case KEYCODE_F: case KEYCODE_4: return 'F';
          case KEYCODE_G: case KEYCODE_5: return 'G';
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
        if (!game._started)
          return;
        if (event.which == KEYCODE_ESC) {
          game.quit();
          return;
        }
        if (input_disabled)
          return;
        let notename = keycodeToNoteName(event.which);
        if (!notename)
          return;
        submitAnswer(notename);
      });

      // input buttons
      for (let i = 0; i < 7; i++) {
        let notename = ['C', 'D', 'E', 'F', 'G', 'A', 'B'][i];
        let solfege = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'][i];
        let button_width = app.view.width / 7;
        let button_height = app.view.width / 7;
        let button = new PIXI.Container();

        let button_box = new PIXI.Graphics();
        button_box.beginFill(0xff3300);
        button_box.lineStyle(3, 0x000000);
        button_box.moveTo(0, 0);
        button_box.lineTo(0, button_height);
        button_box.lineTo(button_width, button_height);
        button_box.lineTo(button_width, 0);
        button_box.lineTo(0, 0);
        button_box.endFill();
        button_box.interactive = true;
        button_box.buttonMode = true;
        button_box.on('pointerdown', function() {
          submitAnswer(notename);
        });
        button.addChild(button_box);

        let button_text = new PIXI.Text(notename + "\n(" + solfege + ")",
          {fontFamily: 'Arial', fill: 0x000000, fontSize: button_width / 4, align: 'center'});
        button_text.x = (button_width - button_text.width) / 2;
        button_text.y = (button_height - button_text.height) / 2;
        button.addChild(button_text);

        button.x = i * button_width;
        button.y = app.view.height - button_height;
        app.stage.addChild(button);
      }

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

      // quit button
      function createQuitButton() {
        let padding = 10;
        let button = new PIXI.Container();

        let text = new PIXI.Text("Quit", {fontSize: 20});
        text.x = text.y = padding;

        let box = new PIXI.Graphics();
        box.lineStyle(1, 0x0);
        box.beginFill(0xffff00);
        box.drawRect(0, 0, text.width + padding*2, text.height + padding*2);
        box.endFill();
        box.interactive = true;
        box.buttonMode = true;
        box.on('pointerdown', function() {
          game.quit();
        });

        button.addChild(box);
        button.addChild(text);

        return button;
      }
      let quit_button = createQuitButton();
      app.stage.addChild(quit_button);

      app.ticker.add(function(delta) {
        treble_clef.advanceNotes(delta * NOTE_SPEED);
        bass_clef.advanceNotes(delta * NOTE_SPEED);
      });

      app.stop();
      this._app = app;
      this._treble_clef = treble_clef;
      this._bass_clef = bass_clef;
    }

    setTrebleEnabled(enabled) {
      this._option.treble_enabled = enabled;
      this._treble_clef.alpha = enabled ? 1 : 0.3;
    }

    setTrebleNoteRange(begin, end) {
      this._option.treble_begin = begin;
      this._option.treble_end = end;
    }

    setBassEnabled(enabled) {
      this._option.bass_enabled = enabled;
      this._bass_clef.alpha = enabled ? 1 : 0.3;
    }

    setBassNoteRange(begin, end) {
      this._option.bass_begin = begin;
      this._option.bass_end = end;
    }

    getView() {
      return this._app.view;
    }

    stop() {
      this._app.stop();
      this._started = false;
    }

    start() {
      this._app.start();
      this._started = true;
    }

    reset() {
      this.stop();
      this._treble_clef.clearNotes();
      this._bass_clef.clearNotes();
    }

    quit() {
      if (this._on_quit_callback)
        this._on_quit_callback.call(this);
      this.reset();
    }

    onQuit(callback) {
      this._on_quit_callback = callback;
    }
  }

});
