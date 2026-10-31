// Demo manual written for this project (not taken from any real manual).
import type { Manual } from '../guide.ts';

export const halvorsenFilter: Manual = {
  id: 'halvorsen-dw-filter',
  title: 'Cleaning the Halvorsen DW-500 dishwasher filter',
  business: 'Halvorsen Home',
  steps: [
    { n: 1, page: 14, text: 'Turn the dishwasher off at the wall switch and wait until it is cool.' },
    { n: 2, page: 14, text: 'Pull the bottom rack all the way out and lift it off its rails.' },
    { n: 3, page: 15, text: 'Find the round filter in the middle of the floor and turn it a quarter turn to the left.' },
    { n: 4, page: 15, text: 'Lift the filter straight up and separate the fine mesh from the coarse cup.' },
    { n: 5, page: 15, text: 'Rinse both parts under warm running water and scrub gently with a soft brush.' },
    { n: 6, page: 16, text: 'Put the mesh back on the cup, drop the filter in, and turn it right until it clicks.' },
    { n: 7, page: 16, text: 'Put the rack back and run a short rinse cycle to check for leaks.' },
  ],
  passages: [
    { id: 'p1', page: 12, text: 'Clean the filter once a month, or every two weeks if you rinse little before loading.' },
    { id: 'p2', page: 15, text: 'Do not use a wire brush, steel wool or a dishwasher tablet to clean the filter; they damage the fine mesh.' },
    { id: 'p3', page: 16, text: 'If the filter does not click into place, the arrow on the cup is not lined up with the arrow on the floor.' },
    { id: 'p4', page: 20, text: 'Error E24 means water is not draining. Clean the filter first; if E24 stays, call Halvorsen service.' },
    { id: 'p5', page: 9, text: 'Use only rinse aid and detergent made for dishwashers. Washing-up liquid makes too much foam.' },
    { id: 'p6', page: 22, text: 'The DW-500 has a two-year parts warranty. Damage from using the wrong cleaning tools is not covered.' },
    { id: 'p7', page: 14, text: 'The wall switch is usually in the cabinet under the sink or on the wall next to the dishwasher.' },
  ],
};
