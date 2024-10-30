import Dexie from "dexie";
import DexieSingleton from "../DexieSingleton";
const THRESHOLD = (100 * 100) / 1;
const MIN_VALUE = 1;
/**
 *
 * @param {string} path
 * @return returns the filename of the json based on the path given
 */
function getPathFileName(path, file_extension = "") {
  const parts = path.split("/");
  const tableName = parts[parts.length - 1].replace(file_extension, "");
  return tableName;
}
function getPathFileLocation(path) {
  // Use the lastIndexOf method to find the last occurrence of the '/'
  const lastSlashIndex = path.lastIndexOf("/");

  // Extract the substring from the start to the last slash
  if (lastSlashIndex !== -1) {
    return path.substring(0, lastSlashIndex);
  }

  // If there is no slash in the path, return an empty string
  return "";
}

/*
store chunks in a table. a list of objects will be inserted into "data" field.
every time we perform a query we will only query stuff found inside that chunk.
we return the data and for each item we return the value found
for this to work we will need a "chunks" table and a "values" table. 
we can retrieve values using chunk retrieval method. and we can look up the values found on that chunk. once we have the values from the table we can query.
*/

export default class ConvertTiled {
  static instance;
  constructor() {
    if (!ConvertTiled.instance) {
      ConvertTiled.instance = this;
      this.dexie = new DexieSingleton();
      this.chunkDimensions = undefined;
    }
    return ConvertTiled.instance;
  }
  /**
   * @description initializes the library
   */
  async init() {
    //create initial schema for database
    await this.dexie.init({
      converted_maps: "map_name,version",
      converted_worlds:
        "world_name,version,chunkWidth,chunkHeight,tileWidth,tileHeight",
    });
  }
  /**
   *
   * @param {string} worldFile
   * @description converts a tiled world to database
   */
  async convertWorld(worldFile = "") {
    this.worldName = getPathFileName(worldFile, ".world");

    this.converted_worlds = this.dexie.db.table("converted_worlds");

    const objectTableSchema = "++id,[x+y],x,y,tileId,customProp,tileset,chunk";
    const chunkTableSchema = "position,xOff,yOff,data";

    const isWorldConverted = await this.converted_worlds
      .where("world_name")
      .equals(this.worldName)
      .toArray();

    const isFirstConvert = isWorldConverted.length === 0;

    // world is not exist. update the schema with new tables to represent world
    if (isFirstConvert) {
      await this._addTable(`${this.worldName}_chunks`, chunkTableSchema);
      await this._addTable(`${this.worldName}_objects`, objectTableSchema);

      // add entry to list of converted worlds to not reconvert world again.
      await this.converted_worlds.add({
        world_name: this.worldName,
      });
    } else {
      // world exists so lets read its chunkWidth/Height and set it in the db
      // we will use this to help calculate which chunks to create later
      const world = await this.converted_worlds.get(this.worldName);
      const { chunkWidth, chunkHeight, tileWidth, tileHeight } = world || {};

      this.chunkDimensions = {
        width: chunkWidth,
        height: chunkHeight,
        tileWidth,
        tileHeight,
      };
    }

    // read worldFile
    // call convert world on each one with the map offsets applied
    const response = await fetch(worldFile);

    console.log(`Received response for ${worldFile}`, response);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const jsonData = await response.json();
    const { maps } = jsonData || {};

    // process each map
    for (const [index, map] of maps.entries()) {
      await this._processMap(map, worldFile, index);
    }
  }
  async _processMap(map, worldFile) {
    const fileDirectory = getPathFileLocation(worldFile);
    const worldName = getPathFileName(worldFile, ".world");

    const { fileName, x: mapX, y: mapY, version } = map || {};

    const converted_maps = this.dexie.db.table("converted_maps");
    const mapTableName = `${worldName}-${fileName}`;

    // check if this map has previously been converted
    const converted_map = await converted_maps
      .where("map_name")
      .equals(mapTableName)
      .toArray();

    const convert = async (version = 0) => {
      // find the assocaited map file based of the fileName and directory
      const mapPath = `${fileDirectory}/${fileName}`;

      await this._convertTiledMap(worldName, mapPath, mapX, mapY);
    };

    // if no map was found convert it
    // or if one has been found check its version number and convert if necessary.
    if (converted_map.length === 0) {
      await converted_maps.add({
        map_name: mapTableName,
        version,
      });

      await convert(version);
    } else {
      if (converted_map.length >= 1) {
        const { version: currentVersion } = converted_map[0] || {};

        if (currentVersion < version) {
          converted_maps.update(mapTableName, { version });

          await convert(version);
        }
      }
    }
  }
  // binded method
  async _updateWorldWithChunkDimensions(mapData) {
    const { width, height, tileheight, tilewidth } = mapData || {};

    this.chunkDimensions = {
      width,
      height,
      tileWidth: tilewidth,
      tileHeight: tileheight,
    };

    return this.converted_worlds.update(this.worldName, {
      chunkWidth: width,
      chunkHeight: height,
      tileWidth: tilewidth,
      tileHeight: tileheight,
    });
  }
  /**
   *
   * @param {*} mapName
   * @param {*} schema
   * @description creates a new table in the database for the given map
   */
  async _addTable(tableName, schema) {
    const currentVersion = this.dexie.db.verno;
    if (currentVersion >= 1) {
      // Close the database before modifying the schema
      try {
        if (this.dexie.db.isOpen()) {
          await this.dexie.db.close();
        }
      } catch (e) {
        debugger;
      }

      // Collect existing tables
      const existingSchema = this.dexie.db.tables.reduce((acc, table) => {
        acc[table.name] =
          table.schema.primKey.src +
          "," +
          table.schema.indexes.map((idx) => idx.src).join(",");
        return acc;
      }, {});

      // Add the new table schema
      existingSchema[tableName] = schema;

      // Increment the version and update schema
      await this.dexie.db.version(currentVersion + 1).stores(existingSchema);

      // Re-open the database
      await this.dexie.db.open();
    }
  }

