/**
 * Visualization Engine
 * Creates interactive charts, flowcharts, and infographics
 */

class VisualizationEngine {
    constructor() {
        this.init();
    }

    init() {
        // Initialize flowcharts
        this.initFlowcharts();
        
        // Initialize timelines
        this.initTimelines();
        
        // Initialize charts (if Chart.js is available)
        if (typeof Chart !== 'undefined') {
            this.initCharts();
        }
    }

    initFlowcharts() {
        document.querySelectorAll('.flowchart-container').forEach(container => {
            const steps = container.dataset.steps ? JSON.parse(container.dataset.steps) : [];
            if (steps.length === 0) return;

            const flowchart = document.createElement('div');
            flowchart.className = 'flowchart';

            steps.forEach((step, index) => {
                const stepEl = document.createElement('div');
                stepEl.className = 'flowchart-step';
                stepEl.innerHTML = `
                    <strong>${step.title || `Step ${index + 1}`}</strong>
                    ${step.description ? `<p>${step.description}</p>` : ''}
                `;
                flowchart.appendChild(stepEl);
            });

            container.appendChild(flowchart);
        });
    }

    initTimelines() {
        document.querySelectorAll('.timeline-container').forEach(container => {
            const events = container.dataset.events ? JSON.parse(container.dataset.events) : [];
            if (events.length === 0) return;

            const timeline = document.createElement('div');
            timeline.className = 'timeline';

            events.forEach(event => {
                const item = document.createElement('div');
                item.className = 'timeline-item';
                item.innerHTML = `
                    <div class="timeline-date">${event.date || ''}</div>
                    <div class="timeline-content">
                        <strong>${event.title || ''}</strong>
                        ${event.description ? `<p>${event.description}</p>` : ''}
                    </div>
                `;
                timeline.appendChild(item);
            });

            container.appendChild(timeline);
        });
    }

    initCharts() {
        document.querySelectorAll('.chart-container').forEach(container => {
            const chartData = container.dataset.chart ? JSON.parse(container.dataset.chart) : null;
            if (!chartData) return;

            const canvas = document.createElement('canvas');
            container.appendChild(canvas);

            const ctx = canvas.getContext('2d');
            new Chart(ctx, {
                type: chartData.type || 'bar',
                data: chartData.data || {},
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#ffffff'
                            }
                        }
                    },
                    scales: chartData.type !== 'pie' ? {
                        x: {
                            ticks: { color: '#ffffff' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        y: {
                            ticks: { color: '#ffffff' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        }
                    } : {}
                }
            });
        });
    }

    // Create a simple bar chart without Chart.js
    createSimpleBarChart(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const maxValue = Math.max(...data.map(d => d.value));
        const chart = document.createElement('div');
        chart.className = 'simple-bar-chart';
        chart.style.cssText = 'display: flex; align-items: flex-end; gap: 10px; height: 200px;';

        data.forEach(item => {
            const bar = document.createElement('div');
            const height = (item.value / maxValue) * 100;
            bar.style.cssText = `
                flex: 1;
                background: linear-gradient(to top, var(--color-primary), var(--color-secondary));
                height: ${height}%;
                border-radius: 4px 4px 0 0;
                display: flex;
                flex-direction: column;
                justify-content: flex-end;
                padding: 5px;
                min-height: 30px;
            `;
            bar.innerHTML = `
                <div style="color: white; font-size: 12px; font-weight: bold;">${item.value}</div>
                <div style="color: rgba(255,255,255,0.7); font-size: 10px; margin-top: 5px;">${item.label}</div>
            `;
            chart.appendChild(bar);
        });

        container.appendChild(chart);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new VisualizationEngine();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VisualizationEngine;
}
