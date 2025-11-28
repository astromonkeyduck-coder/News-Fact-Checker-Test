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

  // SECURITY: Require newsletter key
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
  
  if (newsletterKey && providedToken !== newsletterKey) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ 
        error: 'Unauthorized - Newsletter key required',
        message: 'This endpoint requires newsletter authentication.'
      }),
    };
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
          
          const historyList = await historyStore.get("newsletter-history-list");
          const newsletters = historyList ? JSON.parse(historyList) : [];
          
          // Sort by timestamp (newest first)
          newsletters.sort((a, b) => {
            const dateA = new Date(a.timestamp || 0);
            const dateB = new Date(b.timestamp || 0);
            return dateB - dateA;
          });
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ newsletters }),
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
        const template = await store.get(templateId);
        if (!template) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Template not found' }),
          };
        }
        
        return {
          statusCode: 200,
          headers,
          body: template,
        };
      } else {
        // List all templates
        const { blobs } = await store.list();
        const templates = [];
        
        for (const blob of blobs) {
          const templateData = await store.get(blob.key);
          if (templateData) {
            try {
              const parsed = JSON.parse(templateData);
              templates.push({
                id: blob.key,
                name: parsed.name || blob.key,
                subject: parsed.subject || '',
                createdAt: parsed.createdAt || blob.updatedAt,
                updatedAt: parsed.updatedAt || blob.updatedAt,
              });
            } catch (e) {
              // Skip invalid templates
            }
          }
        }
        
        // Sort by updatedAt (newest first)
        templates.sort((a, b) => {
          const dateA = new Date(a.updatedAt || 0);
          const dateB = new Date(b.updatedAt || 0);
          return dateB - dateA;
        });
        
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

