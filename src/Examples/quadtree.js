/*!
 * Example: Quadtree
 * Description: showcase the use of the quadtree class to draw only what is visible.
 * Author: Berto Gonzalez
 * License: MIT
 * Version: 1.0.0
 * Date: 2024-05-18
 */

import Phaser from "phaser";
import { QuadTreeObject } from "surf-make/src";
import PhaserCamera from "../Classes/PhaserCamera";
import Player from "../Prefabs/Player";
import ScaledRenderTexture from "../Classes/ScaledRenderTexture";
import Boundary from "surf-make/src/Boundary";
import QuadtreeManager from "surf-make/src/QuadtreeManager";

let game;

// we will store the instances
let uniqueInstances = new Map();
let instancesDrawn = 0;
let totalInstances = 50000;
class Scene extends Phaser.Scene {
  constructor() {
    super({ key: "Scene" });
  }
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
    //create camera and player
    this.camera = new PhaserCamera(this, 0, 0);
    this.player = new Player(this, 0, 0, {
      maxSpeed: 2,
      lerp: 0.01,
    });

    // create render texture to draw game objects to
    this.renderTexture = new ScaledRenderTexture(
      this,
      this.camera,
      0,
      0,
      game.config.width+1,
      game.config.height+1
    );

    this.add.existing(this.renderTexture);

    // camera follows player
    this.camera.startFollow(this.player, false, 0.05);

    // create quadtree manager
    this.qm = new QuadtreeManager();

    //create quad tree
    this.environmentTree = this.qm.createTree({ name: "environment" });

    // create a mass amount of tree game objects
    for (let i = 0; i < totalInstances; i++) {
      const boundaryWidth = 8000;

      // create img object
      const img = new Phaser.GameObjects.Image(
        this,
        Math.round(Math.random() * boundaryWidth - boundaryWidth / 2),
        Math.round(Math.random() * boundaryWidth - boundaryWidth / 2),
        "tree"
      );
      img.depth = img.y;
      // utilize QuadTreeObject to wrap img
      const tree = new QuadTreeObject(img);
      tree.getPosition = () => {
        return [img.x, img.y];
      };
      this.environmentTree.addItem(tree);
    }

    this.environmentTree.addQueuedPoints();

    // create ui display
    this.ui = this.make
      .text({
        style: { fontSize: 10, padding: 10, backgroundColor: "rgba(0,0,0,.4)" },
      })
      .setScrollFactor(0);
  }
  update(time, delta) {
    this.renderTexture.removeAll();
    this.player.update(time, delta);
    this.renderTexture.add(this.player, 1);
    this.environmentTree.update(this.player.x, this.player.y);

    const boundary = new Boundary(
      this.camera.scrollX,
      this.camera.scrollY,
      this.camera.width,
      this.camera.height,
      50
    );

    // set drawn intance count to 0
    instancesDrawn = 0;

    this.environmentTree.executeWithinRange(boundary, (point) => {
      const instance = point.getData();

      uniqueInstances.set(instance.id, 1);
      instancesDrawn++;
      this.renderTexture.add(instance.gm);
    });

    this.ui.setText(
      `currently drawn:${instancesDrawn}\nunique instances drawn:${uniqueInstances.size
        .toString()
        .padStart(5, "0")}/${totalInstances}`
    );
    this.renderTexture.execute();
  }
}

const phaserConfig = {
  width: 360,
  height: 360 / 1.78,
  type: Phaser.WEBGL,
  backgroundColor: "#4f8a56",
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
  scene: [Scene],
};

game = new Phaser.Game(phaserConfig);
