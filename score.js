$(document).ready(function() {
  let app = new PIXI.Application({width: 800, height: 600, backgroundColor: 0xffffff});
  $('#score').append(app.view);

  let loader = new PIXI.loaders.Loader();
  loader.add('g_clef', 'assets/img/g_clef_240px.png')
        .add('f_clef', 'assets/img/f_clef_240px.png')
        .add('whole_note', 'assets/img/whole_note.png')
  loader.load(function(loader, res) {

    let line_top = 52;
    let line_spacing = 31;
    let line_positions = [];
    for (let i = 0; i < 5; i++)
      line_positions.push(line_top + line_spacing * i);

    // treble clef
    let treble_clef = new PIXI.Container();
    treble_clef.x = 30;
    treble_clef.y = 30;
    app.stage.addChild(treble_clef);

    let g_clef = new PIXI.Sprite(res.g_clef.texture);
    treble_clef.addChild(g_clef);

    let treble_lines = new PIXI.Graphics();
    for (let y of line_positions) {
      treble_lines.lineStyle(3, 0x00000000);
      treble_lines.moveTo(0, y);
      treble_lines.lineTo(700, y);
    }
    treble_clef.addChild(treble_lines);

    // bass clef
    let bass_clef = new PIXI.Container();
    bass_clef.x = 30;
    bass_clef.y = 300;
    app.stage.addChild(bass_clef);

    let f_clef = new PIXI.Sprite(res.f_clef.texture);
    bass_clef.addChild(f_clef);

    let bass_lines = new PIXI.Graphics();
    for (let y of line_positions) {
      bass_lines.lineStyle(3, 0x00000000);
      bass_lines.moveTo(0, y);
      bass_lines.lineTo(700, y);
    }
    bass_clef.addChild(bass_lines);

    // simple note
    let note = new PIXI.Sprite(res.whole_note.texture);
    note.x = 100
    note.y = line_positions[2];
    bass_clef.addChild(note);

    // note with ledger lines
    let note2 = new PIXI.Container();
    note2.x = 100;
    note2.y = line_positions[4] + line_spacing / 2;
    treble_clef.addChild(note2);

    let note2_note = new PIXI.Sprite(res.whole_note.texture);
    note2.addChild(note2_note);

    let note2_ledger_lines = new PIXI.Graphics();
    note2_ledger_lines.lineStyle(3, 0x00000000);
    note2_ledger_lines.moveTo(-10, line_spacing / 2);
    note2_ledger_lines.lineTo(note2.width + 10, line_spacing / 2);
    note2.addChild(note2_ledger_lines);

  });

});
