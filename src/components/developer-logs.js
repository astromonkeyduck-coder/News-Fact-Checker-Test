/**
 * Richard's Developer Logs Component
 * Displays developer logs in a timeline format
 */

export async function initDeveloperLogs(container) {
  if (!container) return;
  
  try {
    // Show loading state
    container.innerHTML = `
      <div class="developer-logs-loading" style="padding: 2rem; text-align: center; color: rgba(255,255,255,0.7);">
        <div style="font-size: 1.2rem; margin-bottom: 1rem;">📝</div>
        <div>Loading developer logs...</div>
      </div>
    `;
    
    // Fetch logs
    const response = await fetch('/.netlify/functions/generate-developer-logs');
    if (!response.ok) {
      throw new Error(`Failed to fetch logs: ${response.status}`);
    }
    
    const logs = await response.json();
    
    if (!logs || logs.length === 0) {
      container.innerHTML = `
        <div class="developer-logs-empty" style="padding: 2rem; text-align: center; color: rgba(255,255,255,0.5);">
          <div>No developer logs available yet.</div>
        </div>
      `;
      return;
    }
    
    // Render logs in reverse chronological order (newest first)
    const logsHtml = logs.reverse().map((log, index) => {
      const isRecent = index < 5;
      return `
        <div class="developer-log-entry ${isRecent ? 'recent' : ''}" style="
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: ${isRecent ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0, 0, 0, 0.2)'};
          border-left: 3px solid ${isRecent ? '#3b82f6' : 'rgba(255,255,255,0.2)'};
          border-radius: 8px;
        ">
          <div class="log-date" style="
            font-size: 0.85rem;
            color: rgba(255,255,255,0.6);
            margin-bottom: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          ">${log.date}</div>
          <div class="log-entry" style="
            font-size: 1rem;
            line-height: 1.6;
            color: rgba(255,255,255,0.9);
          ">${log.entry}</div>
          ${log.commitCount > 1 ? `
            <div class="log-commits" style="
              margin-top: 1rem;
              padding-top: 1rem;
              border-top: 1px solid rgba(255,255,255,0.1);
              font-size: 0.85rem;
              color: rgba(255,255,255,0.5);
            ">
              <div style="margin-bottom: 0.5rem;">${log.commitCount} commits this day:</div>
              <ul style="list-style: none; padding: 0; margin: 0;">
                ${log.commits.map(c => `
                  <li style="margin: 0.25rem 0; font-family: 'Courier New', monospace;">
                    <span style="color: #3b82f6;">${c.hash}</span> ${c.message}
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
    
    container.innerHTML = `
      <div class="developer-logs-container">
        <div class="developer-logs-header" style="
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid rgba(59, 130, 246, 0.3);
        ">
          <h2 style="
            font-size: 2rem;
            font-weight: 700;
            color: #fff;
            margin: 0 0 0.5rem 0;
          ">Richard's Developer Logs</h2>
          <p style="
            font-size: 1rem;
            color: rgba(255,255,255,0.7);
            margin: 0;
          ">A chronological log of development updates and improvements</p>
        </div>
        <div class="developer-logs-timeline">
          ${logsHtml}
        </div>
      </div>
    `;
    
  } catch (error) {
    console.error('[Developer Logs] Error:', error);
    container.innerHTML = `
      <div class="developer-logs-error" style="padding: 2rem; text-align: center; color: rgba(255,100,100,0.8);">
        <div>Failed to load developer logs.</div>
        <div style="font-size: 0.85rem; margin-top: 0.5rem; color: rgba(255,255,255,0.5);">${error.message}</div>
      </div>
    `;
  }
}

