/**
{version,maps:[Map]}
Map:{width,height,x,y,version}
 */

// This file helps generate a custom world "export" file that helps keep track of "versioning"
// code by berto gonzalez

/**
 * 
 * @param {*} fileName 
 * @returns 
 * 
 *          "columns":7,
         "firstgid":1,
         "image":"..\/assets\/nature-tile.png",
         "imageheight":64,
         "imagewidth":128,
         "margin":1,
         "name":"nature-tile",
         "spacing":1,
         "tilecount":21,
         "tileheight":16,
         "tilewidth":16
 */
const tilesetMapProps = [
  "columns",
  "firstgid",
  "image",
  "imageheight",
  "imagewidth",
  "margin",
  "name",
  "spacing",
  "tilecount",
  "tileheight",
  "tilewidth",
];

function checkTextFileExists(fileName) {
  for (let asset of tiled.openAssets) {
    // Check if the asset is a text file and has the specified file name
    if (asset.fileType === "text" && asset.fileName === fileName) {
      tiled.log("file found");
      return asset;
    }
  }
  return false;
}
// returns the path portion of a file-path
function getPath(path) {
  let lastSlashIndex = path.lastIndexOf("/");

  // Extract the directory path
  return path.substring(0, lastSlashIndex);
}
// returns the name portion of a file-path
function getFileNameFromPath(path) {
  let lastSlashIndex = path.lastIndexOf("/");

  // Extract the directory path
  path.substring(0, lastSlashIndex);
  let fileName = path.substring(lastSlashIndex + 1);
  return fileName;
}

// removes any file extension on a filename
function removeFileExtension(filename) {
  // Split the filename by the last dot
  const lastDotIndex = filename.lastIndexOf(".");

  // If there's no dot, return the original filename
  if (lastDotIndex === -1) return filename;

  // Return the substring before the last dot
  return filename.substring(0, lastDotIndex);
}

// creates a textfile to a given directory
function writeTextFile(fileName, directory = "", content) {
  let file = new TextFile(`${directory}/${fileName}`, TextFile.ReadWrite);
  file.write(content);
  file.commit();
}

// reads a text file
function readTextFile(path) {
  let file;
  try {
    file = new TextFile(path, TextFile.ReadOnly);
  } catch (e) {
    return false;
  }
  if (file) {
    let content = file.readAll();
    // Close the file
    file.close();

    // Parse the JSON content
    return content;
  }
}

class World {
  constructor(asset) {
    this.parent = undefined;
    this.asset = asset;
    this.fileName = getFileNameFromPath(this.asset.fileName);
    this.maps = this.asset.maps;
    this.prevMaps = this.maps.map((_asset) => _asset.fileName); // create a shallow copy
    this.data = {};
    tiled.log(`inited world${asset.fileName}`);
  }
  /**
   *
   * @returns all the json map files associated with the word.
   */
  getJsonMaps() {
    // if (this.asset.modified) {
    //    this.asset.save();
    // }
    const readData = readTextFile(this.asset.fileName);
    // Try to parse the JSON data and handle errors
    try {
      return JSON.parse(readData);
    } catch (e) {
      tiled.log("Error parsing JSON: " + e.message);
      return false; // Return an empty object or handle the error as needed
    }
  }
}
/**
 * @param
 * world asset
 */
class GameExporter {
  constructor(asset) {
    //**Properties */
    this.customProperties = { worldVersion: 0, mapVersions: {} };
    this.workingDirectory = getPath(asset.fileName);
    this.world = new World(asset);
    this.world.parent = this;

    this.modifiedAssets = [];

    this.destroy = this.destroy.bind(this);
    this.writeWorldFile = this.writeWorldFile.bind(this);
    this.onWorldsChanged = this.onWorldsChanged.bind(this);
    this.onAssetAboutToBeSaved = this.onAssetAboutToBeSaved.bind(this);
    this.onAssetSaved = this.onAssetSaved.bind(this);

    this._checkForNewMap = this._checkForNewMap.bind(this);

    tiled.assetSaved.connect(this.onAssetSaved);
    tiled.assetAboutToBeSaved.connect(this.onAssetAboutToBeSaved);
    tiled.worldsChanged.connect(this.onWorldsChanged);

    this.exportName = `${removeFileExtension(this.world.fileName)}-save.json`;
    this.exportDir = `${this.workingDirectory}/${removeFileExtension(
      this.world.fileName
    )}-files`; // Specify the export directory relative to project directory

    // call init
    this.init();

    this.handleExport = this.handleExport.bind(this);

    // register action with Tiled Window
    var exportWorldAction = tiled.registerAction(
      "exportWorld",
      this.handleExport
    );
    exportWorldAction.text = "Export All Files";
    tiled.extendMenu("File", [
      { action: "exportWorld", before: "Reload" },
      { separator: true },
    ]);
  }
  init() {
    // get custom properties
    const customPropertiesUnparsed = readTextFile(
      `${this.workingDirectory}/${this.exportName}`
    );

    // apply found properties
    if (customPropertiesUnparsed) {
      const { worldVersion, mapVersions } = JSON.parse(
        customPropertiesUnparsed
      );
      if (worldVersion) {
        this.customProperties.worldVersion = worldVersion;
      }
      if (mapVersions) {
        this.customProperties.mapVersions = mapVersions;
      }
    }
  }

