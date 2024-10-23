import Phaser from "phaser";
/**
 * @description the default pixel size relavent to the upscale factor
 */
let _upscale = 1;

export function createPixelScene(config, scene) {
  const upscale = config?.upscale ?? 1;
  config.width = config.width * upscale;
  config.height = config.height * upscale;
  const game = new Phaser.Game(config);
  _upscale = upscale;
  game.config.upscale = upscale;
  game.scene.add("Scene", scene);

  game.startScene = () => {
    game.scene.start("Scene");
  };

  return game;
}
