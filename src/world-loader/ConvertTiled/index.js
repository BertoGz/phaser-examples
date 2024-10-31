import DexieSingleton from "../DexieSingleton";
const THRESHOLD = (100 * 100) / 1;
import EventEmitter from "../EventEmitter";
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
      this.eventEmitter = new EventEmitter();
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

    let totalConverted = 0;
    // process each map
    for (const [index, map] of maps.entries()) {
      await this._processMap(map, worldFile, index);
      totalConverted++;
      this.onProgress(Math.round((index / maps.length) * 100));
    }
  }
  /**
   * @description called by the api with progress %
   */
  onProgress = () => {};

  /**
   *
   * @param {*} map
   * @param {*} worldFile
   * @description checks to see if the map needs to be converted
   */
  async _processMap(map, worldFile) {
    const fileDirectory = getPathFileLocation(worldFile);
    const worldName = getPathFileName(worldFile, ".world");

    const { fileName, x: mapX, y: mapY, version } = map || {};

    const converted_maps = this.dexie.db.table("converted_maps");
    const mapTableName = `${worldName}-${fileName}`;

    // Check if this map has previously been converted
    const converted_map = await converted_maps
      .where("map_name")
      .equals(mapTableName)
      .first();

    const convert = async (version = 0) => {
      const mapPath = `${fileDirectory}/${fileName}`;

      // Process the map conversion
      await this._convertTiledMap(worldName, mapPath, mapX, mapY);
      console.log("completed1");
    };

    // Add a rollback entry in case of failure
    const startTransaction = async () => {
      await converted_maps.put({
        map_name: mapTableName,
        version: -1, // Use a negative version as a "processing" flag
        status: "processing",
      });
    };

    // Cleanup rollback entry if successful
    const completeTransaction = async (version) => {
      await converted_maps.put({
        map_name: mapTableName,
        version,
        status: "complete",
      });
    };

    // Roll back changes if conversion fails
    const rollbackTransaction = async () => {
      await converted_maps.delete(mapTableName);
    };

    try {
      // Start transaction by marking as "processing"

      // If no map was found, or if version has updated, perform conversion
      if (!converted_map) {
        await startTransaction();
        await convert(version);
        await completeTransaction(version);
      } else {
        const { version: currentVersion, status } = converted_map || {};

        if (currentVersion < version || status !== "complete") {
          await startTransaction();
          await convert(version);
          await completeTransaction(version);
        }
      }
    } catch (error) {
      // Roll back if there is an error during conversion
      await rollbackTransaction();
      console.error("Conversion failed, rolling back:", error);
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
    const response = await fetch(mapPath);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const mapData = await response.json();

    // Initialize chunk dimensions if not already set
    if (!this.chunkDimensions) {
      await this._updateWorldWithChunkDimensions(mapData);
    }

    const tileTable = this.dexie.db.table(`${worldName}_objects`);
    const chunkTable = this.dexie.db.table(`${worldName}_chunks`);
    let chunkPosition;
    try {
      // Start a transaction
      await this.dexie.db.transaction("rw", tileTable, chunkTable, async () => {
        const tilesToAdd = [];
        const chunksToAdd = {};

        const processTiles = async (map) => {
          const tilesetProps = {};
          map.tilesets.forEach((tileset) => {
            tilesetProps[tileset.name] = { image: tileset.name, tiles: {} };
            tileset.tiles?.forEach((tile) => {
              tilesetProps[tileset.name].tiles[tile.id] =
                tile.properties.reduce((acc, prop) => {
                  acc[prop.name] = prop.value;
                  return acc;
                }, {});
            });
          });

          const getTilesetForGid = (gId) => {
            for (let i = map.tilesets.length - 1; i >= 0; i--) {
              const tileset = map.tilesets[i];
              if (gId >= tileset.firstgid) return tileset;
            }
            return null;
          };

          const getTileMapPosition = (
            index,
            tileWidth,
            tileHeight,
            mapWidth,
            mapHeight
          ) => {
            const column = index % mapWidth;
            const row = Math.floor(index / mapHeight);
            const xOff = mapX / tileWidth;
            const yOff = mapY / tileHeight;
            return { x: column + xOff, y: row + yOff };
          };

          const getChunkPosition = (position) => {
            const xOff = Math.floor(position.x / this.chunkDimensions.width);
            const yOff = Math.floor(position.y / this.chunkDimensions.height);
            return { xOff, yOff };
          };

          map.layers.forEach((layer) => {
            layer.data.forEach((tileId, i) => {
              const tileset = getTilesetForGid(tileId);
              if (!tileset) return;

              const localTileId = tileId - tileset.firstgid;
              const position = getTileMapPosition(
                i,
                tileset.tilewidth,
                tileset.tileheight,
                map.width,
                map.height
              );
              const chunkPos = getChunkPosition(position);
              chunkPosition = chunkPos;
              const key = `${chunkPos.xOff},${chunkPos.yOff}`;

              tilesToAdd.push({
                tileId: localTileId,
                tileset: tileset.name,
                ...(tilesetProps[tileId] || {}),
                x: position.x,
                y: position.y,
                chunk: key,
              });

              if (!chunksToAdd[key]) {
                chunksToAdd[key] = {
                  xOff: chunkPos.xOff,
                  yOff: chunkPos.yOff,
                  data: [],
                };
              }
            });
          });
        };

        await processTiles(mapData);

        // Delete existing entries if any
        for (const { xOff, yOff } of Object.values(chunksToAdd)) {
          const key = `${xOff},${yOff}`;
          const existingChunk = await chunkTable.get(key);
          if (existingChunk) {
            await tileTable.bulkDelete(existingChunk.data[0]);
            await chunkTable.delete(key);
          }
        }

        // Add tiles in bulk
        const ids = await tileTable.bulkAdd(tilesToAdd, { allKeys: true });
        ids.forEach((id, index) => {
          const position = tilesToAdd[index];
          const chunkPos = chunkPosition;
          const key = `${chunkPos.xOff},${chunkPos.yOff}`;
          chunksToAdd[key].data.push(id);
        });

        // Organize and add chunks
        for (const key in chunksToAdd) {
          const { xOff, yOff, data: dataToAddToThisEntry } = chunksToAdd[key];
          const existingEntry = await chunkTable
            .where("position")
            .equals(key)
            .toArray();

          if (existingEntry.length === 0) {
            await chunkTable.add({
              position: key,
              xOff,
              yOff,
              data: [dataToAddToThisEntry],
            });
          } else {
            const prevData = existingEntry[0].data;
            prevData.push(...dataToAddToThisEntry);
            await chunkTable.update(key, { data: prevData });
          }
        }
      });

      console.log("Tiles processed and added to the Dexie database.");
    } catch (error) {
      console.error("Error processing tiles, rolling back changes:", error);
      // Dexie automatically rolls back all changes within the transaction on error
    }
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