  onAssetAboutToBeSaved2(asset) {
    return;
    if (!this.assetBelongsToWorld(asset)) {
      return;
    }

    switch (asset.assetType) {
      // handle saving the map
      case AssetType.TileMap:
        const isNewSave = this.customProperties.worldVersion === 0;
        if (asset.modified || isNewSave) {
          this.customProperties.worldVersion++;
          const mapName = getFileNameFromPath(asset.fileName);
          if ([mapName] in this.customProperties.mapVersions) {
            this.customProperties.mapVersions[mapName]++;
          } else {
            this.customProperties.mapVersions[mapName] = 0;
          }
          this.saveWorld();
        }

        break;
    }
  }
  onAssetAboutToBeSaved(asset) {
    // exit if asset doesnt belong to this world
    if (!this.assetBelongsToWorld(asset)) {
      return;
    }

    switch (asset.assetType) {
      // handle saving the map
      case AssetType.TileMap:
        if (asset.modified) {
          this.modifiedAssets.push(asset.fileName);
        }
        break;
    }
  }
  _checkForNewMap() {
    // compare the list of currrently loaded maps and figure out which one is new
    let newMaps = this.world.maps.filter((map) => {
      // Check if the map is not in prevMaps
      return !this.world.prevMaps.includes(map.fileName);
    });

    // Log or return the names of the new maps
    newMaps.forEach((newMap) => {
      tiled.log(`Map ${newMap.fileName} has been attached to the world.`);
    });

    //  // Return the list of new map names
    return newMaps; //.map((newMap) => newMap.fileName);
  }

  /**
   * @description
   * when a map is added to a world immediately save the world to update .world file
   * push the added map to the list of modifiedAssets
   */
  onWorldsChanged() {
    this.world.asset.save();
    const newMaps = this._checkForNewMap();

    this.modifiedAssets.push(...newMaps.map((map) => map.fileName));
  }
  /**
   *
   * @description
   * handle generating a modified version of the .worldFile by
   * pushing our customProperties to it
   */
  onAssetSaved(asset) {
    // exit if asset doesnt belong to this world
    if (!this.assetBelongsToWorld(asset)) {
      return;
    }
    switch (asset.assetType) {
      // handle saving the map
      case AssetType.TileMap:
        const isNewSave = this.customProperties.worldVersion === 0;
        const isAssetModified = this.modifiedAssets.find(
          (_asset) => _asset === asset.fileName
        );

        if (isAssetModified || isNewSave) {
          this.customProperties.worldVersion++;
          const mapName = getFileNameFromPath(asset.fileName);
          if ([mapName] in this.customProperties.mapVersions) {
            this.customProperties.mapVersions[mapName]++;
          } else {
            this.customProperties.mapVersions[mapName] = 0;
          }
          this.writeWorldFile();

          // clear from modified assets
          this.modifiedAssets = this.modifiedAssets.filter(
            (_asset) => _asset !== asset.fileName
          );
        }

        break;
    }
  }

