const initialState = {
  didWarnGetPosition: false,
};
export default class GlobalVars {
  static instance;
  constructor() {
    if (!GlobalVars.instance) {
      GlobalVars.instance = this;
      this.state = { ...initialState };
    }

    return GlobalVars.instance;
  }
}
