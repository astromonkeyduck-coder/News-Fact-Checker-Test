// Performance Monitor for Mobile Optimization
class PerformanceMonitor {
    constructor() {
        this.fps = 0;
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.isMobile = window.innerWidth <= 768;
        
        if (this.isMobile) {
            this.startMonitoring();
        }
    }
    
    startMonitoring() {
        this.monitorFPS();
        this.monitorMemory();
        this.monitorBattery();
    }
    
    monitorFPS() {
        const measureFPS = () => {
            this.frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - this.lastTime >= 1000) {
                this.fps = this.frameCount;
                this.frameCount = 0;
                this.lastTime = currentTime;
                
                // Log performance issues
                if (this.fps < 30) {
                    console.warn(`Low FPS detected: ${this.fps}. Consider disabling more effects.`);
                }
            }
            
            requestAnimationFrame(measureFPS);
        };
        
        requestAnimationFrame(measureFPS);
    }
    
    monitorMemory() {
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
                const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);
                
                if (usedMB > 100) {
                    console.warn(`High memory usage: ${usedMB}MB / ${totalMB}MB`);
                }
            }, 5000);
        }
    }
    
    monitorBattery() {
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                battery.addEventListener('levelchange', () => {
                    if (battery.level < 0.2) {
                        console.warn('Low battery detected. Consider disabling effects.');
                    }
                });
            });
        }
    }
    
    getPerformanceReport() {
        return {
            fps: this.fps,
            isMobile: this.isMobile,
            userAgent: navigator.userAgent,
            screenSize: `${window.innerWidth}x${window.innerHeight}`,
            memory: 'memory' in performance ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
            } : null
        };
    }
}

// Initialize performance monitor
if (window.innerWidth <= 768) {
    window.performanceMonitor = new PerformanceMonitor();
}
