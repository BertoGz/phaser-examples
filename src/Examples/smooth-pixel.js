import Phaser from "phaser";
import Player from "../Prefabs/Player";
import PhaserCamera from "../Classes/PhaserCamera";
import ScaledRenderTexture from "../Classes/ScaledRenderTexture";
import { createPixelScene } from "../Classes/PhaserPixelScene";
import { lerp } from "../Functions/lerp";
const UPSCALE_FACTOR = 3;
let game;
class Scene extends Phaser.Scene {
  preload() {
    // load game assets
    this.load.spritesheet("char_sprite", "./assets/monster-ghost.png", {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet("nature_tile", "./assets/nature-tile.png", {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.image("tree", "./assets/tree.png");
  }

  create() {
    //create camera
    this.camera = new PhaserCamera(this, 0, 0);

    // make render texture for grass tiles
    this.renderTexture = new ScaledRenderTexture(
      this,
      this.camera,
      0,
      0,
      this.camera.width,
      this.camera.height
    );

    this.add.existing(this.renderTexture);

    //align render texture to top left
    this.renderTexture.setOrigin(0, 0);
    this.renderTexture.setScrollFactor(0, 0);

    // create grass tiles
    for (let x = -25; x < 25; x++) {
      for (let y = -25; y < 25; y++) {
        const newTile = new Phaser.GameObjects.Image(
          this,
          x * 16 * UPSCALE_FACTOR,
          y * 16 * UPSCALE_FACTOR,
          "nature_tile",
          12
        );
        this.renderTexture.add(newTile);
      }
    }
    const tree = new Phaser.GameObjects.Image(this, 100, 100, "tree");
    this.renderTexture.add(tree);
    // create player
    this.player = new Player(this, 0, 0, { maxSpeed: 6, lerp: 0.01 });
    this.renderTexture.add(this.player);

    this.player.setDepth(10);
  
  }

  update(time, delta) {
    this.player.update(time, delta);
    this.camera.scrollX = lerp(
      this.camera.scrollX,
      this.player.x - this.camera.width / 2,
      0.1
    );
    this.camera.scrollY = lerp(
      this.camera.scrollY,
      this.player.y - this.camera.height / 2,
      0.1
    );
    requestAnimationFrame(() => {
      this.renderTexture.execute();
    });
  }
}

const phaserConfig = {
  type: Phaser.WEBGL,
  width: 352,
  height: Math.round(352 / 1.69),
  upscale: UPSCALE_FACTOR,
  orientation: "landscape",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
  },
  fps: {
    target: 60,
    forceSetTimeOut: true,
  },
  pixelArt: true,
};

game = createPixelScene(phaserConfig, Scene);
game.startScene();
