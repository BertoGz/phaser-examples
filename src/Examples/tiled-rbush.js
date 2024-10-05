import Phaser from "phaser";
import Player from "../Prefabs/Player";
import PhaserCamera from "../Classes/PhaserCamera";
import ScaledRenderTexture from "../Classes/ScaledRenderTexture";
//import QuadtreeManager, { Boundary, QuadTreeObject } from "../Classes/Quadtree";
import ConvertTiled from "surf-make/src/ConvertTiled";
import { createPixelScene } from "../Classes/PhaserPixelScene";

import WorldAPI from "surf-make/src/WorldLoader";
import PhaserInput from "../Classes/PhaserInput";
import RBush from "rbush";

const ROOT_PATH = "/assets/world3-files";
const WORLD_FILENAME = "world3.json";
let game;
const worldFile = `${ROOT_PATH}/${WORLD_FILENAME}`;
const convertTiled = new ConvertTiled();
const worldAPI = new WorldAPI(WORLD_FILENAME);

async function prepareDb() {
  //await convertTiled.deleteDatabase();
  await convertTiled.init({ chunkResolution: 16 * 100 });
  await convertTiled.convertWorld(worldFile);
}

class InitializeData extends Phaser.Scene {
  constructor() {
    super({ key: "initializeData" });
  }
  preload() {
    prepareDb().then(() => {
      this.scene.start("Scene");
    });
  }
}
let debug = false;
class Scene extends Phaser.Scene {
  constructor() {
    super({ key: "Scene" });
    console.log("scene started ");
  }
  preload() {
    this.worldLoader = worldAPI.createLoader({
      chunkSize: 16 * 100,
      gridSize: 5,
      trailDistance: 5,
      name: "environment",
      table: "any",
    });
    // load game assets
    this.load.spritesheet("char_sprite", "./assets/monster-ghost.png", {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet("nature_tile", "./assets/nature-tile.png", {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.image("background", "./assets/icons_16x16.png");
    this.load.image("tree", "./assets/tree.png");
  }
  create() {
    // create a quadtree manager
    // this.qm = new QuadtreeManager();

    this.lastClick = { x: 0, y: 0 };
    // create quadtree
    //  this.tree = this.qm.createTree({ name: "environment" });
    this.tree = new RBush(4);

    //create camera and player
    this.camera = new PhaserCamera(this, 0, 0).setScroll(1600 * 3, -4000);

    this.player = new Player(this, 1600 * 3 - 200, 200, {
      maxSpeed: 0.75,
      lerp: 0.2,
    })
      .setDepth(10)
      .setScale(0.5);

    const sprrr = this.add.sprite(1600 * 4.5, -900, "background").setScale(0);
    this.spr2 = this.add.sprite(3200, -900, "background").setScale(0);
    // Create a tween to make the object wiggle back and forth
    this.tweens.add({
      targets: sprrr,
      y: {
        from: -300,
        to: -300 - 1900,
      },
      duration: 500, // Time in milliseconds
      ease: "Sine.easeInOut", // Smooth wiggle
      yoyo: true, // Makes the tween go back and forth
      repeat: -1, // Repeat indefinitely
    });

    this.enterKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ENTER
    );
    this.oneKey = new PhaserInput(this, Phaser.Input.Keyboard.KeyCodes.ONE);
    function randomSign() {
      return Math.random() < 0.5 ? -1 : 1;
    }
    this.oneKey.onPress = () => {};
    // create render texture to draw game objects to
    this.renderTexture = new ScaledRenderTexture(
      this,
      this.camera,
      0,
      0,
      game.config.width,
      game.config.height
    );

    // let phaser manage this object
    this.add.existing(this.renderTexture);

    this.camera.setTarget(this.player, 0.05);
    this.fpsText = this.add.text(0, 0, "", {
      font: "11px Arial",
      fill: "#00ff00",
    });
    this.input.on("pointerdown", (pointer) => {
      console.log("pointer down");
      const worldPoint = this.camera.getWorldPoint(pointer.x, pointer.y);
      false &&
        worldAPI.execute({
          x: this.player.x,
          y: this.player.y,
        });

      this.lastClick = { x: worldPoint.x, y: worldPoint.y };
    });

    this.worldLoader.onCreateObject = (payload) => {
      if (Math.random() > 0.3) {
        //  return;
      }
      const { object, chunk } = payload || {};
      const { tileId, x, y } = object || {};

      const tile = new Phaser.GameObjects.Image(
        this,
        x,
        y,
        "nature_tile",
        tileId
      );

      tile.name = "grass";
      //  const gm = new QuadTreeObject(tile);

      /*   gm.destroy = () => {
        // tile.setAlpha(0.5);
        tile.destroy();
        //   chunk.objects = chunk.objects.filter((gmi) => gmi !== gm);
      };
      gm.getPosition = () => {
        return [tile.x, tile.y];
      };*/
      chunk.objects.push(tile);
      const treeItem = {
        gm: tile,
        minX: tile.x,
        minY: tile.y,
        maxX: tile.x,
        maxY: tile.y,
      };
      this.tree.insert(treeItem);
      tile.treeItem = treeItem;
    };
    this.worldLoader.onChunksAllReady = () => {
      //  console.log("called last");
      // this.tree.clear();
      //this.tree.redistribute();
      //this.tree.addQueuedPoints();
      console.log(this.tree.errorPoints);
    };

    this.worldLoader.onDestroyObject = (obj) => {
      // console.log("called first");
      // debugger;
      //    this.renderTexture.remove(obj, 0);
      this.tree.remove(obj.treeItem);
      obj.destroy();
    };
    this.worldLoader.onDestroyComplete = () => {};
  }
  update(time, delta) {
    this.oneKey.update();
    // Calculate the current FPS
    const fps = this.game.loop.actualFps;

    // Update the FPS text
    this.fpsText
      .setText(`FPS: ${Math.round(fps)}`)
      .setPosition(this.camera.worldView.x, this.camera.worldView.y);

    this.renderTexture.removeAll();
    this.player.update(time, 1);
    worldAPI.execute({
      x: this.player.x,
      y: this.player.y,
    });

    this.renderTexture.add(this.player, 1);
    this.renderTexture.add(this.spr2, 1);

    // this.tree.execute(this.player.x, this.player.y);

    const boundary = {
      minX: this.camera.scrollX - 50,
      minY: this.camera.scrollY - 50,
      maxX: this.camera.scrollX + this.camera.width + 50,
      maxY: this.camera.scrollY + this.camera.height + 50,
    };

    let instancesDrawn = 0;

    const points = this.tree.search(boundary);
    points.forEach((p) => {
      this.renderTexture.add(p.gm, 0);
    });

    // console.log("instances", instancesDrawn);
    this.renderTexture.execute();

    if (this.enterKey.isDown) {
      setTimeout(function () {
        debug = true;
      }, 1000);
    }
    if (debug === true) {
      debug = false;
      debugger;
      //console.log("ran something");
    }
  }
}

const phaserConfig = {
  width: 360 * 1,
  height: (360 * 1) / 1.33,
  type: Phaser.WEBGL,
  backgroundColor: "#2273a8",
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
    forceSetTimeOut: false,
  },
  pixelArt: true,
  scene: [InitializeData, Scene],
};
game = new Phaser.Game(phaserConfig);
