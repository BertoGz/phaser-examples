export default class MemoryMonitor {
    constructor(thresholdMB) {
      this.threshold = thresholdMB || 100; // Default threshold in megabytes
      this.isSupported = window.performance && window.performance.memory;
      this.updateInterval = null;
    }
  
    startMonitoring(intervalMs) {
      if (!this.isSupported) {
        console.error("Memory monitoring is not supported in this browser.");
        return;
      }
  
      intervalMs = intervalMs || 1000; // Default update interval in milliseconds
  
      this.updateInterval = setInterval(() => {
        const usedMemoryMB = window.performance.memory.usedJSHeapSize / (1024 * 1024);
  
        if (usedMemoryMB > this.threshold) {
          this.alertExceedMemoryUsage(usedMemoryMB);
        } else {
          this.alertMemoryUsage(usedMemoryMB);
        }
      }, intervalMs);
    }
  
    stopMonitoring() {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
    }
  
    alertExceedMemoryUsage(usedMemoryMB) {
      console.log(`Memory usage is ${usedMemoryMB.toFixed(2)} MB, exceeding the recommended threshold of ${this.threshold} MB. by ${usedMemoryMB.toFixed(2)-this.threshold} MB`);
    }
    alertMemoryUsage(usedMemoryMB) {
      console.log(`Memory usage is ${usedMemoryMB.toFixed(2)} MB`);
    }
  }
  
