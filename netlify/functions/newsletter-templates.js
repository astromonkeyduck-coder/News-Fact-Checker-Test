// Newsletter Templates API
// Handles saving, loading, listing, and deleting newsletter templates

// Load environment variables
if (process.env.NETLIFY_DEV || !process.env.RESEND_API_KEY) {
  try {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  } catch (e) {
    // dotenv not needed in production
  }
}

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle OPTIONS request for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // SECURITY: Require newsletter key with timing-safe comparison
  const newsletterKey = process.env.NEWSLETTER_KEY;
  const providedToken = event.queryStringParameters?.token || 
                       event.headers['x-admin-token'] || 
                       (event.body ? (() => {
                         try {
                           return JSON.parse(event.body || '{}').token;
                         } catch {
                           return null;
                         }
                       })() : null);
  
  // Timing-safe comparison to prevent timing attacks
  function secureCompare(a, b) {
    if (!a || !b || a.length !== b.length) {
      return false;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
  
  if (newsletterKey) {
    if (!providedToken || !secureCompare(newsletterKey, providedToken)) {
      // Log failed attempt (without exposing the token)
      console.log('[Security] Failed newsletter authentication attempt');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          error: 'Unauthorized - Newsletter key required',
          message: 'This endpoint requires newsletter authentication.'
        }),
      };
    }
  }

  try {
    const { getStore } = require("@netlify/blobs");
    const store = getStore({
      name: "newsletter-templates",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
    });

    // GET: List all templates, get a specific template, or get newsletter history
    if (event.httpMethod === 'GET') {
      const templateId = event.queryStringParameters?.id;
      const getHistory = event.queryStringParameters?.history === 'true';
      
      if (getHistory) {
        // Get newsletter send history
        try {
          const { getStore: getHistoryStore } = require("@netlify/blobs");
          const historyStore = getHistoryStore({
            name: "newsletter-data",
            siteID: process.env.NETLIFY_SITE_ID,
            token: process.env.NETLIFY_BLOB_READ_WRITE_TOKEN,
          });
          
          const newsletters = [];
          
          // 1. Get the history list (if it exists)
          try {
            const historyList = await historyStore.get("newsletter-history-list");
            if (historyList) {
              const parsed = JSON.parse(historyList);
              if (Array.isArray(parsed)) {
                // Fetch preview HTML for each newsletter in the list
                for (const newsletter of parsed) {
                  try {
                    // Try to get full entry with preview HTML
                    if (newsletter.id && newsletter.id.startsWith('newsletter-history-')) {
                      const fullEntry = await historyStore.get(newsletter.id, { type: "json" });
                      if (fullEntry && fullEntry.previewHtml) {
                        newsletter.previewHtml = fullEntry.previewHtml;
                      } else if (fullEntry && fullEntry.html) {
                        newsletter.previewHtml = fullEntry.html;
                      }
                    }
                  } catch (e) {
                    // Continue if we can't fetch preview
                  }
                }
                newsletters.push(...parsed);
              }
            }
          } catch (e) {
            console.log('No history list found or error parsing:', e.message);
          }
          
          // 2. Get last-send-time (for backwards compatibility with old sends)
          try {
            const lastSend = await historyStore.get("last-send-time", { type: "json" });
            if (lastSend && lastSend.timestamp && lastSend.subject) {
              // Check if it's already in the list
              const exists = newsletters.some(n => 
                n.timestamp === lastSend.timestamp && n.subject === lastSend.subject
              );
              if (!exists) {
                // Try to get preview HTML - check multiple possible fields
                let previewHtml = lastSend.previewHtml || lastSend.html || '';
                
                // If still empty, try to find it in a history entry
                if (!previewHtml || previewHtml.trim() === '') {
                  try {
                    // Look for a matching history entry
                    const { blobs } = await historyStore.list();
                    for (const blob of blobs) {
                      if (blob.key.startsWith('newsletter-history-')) {
                        const entry = await historyStore.get(blob.key, { type: "json" });
                        if (entry && entry.subject === lastSend.subject && entry.timestamp === lastSend.timestamp) {
                          previewHtml = entry.previewHtml || entry.html || previewHtml;
                          console.log(`Found preview HTML in history entry: ${blob.key}`);
                          break;
                        }
                      }
                    }
                  } catch (e) {
                    console.log('Error searching for preview HTML:', e.message);
                  }
                }
                
                // If still no previewHtml, try to get html from lastSend and create preview
                if ((!previewHtml || previewHtml.trim() === '') && lastSend.html) {
                  previewHtml = lastSend.html
                    .replace(/\{\{FULL_NAME\}\}/g, 'Preview User')
                    .replace(/\{\{FIRST_NAME\}\}/g, 'Preview')
                    .replace(/\{\{EMAIL_USERNAME\}\}/g, 'preview')
                    .replace(/\{\{\{UNSUBSCRIBE_URL\}\}\}/g, '#')
                    .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, '#');
                  console.log('Generated preview HTML from lastSend.html');
                }
                
                newsletters.push({
                  id: 'last-send-time',
                  subject: lastSend.subject,
                  timestamp: lastSend.timestamp,
                  emailsSent: lastSend.emailsSent || 0,
                  previewHtml: previewHtml || '', // Include preview HTML (empty string if not available)
                });
              }
            }
          } catch (e) {
            console.log('No last-send-time found or error:', e.message);
          }
          
          // 3. Search for individual newsletter history entries
          try {
            const { blobs } = await historyStore.list();
            for (const blob of blobs) {
              if (blob.key.startsWith('newsletter-history-')) {
                try {
                  const entry = await historyStore.get(blob.key, { type: "json" });
                  if (entry && entry.timestamp && entry.subject) {
                    // Check if it's already in the list
                    const exists = newsletters.some(n => 
                      n.id === blob.key || 
                      (n.timestamp === entry.timestamp && n.subject === entry.subject)
                    );
                    if (!exists) {
                      newsletters.push({
                        id: blob.key,
                        subject: entry.subject,
                        timestamp: entry.timestamp,
                        emailsSent: entry.emailsSent || 0,
                        previewHtml: entry.previewHtml || entry.html || '', // Include preview HTML
                      });
                    }
                  }
                } catch (e) {
                  console.log(`Error parsing history entry ${blob.key}:`, e.message);
                }
              }
            }
          } catch (e) {
            console.log('Error listing history entries:', e.message);
          }
          
          // Remove duplicates and sort by timestamp (newest first)
          const uniqueNewsletters = [];
          const seen = new Set();
          for (const newsletter of newsletters) {
            const key = `${newsletter.timestamp}-${newsletter.subject}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniqueNewsletters.push(newsletter);
            }
          }
          
          // 4. Add the DC shooting newsletter if it's missing (sent on 11/26/25)
          const dcShootingSubject = 'Noteworthy News: Washington D.C. National Guard Shooting Coverage';
          const hasDCShooting = uniqueNewsletters.some(n => 
            (n.subject && n.subject.includes('Washington D.C. National Guard Shooting')) ||
            (n.subject && n.subject.includes('Washington D.C. National Guard')) ||
            (n.subject && n.subject.includes('DC shooting')) ||
            (n.subject && n.subject.includes('D.C. shooting'))
          );
          
          if (!hasDCShooting) {
            // Check if we have the template - if template exists, newsletter was likely sent
            try {
              const { blobs } = await store.list();
              let dcTemplate = null;
              for (const blob of blobs) {
                const templateData = await store.get(blob.key);
                if (templateData) {
                  try {
                    const parsed = JSON.parse(templateData);
                    if (parsed.subject && (
                      parsed.subject.includes('Washington D.C. National Guard Shooting') ||
                      parsed.subject.includes('Washington D.C. National Guard') ||
                      parsed.name && parsed.name.includes('11/26/25') ||
                      parsed.name && parsed.name.includes('DC shooting')
                    )) {
                      dcTemplate = parsed;
                      break;
                    }
                  } catch (e) {
                    // Skip invalid templates
                  }
                }
              }
              
              if (dcTemplate) {
                // Add the newsletter to history
                // Use template's updatedAt as timestamp, or default to Nov 26, 2025
                const dcTimestamp = dcTemplate.updatedAt || dcTemplate.createdAt || '2025-11-26T12:00:00.000Z';
                uniqueNewsletters.push({
                  id: 'dc-shooting-newsletter-2025-11-26',
                  subject: dcTemplate.subject || dcShootingSubject,
                  timestamp: dcTimestamp,
                  emailsSent: 0, // Will show as "Sent to 0 subscribers" - can be updated later if we find the actual count
                  previewHtml: dcTemplate.html || '', // Include preview HTML
                });
                console.log('✅ Added newsletter to history from template');
              }
            } catch (e) {
              console.log('Error checking for DC template:', e.message);
            }
          }
          
          uniqueNewsletters.sort((a, b) => {
            const dateA = new Date(a.timestamp || 0);
            const dateB = new Date(b.timestamp || 0);
            return dateB - dateA;
          });
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ newsletters: uniqueNewsletters }),
          };
        } catch (error) {
          console.error('Error fetching newsletter history:', error);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ newsletters: [] }),
          };
        }
      } else if (templateId) {
        // Get specific template
        const templateData = await store.get(templateId);
        if (!templateData) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Template not found' }),
          };
        }
        
        // Parse the template data
        let template;
        try {
          template = typeof templateData === 'string' ? JSON.parse(templateData) : templateData;
        } catch (e) {
          console.error('Error parsing template data:', e.message);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Invalid template format' }),
          };
        }
        
        // Ensure template has all required fields
        if (!template.html && template.previewHtml) {
          template.html = template.previewHtml;
        }
        
        // Ensure html and subject exist
        if (!template.html) {
          console.error('Template missing html field:', templateId);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Template missing HTML content' }),
          };
        }
        
        if (!template.subject) {
          template.subject = template.name || 'Newsletter';
        }
        
        console.log('Returning template:', {
          id: template.id,
          name: template.name,
          hasSubject: !!template.subject,
          hasHtml: !!template.html,
          htmlLength: template.html?.length || 0
        });
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(template),
        };
      } else {
        // List all templates
        const { blobs } = await store.list();
        let templates = [];
        
        for (const blob of blobs) {
          const templateData = await store.get(blob.key);
          if (templateData) {
            try {
              const parsed = JSON.parse(templateData);
              // Use saved previewHtml if available, otherwise generate from html
              let previewHtml = parsed.previewHtml || '';
              if (!previewHtml && parsed.html) {
                // Generate preview HTML with placeholder values if not saved
                previewHtml = parsed.html
                  .replace(/\{\{FULL_NAME\}\}/g, 'Preview User')
                  .replace(/\{\{FIRST_NAME\}\}/g, 'Preview')
                  .replace(/\{\{EMAIL_USERNAME\}\}/g, 'preview')
                  .replace(/\{\{\{UNSUBSCRIBE_URL\}\}\}/g, '#')
                  .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, '#');
              }
              // Ensure html exists - use previewHtml if html is missing
              const html = parsed.html || parsed.previewHtml || '';
              const finalPreviewHtml = previewHtml || html;
              
              templates.push({
                id: blob.key,
                name: parsed.name || blob.key,
                subject: parsed.subject || '',
                createdAt: parsed.createdAt || blob.updatedAt,
                updatedAt: parsed.updatedAt || blob.updatedAt,
                previewHtml: finalPreviewHtml, // Include preview HTML with placeholders
                html: html, // Include full HTML for sending
                text: parsed.text || '', // Include text version
              });
            } catch (e) {
              // Skip invalid templates
            }
          }
        }
        
        // If no templates found, try to load from email templates directory
        if (templates.length === 0) {
          console.log('No templates in blob store, loading from email templates directory...');
          try {
            const path = require('path');
            // Try multiple possible paths
            const possiblePaths = [
              path.resolve(__dirname, '../../emails/templates'),
              path.resolve(process.cwd(), 'emails/templates'),
              path.join(__dirname, '../../emails/templates'),
            ];
            
            let templatesDir = null;
            const fs = require('fs');
            
            for (const dirPath of possiblePaths) {
              if (fs.existsSync(dirPath)) {
                templatesDir = dirPath;
                console.log(`Found templates directory at: ${dirPath}`);
                break;
              }
            }
            
            // Check if templates directory exists
            if (templatesDir && fs.existsSync(templatesDir)) {
              const templateFiles = fs.readdirSync(templatesDir).filter(f => 
                f.endsWith('.js') && f !== 'index.js'
              );
              console.log(`Found ${templateFiles.length} template files in directory: ${templatesDir}`);
              
              for (const file of templateFiles) {
                try {
                  const templatePath = path.join(templatesDir, file);
                  console.log(`Attempting to load template: ${templatePath}`);
                  
                  // Clear require cache to ensure fresh load
                  delete require.cache[require.resolve(templatePath)];
                  
                  const templateModule = require(templatePath);
                  const templateFn = templateModule.default || templateModule;
                  
                  if (typeof templateFn !== 'function') {
                    console.log(`Template ${file} is not a function, skipping`);
                    continue;
                  }
                  
                  if (typeof templateFn === 'function') {
                    // Generate sample data based on template type
                    const templateName = file.replace('.js', '').replace(/([A-Z])/g, ' $1').trim();
                    let sampleData = {};
                    let subject = `${templateName} - Noteworthy News`;
                    
                    // Generate appropriate sample data for each template type
                    const today = new Date();
                    const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                    
                    if (file.includes('BreakingNews')) {
                      sampleData = {
                        headline: 'Breaking: Major News Event',
                        dateline: dateStr + ' — Location',
                        shortSummary: 'This is a sample breaking news story summary.',
                        bodyBlocks: ['First paragraph of the breaking news story.', 'Second paragraph with more details.'],
                        ctaLabel: 'Read Full Story',
                        ctaUrl: '#',
                        fullName: 'Preview User',
                        unsubscribeUrl: '#'
                      };
                      subject = 'Breaking: Major News Event';
                    } else if (file.includes('DailyBriefing')) {
                      sampleData = {
                        date: dateStr,
                        fullName: 'Preview User',
                        topStory: {
                          headline: 'Top Story Headline',
                          summary: 'Summary of the top story for today.',
                          url: '#'
                        },
                        stories: [
                          { headline: 'Story 1', summary: 'Summary 1', url: '#' },
                          { headline: 'Story 2', summary: 'Summary 2', url: '#' },
                          { headline: 'Story 3', summary: 'Summary 3', url: '#' }
                        ],
                        unsubscribeUrl: '#'
                      };
                      subject = `Daily Briefing - ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
                    } else if (file.includes('WeeklyRoundup')) {
                      sampleData = {
                        weekOf: `Week of ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
                        fullName: 'Preview User',
                        topStories: [
                          { headline: 'Top Story 1', summary: 'Summary', url: '#' },
                          { headline: 'Top Story 2', summary: 'Summary', url: '#' }
                        ],
                        unsubscribeUrl: '#'
                      };
                      subject = `Weekly Roundup - Week of ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
                    } else if (file.includes('SpecialReport')) {
                      sampleData = {
                        title: 'Special Report: Important Topic',
                        fullName: 'Preview User',
                        introduction: 'This is a special report on an important topic.',
                        sections: [
                          { title: 'Section 1', content: 'Content for section 1.' },
                          { title: 'Section 2', content: 'Content for section 2.' }
                        ],
                        unsubscribeUrl: '#'
                      };
                      subject = 'Special Report: Important Topic';
                    } else if (file.includes('WeatherAlert')) {
                      sampleData = {
                        alertType: 'Severe Weather Warning',
                        location: 'Your Area',
                        fullName: 'Preview User',
                        message: 'This is a sample weather alert message.',
                        unsubscribeUrl: '#'
                      };
                      subject = 'Weather Alert: Severe Weather Warning';
                    } else if (file.includes('SecurityAlert')) {
                      sampleData = {
                        alertType: 'Security Notice',
                        fullName: 'Preview User',
                        message: 'This is a sample security alert message.',
                        unsubscribeUrl: '#'
                      };
                      subject = 'Security Alert: Important Notice';
                    } else if (file.includes('SubscriberWelcome')) {
                      sampleData = {
                        fullName: 'Preview User',
                        unsubscribeUrl: '#'
                      };
                      subject = 'Welcome to Noteworthy News!';
                    } else if (file.includes('Holiday')) {
                      sampleData = {
                        fullName: 'Preview User',
                        holidayName: file.includes('NewYear') ? 'New Year' : file.includes('Thanksgiving') ? 'Thanksgiving' : file.includes('Independence') ? 'Independence Day' : 'Holiday',
                        unsubscribeUrl: '#'
                      };
                      subject = `Happy ${file.includes('NewYear') ? 'New Year' : file.includes('Thanksgiving') ? 'Thanksgiving' : file.includes('Independence') ? 'Independence Day' : 'Holidays'} from Noteworthy News!`;
                    } else {
                      // Generic template - try with minimal data
                      sampleData = {
                        fullName: 'Preview User',
                        unsubscribeUrl: '#'
                      };
                      subject = `${templateName} - Noteworthy News`;
                    }
                    
                    // Generate HTML with sample data
                    let html;
                    try {
                      html = templateFn(sampleData);
                      if (!html || typeof html !== 'string' || html.trim().length === 0) {
                        console.error(`Template ${file} generated empty HTML`);
                        continue;
                      }
                    } catch (e) {
                      console.error(`Error generating HTML for template ${file}:`, e.message);
                      continue;
                    }
                    
                    const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
                    
                    // Create preview HTML (replace placeholders with preview values)
                    let previewHtml = html
                      .replace(/\{\{FULL_NAME\}\}/g, 'Preview User')
                      .replace(/\{\{FIRST_NAME\}\}/g, 'Preview')
                      .replace(/\{\{EMAIL_USERNAME\}\}/g, 'preview')
                      .replace(/\{\{\{UNSUBSCRIBE_URL\}\}\}/g, '#')
                      .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, '#');
                    
                    console.log(`✅ Generated HTML for ${file}: ${html.length} chars, preview: ${previewHtml.length} chars`);
                    
                    const templateId = `template-${file.replace('.js', '').toLowerCase()}`;
                    const now = new Date().toISOString();
                    
                    // Save to blob store for future use (include previewHtml for faster loading)
                    const templateData = {
                      id: templateId,
                      name: templateName,
                      subject: subject,
                      html: html,
                      text: text,
                      previewHtml: previewHtml, // Save preview HTML so we don't have to regenerate it
                      createdAt: now,
                      updatedAt: now,
                    };
                    await store.set(templateId, JSON.stringify(templateData));
                    
                    templates.push({
                      id: templateId,
                      name: templateName,
                      subject: subject,
                      createdAt: now,
                      updatedAt: now,
                      previewHtml: previewHtml,
                      html: html,
                      text: text,
                    });
                    console.log(`✅ Loaded template: ${templateName} (${templateId})`);
                  }
                } catch (e) {
                  console.log(`❌ Error loading template ${file}:`, e.message);
                }
              }
              console.log(`Total templates loaded from directory: ${templates.length}`);
            } else {
              console.log('Templates directory does not exist. Tried paths:', possiblePaths);
            }
          } catch (e) {
            console.error('Error loading templates from directory:', e.message);
            console.error('Stack trace:', e.stack);
            // Continue - return empty templates array rather than failing
          }
        } else {
          console.log(`Loaded ${templates.length} templates from blob store`);
        }
        
        // Sort by updatedAt (newest first)
        templates.sort((a, b) => {
          const dateA = new Date(a.updatedAt || 0);
          const dateB = new Date(b.updatedAt || 0);
          return dateB - dateA;
        });
        
        console.log(`Returning ${templates.length} templates to client`);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ templates }),
        };
      }
    }

    // POST: Save or update a template
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { id, name, subject, html, text } = body;
      
      if (!name || !subject) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Name and subject are required' }),
        };
      }
      
      const templateId = id || `template-${Date.now()}`;
      const templateData = {
        id: templateId,
        name,
        subject,
        html: html || '',
        text: text || '',
        createdAt: body.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      await store.set(templateId, JSON.stringify(templateData));
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          template: {
            id: templateId,
            name,
            subject,
            createdAt: templateData.createdAt,
            updatedAt: templateData.updatedAt,
          }
        }),
      };
    }

    // DELETE: Delete a template
    if (event.httpMethod === 'DELETE') {
      const templateId = event.queryStringParameters?.id;
      
      if (!templateId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Template ID is required' }),
        };
      }
      
      await store.delete(templateId);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Template deleted' }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };

  } catch (error) {
    console.error('Template API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
    };
  }
};

