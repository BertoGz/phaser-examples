/**
 * @description lerps two values
 * @param {*} start 
 * @param {*} end 
 * @param {*} t 
 * @returns 
 */
export function lerp(start, end, t) {
  return start * (1 - t) + end * t;
}
