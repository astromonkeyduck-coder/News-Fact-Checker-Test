/**
 * SkeletonCard Component - Loading placeholder
 */

/**
 * Render skeleton card
 */
export function renderSkeletonCard(): string {
  return `
    <article 
      class="feed-skeleton-card"
      style="
        min-height: 360px;
        padding: 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: grid;
        grid-template-rows: auto 1fr auto;
        gap: 1rem;
      "
    >
      <!-- Header Skeleton -->
      <div style="display: flex; gap: 0.75rem;">
        <div 
          style="
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.1);
            animation: pulse 1.5s ease-in-out infinite;
          "
        ></div>
        <div style="flex: 1;">
          <div 
            style="
              width: 150px;
              height: 16px;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 4px;
              margin-bottom: 0.5rem;
              animation: pulse 1.5s ease-in-out infinite;
            "
          ></div>
          <div 
            style="
              width: 100px;
              height: 14px;
              background: rgba(255, 255, 255, 0.08);
              border-radius: 4px;
              animation: pulse 1.5s ease-in-out infinite;
            "
          ></div>
        </div>
      </div>
      
      <!-- Content Skeleton -->
      <div>
        <div 
          style="
            width: 100%;
            height: 16px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            margin-bottom: 0.5rem;
            animation: pulse 1.5s ease-in-out infinite;
          "
        ></div>
        <div 
          style="
            width: 90%;
            height: 16px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            margin-bottom: 0.5rem;
            animation: pulse 1.5s ease-in-out infinite;
          "
        ></div>
        <div 
          style="
            width: 70%;
            height: 16px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 4px;
            animation: pulse 1.5s ease-in-out infinite;
          "
        ></div>
      </div>
      
      <!-- Action Bar Skeleton -->
      <div style="display: flex; gap: 1rem;">
        ${[1, 2, 3, 4].map(() => `
          <div 
            style="
              width: 60px;
              height: 20px;
              background: rgba(255, 255, 255, 0.08);
              border-radius: 4px;
              animation: pulse 1.5s ease-in-out infinite;
            "
          ></div>
        `).join('')}
      </div>
    </article>
    
    <style>
      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }
    </style>
  `;
}