  /**
   * @description reads a tiled json and converts it to spatial database
   * @param {file} json
   */
  async _convertTiledMap(worldName, mapPath, mapX = 0, mapY = 0) {
    // Read map file
    const response = await fetch(mapPath);

    console.log(`Received response for ${mapPath}`, response);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const mapData = await response.json();

    // if we currently dont have chunk dimensions obtain them from the first   mapData
    if (!this.chunkDimensions) {
      await this._updateWorldWithChunkDimensions(mapData);
    }

    // Process each tile and insert into the database
    const processTiles = async (map) => {
      const tilesetProps = {};
      // Extract tileset properties into objects
      map.tilesets.forEach((tileset) => {
        tilesetProps[tileset.name] = { image: tileset.name, tiles: {} };
        tileset.tiles &&
          tileset.tiles.forEach((tile) => {
            tilesetProps[tileset.name].tiles[tile.id] = tile.properties.reduce(
              (acc, prop) => {
                acc[prop.name] = prop.value;
                return acc;
              },
              {}
            );
          });
      });

      function getTilesetForGid(gId) {
        for (let i = map.tilesets.length - 1; i >= 0; i--) {
          const tileset = map.tilesets[i];

          if (gId >= tileset.firstgid) {
            return tileset;
          }
        }
        return null; // Return null if no tileset is found
      }

      function getTileMapPosition(
        index,
        tileWidth,
        tileHeight,
        mapWidth,
        mapHeight
      ) {
        const column = index % mapWidth; // x position in tiles
        const row = Math.floor(index / mapHeight); // y position in tiles

        const x = column; // x position on tilemap
        const y = row; // y position on tilemap
        const xOff = mapX / tileWidth;
        const yOff = mapY / tileHeight;

        return { x: x + xOff, y: y + yOff };
      }

      const getChunkPosition = (position) => {
        const xOff = Math.floor(position.x / this.chunkDimensions.width);
        const yOff = Math.floor(position.y / this.chunkDimensions.height);

        return { xOff, yOff };
      };

      const tilesToAdd = [];

      // Keep track of the computed chunk positions to later add them to
      // chunk table
      let chunksToAdd = {};
      map.layers.forEach((layer) => {
        for (let i = 0; i < layer.data.length; i++) {
          const tileId = layer.data[i];
          const tileset = getTilesetForGid(tileId);

          if (!tileset) {
            continue;
          }

          // Get the tile_id
          const local_tileId = tileId - tileset.firstgid;
          const position = getTileMapPosition(
            i,
            tileset.tilewidth,
            tileset.tileheight,
            map.width,
            map.height
          );

          console.log(position);
          const chunkPos = getChunkPosition(position);

          if (tileId !== 0) {
            const key = `${chunkPos.xOff},${chunkPos.yOff}`;

            // Push data to be inserted into table_objects
            tilesToAdd.push({
              tileId: local_tileId,
              tileset: tileset.name,
              ...(tilesetProps[tileId] ? tilesetProps[tileId] : null),
              x: position.x,
              y: position.y,
              chunk: key,
            });

            // create map entry if not exists
            if (!chunksToAdd[key]) {
              chunksToAdd[key] = {
                xOff: chunkPos.xOff,
                yOff: chunkPos.yOff,
                data: [],
              };
            }
          }
        }
      });
  
      try {
        const tileTable = this.dexie.db.table(`${worldName}_objects`);
        const chunkTable = this.dexie.db.table(`${worldName}_chunks`);

        // if map is being rebuilt, destroy all associated entries that are currently tileTable
        // and destroy the chunkTable entry for the map.
        for (const c of Object.values(chunksToAdd)) {
          const { xOff, yOff } = c || {};
          const key = `${xOff},${yOff}`;

          const table = await chunkTable.get(key);

          if (table) {
            await tileTable.bulkDelete(table.data[0]);
            await chunkTable.delete(key);
          }
        }

        const ids = await tileTable.bulkAdd(tilesToAdd, { allKeys: true });

        // Map the generated IDs to their corresponding chunks
        ids.forEach((id, index) => {
          const position = tilesToAdd[index];
          const chunkPos = getChunkPosition(position);

          const key = `${chunkPos.xOff},${chunkPos.yOff}`;
          chunksToAdd[key].data.push(id);
        });

        // start adding data to TileTable
        for (const key in chunksToAdd) {
          const threshold = THRESHOLD;
          const { xOff, yOff, data: dataToAddToThisEntry } = chunksToAdd[key];

          const entry = await chunkTable
            .where("position")
            .equals(key)
            .toArray();

          const organizedData = [];
          // if entry doesnt exist  organzize the data andp ush
          if (entry.length === 0) {
            // Add remaining items in chunks if any are left after the first addition
            while (dataToAddToThisEntry.length > 0) {
              organizedData.push(dataToAddToThisEntry.splice(0, threshold));
            }

            // Entry doesn't exist, so add it with the new data

            await chunkTable.add({
              position: key,
              xOff,
              yOff,
              data: organizedData, // Wrapping the new data in an array
            });
          } else {
            const prevData = entry[0].data;

            // Add new data to the existing entry
            let lastArray = prevData[prevData.length - 1];

            if (Array.isArray(lastArray) && lastArray.length < threshold) {
              // If the last array exists and is not full, add to it
              lastArray.push(
                ...dataToAddToThisEntry.splice(0, threshold - lastArray.length)
              );
            }

            // Add remaining items in chunks if any are left after the first addition
            while (dataToAddToThisEntry.length > 0) {
              prevData.push(dataToAddToThisEntry.splice(0, threshold));
            }

            // Update the entry in the chunkTable with the modified data
            await chunkTable.update(key, {
              position: key,
              xOff,
              yOff,
              data: prevData,
            });
          }
        }
      } catch (e) {
        console.error("Error processing tiles:", e);
      }
    };

    // Convert each tile to table entry
    await processTiles(mapData)
      .then(async () => {
        console.log("Tiles processed and added to the Dexie database.");
        // Add this map to the table of converted maps to no longer convert this map on the next run.
      })
      .catch((error) => {
        console.error("Error processing tiles:", error);
      });
  }

  async deleteMap(filename) {
    const mapTable = this.dexie.db.table(filename);
    if (mapTable) {
      await mapTable.clear();
      const converted_maps = this.dexie.db.table("converted_maps");
      await converted_maps.delete(filename);
    }
  }
  async deleteTable(tableName) {
    const table = this.dexie.db.table(tableName);
    await table.delete();
  }
  async deleteDatabase() {
    this.dexie.db.delete();
    this.dexie.db.close();
  }

  destroy() {
    this.dexie.db.close();
    ConvertTiled.instance = undefined;
  }
}
