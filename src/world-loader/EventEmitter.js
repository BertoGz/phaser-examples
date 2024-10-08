export default class EventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  subscribe(eventType, listener) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(listener);

    // Return an unsubscribe function
    return () => {
      this.unsubscribe(eventType, listener);
    };
  }
  subscribeOnce(eventType, listener) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(() => {
      listener();
      this.unsubscribe(eventType, listener);
    });
  }

  unsubscribe(eventType, listener) {
    if (this.listeners.has(eventType)) {
      const listenersOfType = this.listeners.get(eventType);
      const index = listenersOfType.indexOf(listener);
      if (index !== -1) {
        listenersOfType.splice(index, 1);
      }
    }
  }

  notify(eventType, data) {
    if (this.listeners.has(eventType)) {
      const listenersOfType = this.listeners.get(eventType);
      for (const listener of listenersOfType) {
        listener(data);
      }
    }
  }
}
