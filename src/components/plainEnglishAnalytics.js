/**
 * Plain English Analytics Summary Component
 * Transforms raw analytics data into human-readable summaries
 * 
 * Usage:
 *   import { renderPlainAnalyticsSummary } from './plainEnglishAnalytics.js';
 *   renderPlainAnalyticsSummary(analyticsData, logs);
 */

/**
 * Format a number with commas and rounding
 */
function formatNumber(num) {
    if (num < 1000) return num.toString();
    if (num < 1000000) {
        const rounded = Math.round(num / 100) * 100;
        return rounded.toLocaleString();
    }
    return `${(num / 1000000).toFixed(1)}M`;
}

/**
 * Format time duration in human-readable format
 */
function formatTime(seconds) {
    if (seconds < 60) {
        return `${Math.round(seconds)} seconds`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (secs === 0) {
        return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    }
    if (minutes === 0) {
        return `${secs} seconds`;
    }
    return `${minutes} min ${secs} sec`;
}

/**
 * Calculate week-over-week change
 */
function calculateWeekChange(currentLogs, previousLogs) {
    if (!previousLogs || previousLogs.length === 0) return null;
    
    const currentCount = currentLogs.length;
    const previousCount = previousLogs.length;
    
    if (previousCount === 0) return null;
    
    const change = ((currentCount - previousCount) / previousCount) * 100;
    return Math.round(change);
}

/**
 * Generate plain English summary from analytics data
 */
export function generatePlainAnalyticsSummary(stats, logs, previousWeekLogs = null) {
    const sentences = [];
    const paragraphs = [];
    
    // Calculate week-over-week change if previous data available
    const weekChange = previousWeekLogs ? calculateWeekChange(logs, previousWeekLogs) : null;
    
    // Main activity summary
    if (stats.pageViews > 0) {
        let visitText = '';
        if (stats.pageViews === 1) {
            visitText = '1 person visited';
        } else if (stats.pageViews < 10) {
            visitText = `${stats.pageViews} people visited`;
        } else {
            visitText = `around ${formatNumber(stats.pageViews)} people visited`;
        }
        
        // Add time context
        const now = new Date();
        const hour = now.getHours();
        let timeContext = '';
        if (hour >= 6 && hour < 12) timeContext = ' this morning';
        else if (hour >= 12 && hour < 18) timeContext = ' today';
        else if (hour >= 18 && hour < 22) timeContext = ' this evening';
        else timeContext = ' recently';
        
        let sentence = `${visitText}${timeContext}`;
        
        // Add week-over-week trend
        if (weekChange !== null && Math.abs(weekChange) > 5) {
            if (weekChange > 0) {
                sentence += ` — up roughly ${Math.abs(weekChange)}% from last week`;
            } else {
                sentence += ` — down about ${Math.abs(weekChange)}% from last week`;
            }
        }
        
        sentences.push(sentence + '.');
    }
    
    // Traffic sources
    if (logs && logs.length > 0) {
        const referrers = new Map();
        logs.forEach(log => {
            if (log.data && log.data.referrer && log.data.referrer !== 'unknown' && log.data.referrer !== 'direct') {
                const ref = log.data.referrer.toLowerCase();
                let source = 'another site';
                
                if (ref.includes('twitter.com') || ref.includes('x.com')) source = 'Twitter';
                else if (ref.includes('facebook.com')) source = 'Facebook';
                else if (ref.includes('reddit.com')) source = 'Reddit';
                else if (ref.includes('google.com') || ref.includes('google')) source = 'Google';
                else if (ref.includes('linkedin.com')) source = 'LinkedIn';
                else if (ref.includes('youtube.com')) source = 'YouTube';
                else if (ref.includes('instagram.com')) source = 'Instagram';
                
                referrers.set(source, (referrers.get(source) || 0) + 1);
            }
        });
        
        if (referrers.size > 0) {
            const topSources = Array.from(referrers.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 2);
            
            if (topSources.length > 0) {
                const topSource = topSources[0];
                let sourceText = '';
                if (topSources.length === 1) {
                    sourceText = `Most visitors came from ${topSource[0]}`;
                } else {
                    sourceText = `Most came from ${topSource[0]}`;
                    if (topSources[1]) {
                        sourceText += ` and ${topSources[1][0]}`;
                    }
                }
                sentences.push(sourceText + '.');
            }
        }
    }
    
    // Average time on site
    if (logs && logs.length > 0) {
        const timeSpent = [];
        logs.forEach(log => {
            if (log.data && log.data.timeOnPage) {
                timeSpent.push(log.data.timeOnPage);
            }
        });
        
        if (timeSpent.length > 0) {
            const avgTime = timeSpent.reduce((a, b) => a + b, 0) / timeSpent.length;
            sentences.push(`The average visit lasted ${formatTime(avgTime)}.`);
        }
    }
    
    // Bounce rate (people who left after one page)
    if (logs && logs.length > 0) {
        const singlePageVisits = logs.filter(log => 
            log.data && log.data.pageViews && log.data.pageViews === 1
        ).length;
        
        const bounceRate = singlePageVisits / logs.length;
        if (bounceRate > 0) {
            const stayedPercent = Math.round((1 - bounceRate) * 100);
            if (stayedPercent >= 50) {
                sentences.push(`About ${stayedPercent}% of visitors explored more than one page.`);
            } else {
                sentences.push(`About ${Math.round(bounceRate * 100)}% left after viewing just one page.`);
            }
        }
    }
    
    // Top pages
    if (logs && logs.length > 0) {
        const pages = new Map();
        logs.forEach(log => {
            if (log.data && log.data.path) {
                const path = log.data.path.replace(/^\//, '').replace(/\.html$/, '') || 'home';
                pages.set(path, (pages.get(path) || 0) + 1);
            }
        });
        
        if (pages.size > 0) {
            const topPage = Array.from(pages.entries())
                .sort((a, b) => b[1] - a[1])[0];
            
            if (topPage) {
                const pageName = topPage[0].charAt(0).toUpperCase() + topPage[0].slice(1).replace(/-/g, ' ');
                sentences.push(`The most popular page was "${pageName}".`);
            }
        }
    }
    
    // Additional activity highlights
    const highlights = [];
    
    if (stats.imagesGenerated > 0) {
        highlights.push(`${stats.imagesGenerated === 1 ? '1 image' : `${stats.imagesGenerated} images`} generated`);
    }
    
    if (stats.aiInteractions > 0) {
        highlights.push(`${stats.aiInteractions === 1 ? '1 conversation' : `${stats.aiInteractions} conversations`} with AI`);
    }
    
    if (stats.gameScores > 0) {
        highlights.push(`${stats.gameScores} game ${stats.gameScores === 1 ? 'score' : 'scores'} submitted`);
    }
    
    if (highlights.length > 0) {
        sentences.push(`Other activity: ${highlights.join(', ')}.`);
    }
    
    // Combine into paragraphs
    if (sentences.length > 0) {
        // First paragraph: main traffic info
        const mainParagraph = sentences.slice(0, Math.min(3, sentences.length)).join(' ');
        paragraphs.push(mainParagraph);
        
        // Second paragraph: additional insights
        if (sentences.length > 3) {
            paragraphs.push(sentences.slice(3).join(' '));
        }
    } else {
        paragraphs.push('No activity to report yet. Check back soon!');
    }
    
    return {
        summary: paragraphs,
        weekChange: weekChange,
        stats: stats
    };
}

/**
 * Render the plain English summary to the DOM
 */
export function renderPlainAnalyticsSummary(analyticsData, logs, previousWeekLogs = null) {
    const container = document.getElementById('analytics-summary');
    if (!container) {
        console.warn('analytics-summary container not found');
        return;
    }
    
    // Calculate stats from logs
    const stats = {
        pageViews: 0,
        imagesGenerated: 0,
        aiInteractions: 0,
        gameScores: 0,
        newsletterSignups: 0,
        comments: 0,
        uniqueIPs: new Set(),
        uniqueUsers: new Set(),
    };
    
    if (logs) {
        logs.forEach(log => {
            if (log.dataType === 'page-view') stats.pageViews++;
            if (log.dataType === 'ai-chat') stats.aiInteractions++;
            if (log.dataType === 'image-generation') stats.imagesGenerated++;
            if (log.dataType === 'game-score') stats.gameScores++;
            if (log.dataType === 'newsletter-signup') stats.newsletterSignups++;
            if (log.dataType === 'comment') stats.comments++;
            if (log.ip && log.ip !== 'unknown') stats.uniqueIPs.add(log.ip);
            if (log.userEmail) stats.uniqueUsers.add(log.userEmail);
        });
    }
    
    // Generate summary
    const result = generatePlainAnalyticsSummary(stats, logs, previousWeekLogs);
    
    // Fade out old content
    container.style.opacity = '0';
    container.style.transform = 'translateY(-10px)';
    
    setTimeout(() => {
        // Update content
        container.innerHTML = `
            <div class="analytics-summary-header">
                <h2>📊 What's Happening</h2>
                ${result.weekChange !== null ? `
                    <span class="trend-indicator ${result.weekChange > 0 ? 'trend-up' : 'trend-down'}">
                        ${result.weekChange > 0 ? '↑' : '↓'} ${Math.abs(result.weekChange)}%
                    </span>
                ` : ''}
            </div>
            <div class="analytics-summary-content">
                ${result.summary.map(para => `<p>${para}</p>`).join('')}
            </div>
        `;
        
        // Fade in new content
        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
    }, 150);
}

/**
 * Initialize the component (call this when page loads)
 */
export function initPlainAnalytics() {
    const container = document.getElementById('analytics-summary');
    if (!container) {
        // Create container if it doesn't exist
        const newContainer = document.createElement('section');
        newContainer.id = 'analytics-summary';
        newContainer.className = 'analytics-summary';
        
        // Try to insert after controls or at the top of dashboard
        const controls = document.querySelector('.controls');
        if (controls) {
            controls.after(newContainer);
        } else {
            document.body.insertBefore(newContainer, document.body.firstChild);
        }
    }
}


