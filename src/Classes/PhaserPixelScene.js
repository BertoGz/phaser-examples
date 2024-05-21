import Phaser from "phaser";
/**
 * @description the default pixel size relavent to the upscale factor
 */
export let PX = 1;
/**
 * @description lerps two values
 * @param {*} start
 * @param {*} end
 * @param {*} smoothing
 * @returns
 */

export function createPixelScene(config, scene) {
  const upscale = config?.upscale ?? 1;
  config.width = config.width * upscale;
  config.height = config.height * upscale;
  const game = new Phaser.Game(config);
  PX = upscale;
  game.config.upscale = upscale;
  game.scene.add("Scene", scene);

  game.scene.start("Scene");
  return game;
}
