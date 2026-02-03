/**
 * Verification Tools
 * Fact-checking and source verification utilities
 */

class VerificationTool {
    constructor(containerId, toolType) {
        this.container = document.getElementById(containerId);
        this.toolType = toolType;
        this.init();
    }

    init() {
        if (!this.container) return;

        switch (this.toolType) {
            case 'source-checker':
                this.renderSourceChecker();
                break;
            case 'bias-detector':
                this.renderBiasDetector();
                break;
            case 'workflow-generator':
                this.renderWorkflowGenerator();
                break;
            default:
                console.warn('Unknown tool type:', this.toolType);
        }
    }

    renderSourceChecker() {
        this.container.innerHTML = `
            <div class="tool-header">
                <h3>Source Credibility Checker</h3>
                <p>Enter a source URL or name to check its credibility</p>
            </div>
            <input type="text" class="tool-input" id="source-input" placeholder="Enter source URL or name...">
            <button class="btn" id="check-source">Check Source</button>
            <div class="tool-output" id="source-output"></div>
        `;

        document.getElementById('check-source').addEventListener('click', () => {
            this.checkSource();
        });

        document.getElementById('source-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.checkSource();
            }
        });
    }

    checkSource() {
        const input = document.getElementById('source-input').value.trim();
        const output = document.getElementById('source-output');

        if (!input) {
            output.innerHTML = '<p style="color: var(--color-warning);">Please enter a source to check.</p>';
            return;
        }

        output.innerHTML = '<p>Analyzing source...</p>';

        // Simulate analysis (in real implementation, this would call an API)
        setTimeout(() => {
            const results = this.analyzeSource(input);
            this.displaySourceResults(results, output);
        }, 1000);
    }

    analyzeSource(source) {
        // This is a simplified analysis - in production, this would use real APIs
        const sourceLower = source.toLowerCase();
        const results = {
            credibility: 'medium',
            factors: []
        };

        // Check for known credible sources
        const credibleDomains = ['edu', 'gov', 'org', 'reuters', 'ap', 'bbc', 'npr'];
        const hasCredibleDomain = credibleDomains.some(domain => sourceLower.includes(domain));
        
        if (hasCredibleDomain) {
            results.credibility = 'high';
            results.factors.push('Domain suggests institutional or established news source');
        }

        // Check for red flags
        const redFlags = ['blog', 'opinion', 'unverified', 'rumor'];
        const hasRedFlags = redFlags.some(flag => sourceLower.includes(flag));
        
        if (hasRedFlags) {
            results.credibility = 'low';
            results.factors.push('Contains indicators of unverified or opinion-based content');
        }

        // Additional checks
        if (source.includes('http')) {
            results.factors.push('Has a web presence');
        }

        if (!results.factors.length) {
            results.factors.push('Unable to determine credibility automatically. Verify manually using multiple sources.');
        }

        return results;
    }

    displaySourceResults(results, output) {
        const credibilityColors = {
            high: 'var(--color-secondary)',
            medium: 'var(--color-warning)',
            low: 'var(--color-danger)'
        };

        const credibilityLabels = {
            high: 'High Credibility',
            medium: 'Medium Credibility',
            low: 'Low Credibility'
        };

        output.innerHTML = `
            <div class="tool-result-item" style="border-left-color: ${credibilityColors[results.credibility]}">
                <strong>Credibility: ${credibilityLabels[results.credibility]}</strong>
            </div>
            <div style="margin-top: var(--spacing-md);">
                <strong>Factors:</strong>
                <ul style="margin-top: var(--spacing-sm);">
                    ${results.factors.map(factor => `<li>${factor}</li>`).join('')}
                </ul>
            </div>
            <div style="margin-top: var(--spacing-md); padding: var(--spacing-sm); background: rgba(74, 144, 226, 0.1); border-radius: var(--radius-sm);">
                <strong>Recommendation:</strong> Always verify information using multiple independent sources, especially for important claims.
            </div>
        `;
    }

    renderBiasDetector() {
        this.container.innerHTML = `
            <div class="tool-header">
                <h3>Bias Detection Tool</h3>
                <p>Paste article text to analyze potential bias</p>
            </div>
            <textarea class="tool-input" id="bias-input" rows="5" placeholder="Paste article text here..."></textarea>
            <button class="btn" id="detect-bias">Detect Bias</button>
            <div class="tool-output" id="bias-output"></div>
        `;

        document.getElementById('detect-bias').addEventListener('click', () => {
            this.detectBias();
        });
    }

    detectBias() {
        const input = document.getElementById('bias-input').value.trim();
        const output = document.getElementById('bias-output');

        if (!input || input.length < 50) {
            output.innerHTML = '<p style="color: var(--color-warning);">Please enter at least 50 characters of text to analyze.</p>';
            return;
        }

        output.innerHTML = '<p>Analyzing text for bias indicators...</p>';

        setTimeout(() => {
            const results = this.analyzeBias(input);
            this.displayBiasResults(results, output);
        }, 1500);
    }

    analyzeBias(text) {
        const textLower = text.toLowerCase();
        const results = {
            biasLevel: 'moderate',
            indicators: [],
            suggestions: []
        };

        // Check for loaded language
        const loadedWords = ['obviously', 'clearly', 'undoubtedly', 'everyone knows', 'no one can deny'];
        const foundLoaded = loadedWords.filter(word => textLower.includes(word));
        if (foundLoaded.length > 0) {
            results.indicators.push(`Loaded language detected: "${foundLoaded[0]}"`);
            results.suggestions.push('Be cautious of absolute statements and emotional language');
        }

        // Check for one-sided arguments
        const balanceWords = ['however', 'on the other hand', 'alternatively', 'some argue'];
        const hasBalance = balanceWords.some(word => textLower.includes(word));
        if (!hasBalance) {
            results.indicators.push('Limited presentation of alternative viewpoints');
            results.suggestions.push('Look for articles that present multiple perspectives');
        }

        // Check for attribution
        const hasQuotes = (text.match(/"/g) || []).length >= 2;
        if (!hasQuotes) {
            results.indicators.push('Limited use of direct quotes or source attribution');
            results.suggestions.push('Credible articles typically include quotes from sources');
        }

        if (results.indicators.length === 0) {
            results.biasLevel = 'low';
            results.indicators.push('No obvious bias indicators detected');
            results.suggestions.push('Continue to verify information through multiple sources');
        } else if (results.indicators.length >= 3) {
            results.biasLevel = 'high';
        }

        return results;
    }

    displayBiasResults(results, output) {
        const biasColors = {
            low: 'var(--color-secondary)',
            moderate: 'var(--color-warning)',
            high: 'var(--color-danger)'
        };

        output.innerHTML = `
            <div class="tool-result-item" style="border-left-color: ${biasColors[results.biasLevel]}">
                <strong>Bias Level: ${results.biasLevel.charAt(0).toUpperCase() + results.biasLevel.slice(1)}</strong>
            </div>
            <div style="margin-top: var(--spacing-md);">
                <strong>Indicators Found:</strong>
                <ul style="margin-top: var(--spacing-sm);">
                    ${results.indicators.map(indicator => `<li>${indicator}</li>`).join('')}
                </ul>
            </div>
            <div style="margin-top: var(--spacing-md);">
                <strong>Suggestions:</strong>
                <ul style="margin-top: var(--spacing-sm);">
                    ${results.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    renderWorkflowGenerator() {
        this.container.innerHTML = `
            <div class="tool-header">
                <h3>Fact-Checking Workflow Generator</h3>
                <p>Generate a personalized fact-checking workflow</p>
            </div>
            <button class="btn" id="generate-workflow">Generate Workflow</button>
            <div class="tool-output" id="workflow-output"></div>
        `;

        document.getElementById('generate-workflow').addEventListener('click', () => {
            this.generateWorkflow();
        });
    }

    generateWorkflow() {
        const output = document.getElementById('workflow-output');
        const steps = [
            {
                title: 'Initial Assessment',
                description: 'Read the entire article carefully. Note the headline, author, publication date, and any claims made.'
            },
            {
                title: 'Source Verification',
                description: 'Check the credibility of the source. Look for author credentials, publication history, and potential biases.'
            },
            {
                title: 'Cross-Reference',
                description: 'Search for the same story on multiple independent news sources. Compare how different outlets report the same event.'
            },
            {
                title: 'Check Primary Sources',
                description: 'If the article references studies, reports, or official statements, try to find and read the original sources.'
            },
            {
                title: 'Image/Video Verification',
                description: 'If the article includes images or videos, use reverse image search to verify they are authentic and not taken out of context.'
            },
            {
                title: 'Expert Consultation',
                description: 'For complex topics, consult with subject matter experts or fact-checking organizations.'
            },
            {
                title: 'Final Assessment',
                description: 'Synthesize all information gathered. Determine if the claims are verified, unverified, or debunked.'
            }
        ];

        let workflowHTML = '<div class="flowchart">';
        steps.forEach((step, index) => {
            workflowHTML += `
                <div class="flowchart-step">
                    <strong>Step ${index + 1}: ${step.title}</strong>
                    <p>${step.description}</p>
                </div>
            `;
        });
        workflowHTML += '</div>';

        output.innerHTML = workflowHTML;
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VerificationTool;
}
