/**
 * Get location from IP address using a free geolocation service
 * This is a simple wrapper that can be called from other functions
 */

async function getLocationFromIP(ip) {
  // Skip local/private IPs
  if (!ip || ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return { city: 'Local', region: '', country: 'Local', countryCode: '' };
  }

  try {
    // Use ipapi.co - free tier allows 1000 requests/day
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: {
        'User-Agent': 'Noteworthy News Analytics'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.error) {
        return { city: 'Unknown', region: '', country: 'Unknown', countryCode: '' };
      }
      return {
        city: data.city || 'Unknown',
        region: data.region || '',
        country: data.country_name || 'Unknown',
        countryCode: data.country_code || '',
        timezone: data.timezone || '',
        isp: data.org || ''
      };
    }
  } catch (error) {
    console.error('[Get Location] Error fetching location:', error);
  }

  // Fallback: try ip-api.com (free tier)
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,timezone,isp`);
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success') {
        return {
          city: data.city || 'Unknown',
          region: data.regionName || '',
          country: data.country || 'Unknown',
          countryCode: data.countryCode || '',
          timezone: data.timezone || '',
          isp: data.isp || ''
        };
      }
    }
  } catch (error) {
    console.error('[Get Location] Fallback error:', error);
  }

  return { city: 'Unknown', region: '', country: 'Unknown', countryCode: '' };
}

exports.getLocationFromIP = getLocationFromIP;