  /**
   * @description
   * writes to a json file containing world information and customProperties
   */
  writeWorldFile() {
    // tiled.log("went heo");
    if (this.world.asset) {
      let worldData = this.world.getJsonMaps();
      if (!worldData) {
        tiled.log(".world file not found!");
      }

      // todo add condition here to not increment world version if no changes were added
      if (worldData) {
        let { maps } = worldData || {};

        worldData.maps = maps.map((map) => {
          // spread custom properties to map
          const newData = Object.assign({}, map, {
            version: this.customProperties.mapVersions[map.fileName] || 0,
          });
          return newData;
        });
        worldData["worldVersion"] = this.customProperties.worldVersion;

        // write to patch file
        writeTextFile(
          this.exportName,
          this.workingDirectory,
          JSON.stringify(worldData)
        );
        tiled.log(`saved to ${this.exportName}`);
      }
    }
  }
  /**
   * clear all listeners
   */
  destroy() {
    tiled.assetSaved.disconnect(this.onAssetSaved);
    tiled.assetAboutToBeSaved.disconnect(this.onAssetAboutToBeSaved);
    tiled.worldsChanged.disconnect(this.onWorldsChanged);
    tiled.log("world offloaded");
  }
  assetBelongsToWorld(asset) {
    if (!asset) {
      return;
    }
    if (asset.assetType === AssetType.TileMap) {
      if (
        this.world.maps.filter((map) => map.fileName === asset.fileName)
          .length >= 1
      ) {
        return true;
      }
    }
  }
  handleExport() {
    try {
      // Create the directory
      if (!File.exists(this.exportDir)) {
        File.makePath(this.exportDir);
      }
      // export individual maps
      this.world.maps.forEach((map) => {
        const json = readTextFile(map.fileName);
        const data = JSON.parse(json);

        if (data) {
          const exportData = data;
          // remove export prop
          delete exportData.export;
          delete exportData.editorsettings;

          const { tilesets } = data || {};
          if (tilesets.length) {
            const tilesetModified = [];
            // modify data for each tileset
            // depending on the tileset it might contain a source
            tilesets.forEach((tileset) => {
              let modded = {};
              if (tileset.source) {
                const tilesetJson = readTextFile(
                  `${this.workingDirectory}/${tileset.source}`
                );
                if (tilesetJson) {
                  delete tileset.source;
                  modded = Object.assign(
                    {},
                    tileset,
                    JSON.parse(tilesetJson)
                  );
                }
              } else {
                tileset.name = tileset.image;
                delete tileset.image;
              }
              tilesetModified.push(modded);
              tiled.log(`pushed${JSON.stringify(modded)}`);
            });
            // reassign the value
            exportData.tilesets = tilesetModified;
          }

          const currentMapName = getFileNameFromPath(map.fileName);
          writeTextFile(
            currentMapName,
            this.exportDir,
            JSON.stringify(exportData)
          );
        }
      });

      // export the world file
      const wFile = readTextFile(`${this.workingDirectory}/${this.exportName}`);

      writeTextFile(
        `${removeFileExtension(this.world.fileName)}.json`,
        this.exportDir,
        wFile
      );

      tiled.log("Exported all files");
    } catch (e) {
      tiled.log("error exporting files");
    }
  }
}
let gameExports = [];
let loadedWorlds = [];

// Function to update the list of currently loaded worlds
function updateLoadedWorlds() {
  loadedWorlds = tiled.worlds.map((world) => world.fileName);
}

// Listen for when an asset is about to be closed
tiled.assetAboutToBeClosed.connect(function (asset) {
  if (asset.assetType === AssetType.World) {
    const unloadedWorld = asset;

    // Log the unloaded world
    tiled.log(`World unloaded: ${unloadedWorld.fileName}`);

    // Remove the unloaded world from the list
    loadedWorlds = loadedWorlds.filter((world) => world !== unloadedWorld);
  }
});

// Listen for changes in the list of worlds (e.g., a world is loaded or unloaded)
tiled.worldsChanged.connect(() => {
  // Get the current list of worlds
  const currentWorlds = tiled.worlds.map((world) => world.fileName);
  //tiled.log(loadedWorlds.length);

  // Determine if a world has been unloaded
  const unloadedWorlds = loadedWorlds.filter(
    (world) => !currentWorlds.includes(world)
  );

  if (unloadedWorlds.length > 0) {
    unloadedWorlds.forEach((world) => {
      tiled.log(`World has been unloaded: ${world}`);
      const gameWorld = gameExports.find(
        (e) => e.world.asset.fileName === world
      );
      gameWorld.destroy();
    });
  }
  if (currentWorlds.length > 0) {
    currentWorlds.forEach((world) => {
      if (!loadedWorlds.includes(world)) {
        tiled.log("loaded game world");
        const worldObj = tiled.worlds.find((w) => w.fileName === world);

        gameExports.push(new GameExporter(worldObj));
      }
    });
  }

  // Update the list of loaded worlds
  updateLoadedWorlds();
});
