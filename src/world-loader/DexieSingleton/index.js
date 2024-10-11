import Dexie from "dexie";

const DB_NAME = "tiledDatabase";

export default class DexieSingleton {
  static instance;
  constructor() {
    if (!DexieSingleton.instance) {
      DexieSingleton.instance = this;
      this.db = new Dexie(DB_NAME);
      this.dbName = DB_NAME;
    }
    return DexieSingleton.instance;
  }
  async init() {
    if (this.db.verno < 1) {
      const databaseExists = await Dexie.exists(this.dbName);
      if (!databaseExists) {
        await this.db.version(1).stores({
          converted_maps: "map_name,version",
          converted_worlds: "world_name,version",
        });
      } else {
        if (!this.db.isOpen()) {
          await this.db.open();
        }
      }
    }
  }
  upgrade(params) {}
}