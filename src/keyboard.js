import $ from 'jquery';

export const KEY_A = 65, KEY_B = 66, KEY_C = 67, KEY_D = 68, KEY_E = 69, KEY_F = 70, KEY_G = 71;
export const KEY_1 = 49, KEY_2 = 50, KEY_3 = 51, KEY_4 = 52, KEY_5 = 53, KEY_6 = 54, KEY_7 = 55;
export const KEY_ESC = 27;

export function onKeyDown(callback) {
  $(document).keydown(function(event) {
    callback.call(this, event.which);
  });
}
