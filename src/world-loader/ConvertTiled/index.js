import Dexie from "dexie";
import DexieSingleton from "../DexieSingleton";
const THRESHOLD = (100 * 100) / 1;

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
    }
    return ConvertTiled.instance;
  }
  /**
   * @description initializes the library
   */
  async init(config = { chunkResolution: undefined }) {
    if (!config.chunkResolution) {
      throw new Error("chunkResolution not specified in init");
      return;
    }
    this.chunkResolution = config.chunkResolution;
    //create initial schema for database
    await this.dexie.init();
  }
  /**
   *
   * @param {string} worldFile
   * @description converts a tiled world to database
   */
  async convertWorld(worldFile = "") {
    const worldName = getPathFileName(worldFile, ".world");

    const converted_worlds = this.dexie.db.table("converted_worlds");

    const objectTableSchema = "++id,[x+y],x,y,tileId,customProp,tileset,chunk";
    const chunkTableSchema = "position,xOff,yOff,data";

    const isWorldConverted = await converted_worlds
      .where("world_name")
      .equals(worldName)
      .toArray();

    // update the schema with new tables to represent world
    if (isWorldConverted.length == 0) {
      await this._addTable(`${worldName}_chunks`, chunkTableSchema);
      await this._addTable(`${worldName}_objects`, objectTableSchema);
      // add entry to list of converted worlds to not reconvert world again.
      await converted_worlds.add({ world_name: worldName });
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

    for (const map of maps) {
      await this._processMap(map, worldFile);
    }
  }
  async _processMap(map, worldFile) {
    const fileDirectory = getPathFileLocation(worldFile);
    const worldName = getPathFileName(worldFile, ".world");

    const { fileName, x, y, version } = map || {};

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

      await this._convertTiledMap(worldName, mapPath, x, y);
      await converted_maps.add({
        map_name: mapTableName,
        version,
      });
    };

    // if no map was found convert it
    // or if one has been found check its version number and convert if necessary.
    if (converted_map.length === 0) {
      await convert(version);
    } else {
      if (converted_map.length >= 1) {
        const { version: currentVersion } = converted_map[0] || {};

        if (currentVersion < version) {
          await converted_maps.delete(mapTableName);
          await convert(version);
        }
      }
    }
  }
  /**
   *
   * @param {*} mapName
   * @param {*} schema
   * @description creates a new schema in the database for the given map
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
  async _convertTiledMap(worldName, mapPath, originX = 0, originY = 0) {
    // Get map file
    const response = await fetch(mapPath);

    console.log(`Received response for ${mapPath}`, response);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const mapData = await response.json();

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

      function getTileWorldPosition(index, tileWidth, tileHeight, mapWidth) {
        // Calculate the x position
        const x = (index % mapWidth) * tileWidth;
        // Calculate the y position
        const y = Math.floor(index / mapWidth) * tileHeight;
        return { x: x + originX, y: y + originY };
      }

      const getChunkWorldPosition = (position) => {
        const xOff =
          Math.floor(position.x / this.chunkResolution) * this.chunkResolution;
        const yOff =
          Math.floor(position.y / this.chunkResolution) * this.chunkResolution;
        return { xOff, yOff };
      };

      const tilesToAdd = [];
      const layer = map.layers[0]; // Assuming only one layer for simplicity

      // Keep track of the computed chunk positions to later add them to
      // chunk table
      let chunksToAdd = {};

      for (let i = 0; i < layer.data.length; i++) {
        const tileId = layer.data[i];
        const tileset = getTilesetForGid(tileId);

        if (!tileset) {
          continue;
        }

        // Get the tile_id
        const local_tileId = tileId - tileset.firstgid;
        const position = getTileWorldPosition(
          i,
          tileset.tilewidth,
          tileset.tileheight,
          map.width
        );

        const chunkPos = getChunkWorldPosition(position);

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

          if (!chunksToAdd[key]) {
            chunksToAdd[key] = {
              xOff: chunkPos.xOff,
              yOff: chunkPos.yOff,
              data: [],
            };
          }
        }
      }

      try {
        const tileTable = this.dexie.db.table(`${worldName}_objects`);
        const chunkTable = this.dexie.db.table(`${worldName}_chunks`);

        // Insert tiles into table_objects and retrieve their IDs
        const ids = await tileTable.bulkAdd(tilesToAdd, { allKeys: true });

        // Map the generated IDs to their corresponding chunks
        ids.forEach((id, index) => {
          const position = tilesToAdd[index];
          const chunkPos = getChunkWorldPosition(position);

          const key = `${chunkPos.xOff},${chunkPos.yOff}`;
          chunksToAdd[key].data.push(id);
        });

        for (const key in chunksToAdd) {
          const threshold = THRESHOLD;
          const { xOff, yOff, data: dataToAddToThisEntry } = chunksToAdd[key];

          const entry = await chunkTable
            .where("position")
            .equals(key)
            .toArray();
          const organizedData = [];
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
    debugger;
    const mapTable = this.dexie.db.table(filename);
    if (mapTable) {
      debugger;
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
    debugger;
  }

  destroy() {
    this.dexie.db.close();
    ConvertTiled.instance = undefined;
  }
}
