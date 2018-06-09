class NoteName {

  constructor() {
    throw new Error("NoteName cannot be instantiated");
  }

  static toNumericId(name) {
    name = name.toUpperCase()
    let octave = parseInt(name[1]);
    let note = {C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6}[name[0]];
    return note + octave * 7;
  }

  static fromNumericId(id) {
    let note = ['C', 'D', 'E', 'F', 'G', 'A', 'B'][id % 7];
    let octave = Math.floor(id / 7);
    return note + octave.toString();
  }

  static range(begin, end) {
    let begin_id = NoteName.toNumericId(begin);
    let end_id = NoteName.toNumericId(end);
    let notes = [];
    if (begin_id <= end_id) { // ascending
      for (let id = begin_id; id <= end_id; id++) {
        notes.push(NoteName.fromNumericId(id));
      }
    } else { // descending
      for (let id = begin_id; id >= end_id; id--) {
        notes.push(NoteName.fromNumericId(id));
      }
    }
    return notes;
  }

  static toMidiNoteNumber(name) {
    let note = name[0].toUpperCase();
    let octave = parseInt(name[1]);
    // A0 is note number 21 in midi
    return 21 + octave*12 + {'A': 0, 'B': 2, 'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}[note];
  }
}

export default NoteName;
