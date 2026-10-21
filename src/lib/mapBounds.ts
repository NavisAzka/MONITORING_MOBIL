// Approximate viewing bounds for the ITS Sukolilo campus, with a small margin.
export const ITS_MAP_BOUNDS: [[number, number], [number, number]] = [
  [-7.290, 112.785],
  [-7.272, 112.804],
];

// Wider navigation bounds for the passenger map so its viewport is not clipped
// when zoomed out on tall or narrow screens.
export const PASSENGER_MAP_BOUNDS: [[number, number], [number, number]] = [
  [-7.304, 112.775],
  [-7.257, 112.814],
];

export const ITS_MAP_CENTER: [number, number] = [-7.280759, 112.79453];
