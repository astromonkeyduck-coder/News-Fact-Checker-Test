/**
 * CIA Mission Globe - CDN Version (No build step required)
 * Uses CDN links for globe.gl and three.js
 */

// Load dependencies from CDN
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Load CSS
function loadCSS(href) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

class CiaMissionGlobe {
  constructor(containerId = 'cia-globe-container') {
    this.containerId = containerId;
    this.globeInstance = null;
    this.animationFrameId = null;
    this.activeOp = null;
    this.t = 0;
    this.coveragePoints = [];
    
    this.loadDependencies().then(() => this.init());
  }

  async loadDependencies() {
    // Load Three.js first (required by globe.gl)
    await loadScript('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js');
    
    // Load globe.gl
    await loadScript('https://cdn.jsdelivr.net/npm/globe.gl@2.32.0/dist/globe.gl.min.js');
    
    // Load CSS
    loadCSS('/src/styles/ciaGlobe.css');
    
    // Extract locations from posts
    this.coveragePoints = await this.extractLocationsFromPosts();
    
    if (this.coveragePoints.length === 0) {
      // Fallback to default points if no posts found
      this.coveragePoints = [
        { id: "nyc-incident", lat: 40.7128, lng: -74.0060, location: "New York, USA", headline: "High-rise fire near Midtown", timestamp: "2025-11-21T18:32:00Z" },
        { id: "kyiv-strike", lat: 50.4501, lng: 30.5234, location: "Kyiv, Ukraine", headline: "Explosions reported in central Kyiv", timestamp: "2025-11-23T03:10:00Z" },
        { id: "buenos-aires-blast", lat: -34.6037, lng: -58.3816, location: "Buenos Aires, Argentina", headline: "Industrial-area explosion in Ezeiza", timestamp: "2025-11-20T14:05:00Z" },
        { id: "la-fire", lat: 34.0522, lng: -118.2437, location: "Los Angeles, USA", headline: "Large structure fire downtown", timestamp: "2025-11-19T09:47:00Z" }
      ];
    }
    
    this.activeOp = this.coveragePoints[0] || null;
  }

  // Get coordinates for city, state, or country
  getLocationCoordinates(locationName) {
    // First try city/state mapping
    const cityMap = this.getCityCoordinates(locationName);
    if (cityMap) return cityMap;
    
    // Then try country mapping
    return this.getCountryCoordinates(locationName);
  }

  // Get all city map keys for searching
  getAllCityKeys() {
    return Object.keys(this.getCityMap());
  }

  // City and state name to coordinates mapping
  getCityMap() {
    return {
      // US Cities
      'Albuquerque': { lat: 35.0844, lng: -106.6504 },
      'Albuquerque, N.M': { lat: 35.0844, lng: -106.6504 },
      'Albuquerque, New Mexico': { lat: 35.0844, lng: -106.6504 },
      'Anchorage': { lat: 61.2181, lng: -149.9003 },
      'Anchorage, Alaska': { lat: 61.2181, lng: -149.9003 },
      'Annapolis': { lat: 38.9784, lng: -76.4922 },
      'Annapolis, Maryland': { lat: 38.9784, lng: -76.4922 },
      'Atlanta': { lat: 33.7490, lng: -84.3880 },
      'Atlanta, Georgia': { lat: 33.7490, lng: -84.3880 },
      'Austin': { lat: 30.2672, lng: -97.7431 },
      'Austin, Texas': { lat: 30.2672, lng: -97.7431 },
      'Baltimore': { lat: 39.2904, lng: -76.6122 },
      'Baltimore, Maryland': { lat: 39.2904, lng: -76.6122 },
      'Baton Rouge': { lat: 30.4515, lng: -91.1871 },
      'Baton Rouge, Louisiana': { lat: 30.4515, lng: -91.1871 },
      'Boulder': { lat: 40.0150, lng: -105.2705 },
      'Boulder, Colorado': { lat: 40.0150, lng: -105.2705 },
      'Chicago': { lat: 41.8781, lng: -87.6298 },
      'Chicago, Illinois': { lat: 41.8781, lng: -87.6298 },
      'Cincinnati': { lat: 39.1031, lng: -84.5120 },
      'Cincinnati, Ohio': { lat: 39.1031, lng: -84.5120 },
      'Cleveland': { lat: 41.4993, lng: -81.6944 },
      'Cleveland, Ohio': { lat: 41.4993, lng: -81.6944 },
      'Dallas': { lat: 32.7767, lng: -96.7970 },
      'Dallas, Texas': { lat: 32.7767, lng: -96.7970 },
      'Dallas, TX': { lat: 32.7767, lng: -96.7970 },
      'Denver': { lat: 39.7392, lng: -104.9903 },
      'Denver, Colorado': { lat: 39.7392, lng: -104.9903 },
      'Des Moines': { lat: 41.5868, lng: -93.6250 },
      'Des Moines, Iowa': { lat: 41.5868, lng: -93.6250 },
      'El Paso': { lat: 31.7619, lng: -106.4850 },
      'El Paso, Texas': { lat: 31.7619, lng: -106.4850 },
      'Fort Worth': { lat: 32.7555, lng: -97.3308 },
      'Fort Worth, Texas': { lat: 32.7555, lng: -97.3308 },
      'Houston': { lat: 29.7604, lng: -95.3698 },
      'Houston, Texas': { lat: 29.7604, lng: -95.3698 },
      'Las Vegas': { lat: 36.1699, lng: -115.1398 },
      'Las Vegas, Nevada': { lat: 36.1699, lng: -115.1398 },
      'Los Angeles': { lat: 34.0522, lng: -118.2437 },
      'Los Angeles, California': { lat: 34.0522, lng: -118.2437 },
      'Miami': { lat: 25.7617, lng: -80.1918 },
      'Miami, Florida': { lat: 25.7617, lng: -80.1918 },
      'Miami, FL': { lat: 25.7617, lng: -80.1918 },
      'New York': { lat: 40.7128, lng: -74.0060 },
      'New York City': { lat: 40.7128, lng: -74.0060 },
      'New York, NY': { lat: 40.7128, lng: -74.0060 },
      'New York City, New York': { lat: 40.7128, lng: -74.0060 },
      'Philadelphia': { lat: 39.9526, lng: -75.1652 },
      'Philadelphia, Pennsylvania': { lat: 39.9526, lng: -75.1652 },
      'Phoenix': { lat: 33.4484, lng: -112.0740 },
      'Phoenix, Arizona': { lat: 33.4484, lng: -112.0740 },
      'San Antonio': { lat: 29.4241, lng: -98.4936 },
      'San Antonio, Texas': { lat: 29.4241, lng: -98.4936 },
      'San Diego': { lat: 32.7157, lng: -117.1611 },
      'San Diego, California': { lat: 32.7157, lng: -117.1611 },
      'San Francisco': { lat: 37.7749, lng: -122.4194 },
      'San Francisco, California': { lat: 37.7749, lng: -122.4194 },
      'Seattle': { lat: 47.6062, lng: -122.3321 },
      'Seattle, Washington': { lat: 47.6062, lng: -122.3321 },
      // International Cities
      'Bangkok': { lat: 13.7563, lng: 100.5018 },
      'Bangkok, Thailand': { lat: 13.7563, lng: 100.5018 },
      'Bogotá': { lat: 4.7110, lng: -74.0721 },
      'Bogotá, Colombia': { lat: 4.7110, lng: -74.0721 },
      'Buenos Aires': { lat: -34.6037, lng: -58.3816 },
      'Buenos Aires, Argentina': { lat: -34.6037, lng: -58.3816 },
      'Dublin': { lat: 53.3498, lng: -6.2603 },
      'Dublin, Ireland': { lat: 53.3498, lng: -6.2603 },
      'Gaza': { lat: 31.3547, lng: 34.3088 },
      'Gaza, Palestine': { lat: 31.3547, lng: 34.3088 },
      'Istanbul': { lat: 41.0082, lng: 28.9784 },
      'Istanbul, Turkey': { lat: 41.0082, lng: 28.9784 },
      'Jakarta': { lat: -6.2088, lng: 106.8456 },
      'Jakarta, Indonesia': { lat: -6.2088, lng: 106.8456 },
      'Jerusalem': { lat: 31.7683, lng: 35.2137 },
      'Jerusalem, Israel': { lat: 31.7683, lng: 35.2137 },
      'Kyiv': { lat: 50.4501, lng: 30.5234 },
      'Kyiv, Ukraine': { lat: 50.4501, lng: 30.5234 },
      'London': { lat: 51.5074, lng: -0.1278 },
      'London, England': { lat: 51.5074, lng: -0.1278 },
      'Madrid': { lat: 40.4168, lng: -3.7038 },
      'Madrid, Spain': { lat: 40.4168, lng: -3.7038 },
      'Manila': { lat: 14.5995, lng: 120.9842 },
      'Manila, Philippines': { lat: 14.5995, lng: 120.9842 },
      'Mexico City': { lat: 19.4326, lng: -99.1332 },
      'Mexico City, Mexico': { lat: 19.4326, lng: -99.1332 },
      'Moscow': { lat: 55.7558, lng: 37.6173 },
      'Moscow, Russia': { lat: 55.7558, lng: 37.6173 },
      'Paris': { lat: 48.8566, lng: 2.3522 },
      'Paris, France': { lat: 48.8566, lng: 2.3522 },
      'Rome': { lat: 41.9028, lng: 12.4964 },
      'Rome, Italy': { lat: 41.9028, lng: 12.4964 },
      'Sydney': { lat: -33.8688, lng: 151.2093 },
      'Sydney, Australia': { lat: -33.8688, lng: 151.2093 },
      'Tehran': { lat: 35.6892, lng: 51.3890 },
      'Tehran, Iran': { lat: 35.6892, lng: 51.3890 },
      'Tel Aviv': { lat: 32.0853, lng: 34.7818 },
      'Tel Aviv, Israel': { lat: 32.0853, lng: 34.7818 },
      // Additional US Cities
      'Alene, Idaho': { lat: 47.6730, lng: -116.7804 },
      'Anaconda, Montana': { lat: 46.1286, lng: -112.9428 },
      'Andersen County, South Carolina': { lat: 34.5200, lng: -82.6500 },
      'Athens, Georgia': { lat: 33.9519, lng: -83.3576 },
      'Athens, Ohio': { lat: 39.3292, lng: -82.1013 },
      'Auburn, Alabama': { lat: 32.6099, lng: -85.4808 },
      'Ballymena, Northern Ireland': { lat: 54.8636, lng: -6.2765 },
      'Balıkesir, Turkey': { lat: 39.6484, lng: 27.8826 },
      'Belgorod, Russia': { lat: 50.6107, lng: 36.5802 },
      'Bethesda, Maryland': { lat: 38.9847, lng: -77.0947 },
      'Black River, St. Elizabeth': { lat: 18.0167, lng: -77.8500 },
      'Bladensburg, Maryland': { lat: 38.9393, lng: -76.9339 },
      'Bosasso, Puntland': { lat: 11.2842, lng: 49.1816 },
      'Box Elder County, Utah': { lat: 41.5167, lng: -112.0500 },
      'Brevard County, Florida': { lat: 28.2644, lng: -80.6014 },
      'Broadview, IL': { lat: 41.8639, lng: -87.8534 },
      'Brooklyn Park, Minnesota': { lat: 45.0941, lng: -93.3563 },
      'Bucksnort, Tennessee': { lat: 35.8000, lng: -87.5000 },
      'Cadereyta Jiménez, Mexico': { lat: 25.5833, lng: -100.0000 },
      'Cambridgeshire, England': { lat: 52.2053, lng: 0.1218 },
      'Carbondale, Kansas': { lat: 37.2953, lng: -95.6900 },
      'Carlow, Ireland': { lat: 52.8361, lng: -6.9264 },
      'Catalonia, Spain': { lat: 41.5912, lng: 1.5209 },
      'Chapel Hill, North Carolina': { lat: 35.9132, lng: -79.0558 },
      'Charlottesville, Virginia': { lat: 38.0293, lng: -78.4767 },
      'Chattanooga, Tennessee': { lat: 35.0456, lng: -85.3097 },
      'Chino Hills, Southern California': { lat: 33.9898, lng: -117.7326 },
      'Chuluota, Florida': { lat: 28.6419, lng: -81.1234 },
      'Clayton, Missouri': { lat: 38.6420, lng: -90.3237 },
      'Clearwater, FL': { lat: 27.9659, lng: -82.8001 },
      'Clearwater, Florida': { lat: 27.9659, lng: -82.8001 },
      'Concord, North Carolina': { lat: 35.4088, lng: -80.5795 },
      'Copake, New York': { lat: 42.1037, lng: -73.5501 },
      'Cornella, Spain': { lat: 41.3572, lng: 2.0700 },
      'Cypress, Texas': { lat: 29.9691, lng: -95.6972 },
      'Danville, Virginia': { lat: 36.5860, lng: -79.3950 },
      'Davao, Philippines': { lat: 7.1907, lng: 125.4553 },
      'Daytona Beach, Florida': { lat: 29.2108, lng: -81.0228 },
      'East Palestine, Ohio': { lat: 40.8339, lng: -80.5403 },
      'Edinburgh, Scotland': { lat: 55.9533, lng: -3.1883 },
      'El Segundo, California': { lat: 33.9192, lng: -118.4165 },
      'Enterprise, Alabama': { lat: 31.3152, lng: -85.8552 },
      'Erie, Pennsylvania': { lat: 42.1292, lng: -80.0851 },
      'Escondido, California': { lat: 33.1192, lng: -117.0864 },
      'Falmouth, Massachusetts': { lat: 41.5515, lng: -70.6081 },
      'Fayetteville, North Carolina': { lat: 35.0527, lng: -78.8784 },
      'Florence, Italy': { lat: 43.7696, lng: 11.2558 },
      'Fort Lauderdale, Florida': { lat: 26.1224, lng: -80.1373 },
      'Fort Myers, Florida': { lat: 26.6406, lng: -81.8723 },
      'Fort Pierce, Florida': { lat: 27.4467, lng: -80.3256 },
      'Fort Wayne, Indiana': { lat: 41.0793, lng: -85.1394 },
      'Fredericton, Canada': { lat: 45.9636, lng: -66.6431 },
      'Freiburg, Breisgau': { lat: 47.9990, lng: 7.8421 },
      'Fresno, California': { lat: 36.7378, lng: -119.7871 },
      'Gainesville, Florida': { lat: 29.6516, lng: -82.3248 },
      'Galveston, Texas': { lat: 29.3013, lng: -94.7977 },
      'Geelong, Victoria': { lat: -38.1499, lng: 144.3617 },
      'Genoa, Italy': { lat: 44.4056, lng: 8.9463 },
      'Glenwood, Iowa': { lat: 41.0467, lng: -95.7428 },
      'Golden, Colorado': { lat: 39.7555, lng: -105.2211 },
      'Grand Blanc, Michigan': { lat: 42.9275, lng: -83.6245 },
      'Grand Prairie, Texas': { lat: 32.7459, lng: -97.0033 },
      'Grand Rapids, Michigan': { lat: 42.9634, lng: -85.6681 },
      'Green Bay, Wisconsin': { lat: 44.5192, lng: -88.0198 },
      'Greensboro, North Carolina': { lat: 36.0726, lng: -79.7920 },
      'Greenville, Texas': { lat: 33.1384, lng: -96.1108 },
      'Guatemala City, Guatemala': { lat: 14.6349, lng: -90.5069 },
      'Halifax, Nova Scotia': { lat: 44.6488, lng: -63.5752 },
      'Hamburg, Germany': { lat: 53.5511, lng: 9.9937 },
      'Hamilton County, Iowa': { lat: 40.7500, lng: -93.7500 },
      'Harnett County, North Carolina': { lat: 35.3681, lng: -78.8694 },
      'Harris County, Texas': { lat: 29.7604, lng: -95.3698 },
      'Hartford, Connecticut': { lat: 41.7658, lng: -72.6734 },
      'Havana, Cuba': { lat: 23.1136, lng: -82.3666 },
      'Helensburgh, Scotland': { lat: 56.0026, lng: -4.7337 },
      'Hermiston, Oregon': { lat: 45.8404, lng: -119.2895 },
      'Hillsboro, Oregon': { lat: 45.5229, lng: -122.9898 },
      'Hiroshima, Japan': { lat: 34.3853, lng: 132.4553 },
      'Hobart, Tasmania': { lat: -42.8821, lng: 147.3272 },
      'Hollywood, Florida': { lat: 26.0112, lng: -80.1495 },
      'Honolulu, Hawaii': { lat: 21.3099, lng: -157.8581 },
      'Hounslow, England': { lat: 51.4684, lng: -0.3600 },
      'Huntington Beach, California': { lat: 33.6595, lng: -117.9988 },
      'Indianapolis, Indiana': { lat: 39.7684, lng: -86.1581 },
      'Invercargill, New Zealand': { lat: -46.4132, lng: 168.3538 },
      'Irbil, Iraq': { lat: 36.1911, lng: 44.0092 },
      'Islamabad, Pakistan': { lat: 33.6844, lng: 73.0479 },
      'Jalalabad, Afghanistan': { lat: 34.4265, lng: 70.4515 },
      'Jeddah, Saudi Arabia': { lat: 21.4858, lng: 39.1925 },
      'Johannesburg, South Africa': { lat: -26.2041, lng: 28.0473 },
      'Juneau, Alaska': { lat: 58.3019, lng: -134.4197 },
      'Kabul, Afghanistan': { lat: 34.5553, lng: 69.2075 },
      'Kamchatka, Russia': { lat: 53.0194, lng: 158.6506 },
      'Kamchatsky, Russia': { lat: 53.0194, lng: 158.6506 },
      'Kansas City, Kansas': { lat: 39.1142, lng: -94.6275 },
      'Kansas City, Missouri': { lat: 39.0997, lng: -94.5786 },
      'Kennesaw, Georgia': { lat: 34.0234, lng: -84.6155 },
      'Kharkiv, Ukraine': { lat: 49.9935, lng: 36.2304 },
      'Lagos, Nigeria': { lat: 6.5244, lng: 3.3792 },
      'Lake Ariel, Pennsylvania': { lat: 41.4545, lng: -75.3838 },
      'Lake Wales, Florida': { lat: 27.9014, lng: -81.5859 },
      'Larnaca, Cyprus': { lat: 34.9167, lng: 33.6333 },
      'Las Cruces, New Mexico': { lat: 32.3199, lng: -106.7637 },
      'Lavaur, France': { lat: 43.6981, lng: 1.8186 },
      'Lebanon, Oregon': { lat: 44.5365, lng: -122.9070 },
      'Leicester, England': { lat: 52.6369, lng: -1.1398 },
      'Lexington, Kentucky': { lat: 38.0406, lng: -84.5037 },
      'Lima, Peru': { lat: -12.0464, lng: -77.0428 },
      'Little River, South Carolina': { lat: 33.8732, lng: -78.6142 },
      'Liverpool, England': { lat: 53.4084, lng: -2.9916 },
      'Long Beach, California': { lat: 33.7701, lng: -118.1937 },
      'Louisville, Kentucky': { lat: 38.2527, lng: -85.7585 },
      'Lubbock, Texas': { lat: 33.5779, lng: -101.8552 },
      'Makhachkala, Dagestan': { lat: 42.9833, lng: 47.4833 },
      'Makkah, Saudi Arabia': { lat: 21.3891, lng: 39.8579 },
      'Mandeville, Jamaica': { lat: 18.0417, lng: -77.5075 },
      'Manhattan, New York': { lat: 40.7831, lng: -73.9712 },
      'Maple Grove, Minnesota': { lat: 45.0725, lng: -93.4558 },
      'Marbella, Spain': { lat: 36.5102, lng: -4.8860 },
      'Mariupol, Ukraine': { lat: 47.0966, lng: 37.5434 },
      'Marseille, France': { lat: 43.2965, lng: 5.3698 },
      'McAllen, Texas': { lat: 26.2034, lng: -98.2300 },
      'Melbourne, Australia': { lat: -37.8136, lng: 144.9631 },
      'Memphis, Tennessee': { lat: 35.1495, lng: -90.0490 },
      'Merseyside, England': { lat: 53.4084, lng: -2.9916 },
      'Miami Beach, Florida': { lat: 25.7907, lng: -80.1300 },
      'Milan, Italy': { lat: 45.4642, lng: 9.1900 },
      'Milwaukee, Wisconsin': { lat: 43.0389, lng: -87.9065 },
      'Minneapolis, Minnesota': { lat: 44.9778, lng: -93.2650 },
      'Mobile, Alabama': { lat: 30.6954, lng: -88.0399 },
      'Mogadishu, Somalia': { lat: 2.0469, lng: 45.3182 },
      'Moncton, New Brunswick': { lat: 46.0878, lng: -64.7782 },
      'Monroe County, New York': { lat: 43.1548, lng: -77.6156 },
      'Montreal, Canada': { lat: 45.5017, lng: -73.5673 },
      'Mount Juliet, Tennessee': { lat: 36.2001, lng: -86.5186 },
      'Muncie, Indiana': { lat: 40.1934, lng: -85.3864 },
      'Munich, Germany': { lat: 48.1351, lng: 11.5820 },
      'Murfreesboro, Tennessee': { lat: 35.8456, lng: -86.3903 },
      'Nantes, France': { lat: 47.2184, lng: -1.5536 },
      'Naples, Florida': { lat: 26.1420, lng: -81.7948 },
      'Nashville, Tennessee': { lat: 36.1627, lng: -86.7816 },
      'Nashua, New Hampshire': { lat: 42.7654, lng: -71.4676 },
      'Nassau County, New York': { lat: 40.7262, lng: -73.5800 },
      'New Brunswick, Canada': { lat: 46.5653, lng: -66.4619 },
      'New Delhi, India': { lat: 28.6139, lng: 77.2090 },
      'New Haven, Connecticut': { lat: 41.3083, lng: -72.9279 },
      'New Orleans, Louisiana': { lat: 29.9511, lng: -90.0715 },
      'Newark, New Jersey': { lat: 40.7357, lng: -74.1724 },
      'Newcastle, England': { lat: 54.9783, lng: -1.6178 },
      'Norfolk, Virginia': { lat: 36.8468, lng: -76.2852 },
      'North Las Vegas, Nevada': { lat: 36.1989, lng: -115.1175 },
      'North Platte, Nebraska': { lat: 41.1239, lng: -100.7654 },
      'Odessa, Ukraine': { lat: 46.4825, lng: 30.7233 },
      'Oklahoma City, Oklahoma': { lat: 35.4676, lng: -97.5164 },
      'Olympia, Washington': { lat: 47.0379, lng: -122.9007 },
      'Orlando, Florida': { lat: 28.5383, lng: -81.3792 },
      'Oslo, Norway': { lat: 59.9139, lng: 10.7522 },
      'Ottawa, Canada': { lat: 45.4215, lng: -75.6972 },
      'Oxford, England': { lat: 51.7520, lng: -1.2577 },
      'Paducah, Kentucky': { lat: 37.0834, lng: -88.6001 },
      'Palmdale, California': { lat: 34.5794, lng: -118.1165 },
      'Panama City, Florida': { lat: 30.1588, lng: -85.6602 },
      'Paterson, New Jersey': { lat: 40.9168, lng: -74.1718 },
      'Pensacola, Florida': { lat: 30.4213, lng: -87.2169 },
      'Pittsburgh, Pennsylvania': { lat: 40.4406, lng: -79.9959 },
      'Portland, Oregon': { lat: 45.5152, lng: -122.6784 },
      'Prague, Czech Republic': { lat: 50.0755, lng: 14.4378 },
      'Pretoria, South Africa': { lat: -25.7479, lng: 28.2293 },
      'Prince George, British Columbia': { lat: 53.9166, lng: -122.7494 },
      'Providence, Rhode Island': { lat: 41.8240, lng: -71.4128 },
      'Pueblo, Colorado': { lat: 38.2544, lng: -104.6091 },
      'Pune, India': { lat: 18.5204, lng: 73.8567 },
      'Quebec City, Canada': { lat: 46.8139, lng: -71.2080 },
      'Queens, New York': { lat: 40.7282, lng: -73.7949 },
      'Quito, Ecuador': { lat: -0.1807, lng: -78.4678 },
      'Raleigh, North Carolina': { lat: 35.7796, lng: -78.6382 },
      'Rapid City, South Dakota': { lat: 43.0750, lng: -103.2020 },
      'Reading, Pennsylvania': { lat: 40.3356, lng: -75.9269 },
      'Recife, Brazil': { lat: -8.0476, lng: -34.8770 },
      'Reno, Nevada': { lat: 39.5296, lng: -119.8138 },
      'Richmond, Virginia': { lat: 37.5407, lng: -77.4360 },
      'Rio de Janeiro, Brazil': { lat: -22.9068, lng: -43.1729 },
      'Riyadh, Saudi Arabia': { lat: 24.7136, lng: 46.6753 },
      'Rochester, New York': { lat: 43.1566, lng: -77.6088 },
      'Rockford, Illinois': { lat: 42.2711, lng: -89.0940 },
      'Sacramento, California': { lat: 38.5816, lng: -121.4944 },
      'Salem, Massachusetts': { lat: 42.5195, lng: -70.8967 },
      'Salt Lake City, Utah': { lat: 40.7608, lng: -111.8910 },
      'San Jose, California': { lat: 37.3382, lng: -121.8863 },
      'San Juan, Puerto Rico': { lat: 18.4655, lng: -66.1057 },
      'San Luis Potosí, Mexico': { lat: 22.1565, lng: -100.9855 },
      'Sanford, Florida': { lat: 28.8028, lng: -81.2690 },
      'Santa Fe, New Mexico': { lat: 35.6870, lng: -105.9378 },
      'Santiago, Chile': { lat: -33.4489, lng: -70.6693 },
      'Santo Domingo, Dominican Republic': { lat: 18.4861, lng: -69.9312 },
      'São Paulo, Brazil': { lat: -23.5505, lng: -46.6333 },
      'Savannah, Georgia': { lat: 32.0809, lng: -81.0912 },
      'Scottsdale, Arizona': { lat: 33.4942, lng: -111.9261 },
      'Sheffield, England': { lat: 53.3811, lng: -1.4701 },
      'Shenzhen, China': { lat: 22.5431, lng: 114.0579 },
      'Shreveport, Louisiana': { lat: 32.5252, lng: -93.7502 },
      'Simferopol, Crimea': { lat: 44.9521, lng: 34.1024 },
      'Sioux City, Iowa': { lat: 42.4969, lng: -96.4044 },
      'Sofia, Bulgaria': { lat: 42.6977, lng: 23.3219 },
      'Spokane, Washington': { lat: 47.6588, lng: -117.4260 },
      'Springfield, Missouri': { lat: 37.2089, lng: -93.2923 },
      'St. Augustine, Florida': { lat: 29.9012, lng: -81.3124 },
      'St. Elizabeth, Jamaica': { lat: 18.0167, lng: -77.8500 },
      'Susquehanna County, Pennsylvania': { lat: 41.8214, lng: -75.8008 },
      'Swidnik, Poland': { lat: 51.2194, lng: 22.6961 },
      'Tacoma, Washington': { lat: 47.2529, lng: -122.4443 },
      'Taif, Saudi Arabia': { lat: 21.2703, lng: 40.4158 },
      'Tampa, Florida': { lat: 27.9506, lng: -82.4572 },
      'Tampere, Finland': { lat: 61.4978, lng: 23.7610 },
      'Tateyama City Coast, Chiba': { lat: 35.0167, lng: 139.8667 },
      'Taylortown, North Carolina': { lat: 35.2135, lng: -79.4920 },
      'The Bronx, New York': { lat: 40.8448, lng: -73.8648 },
      'Traverse City, Michigan': { lat: 44.7631, lng: -85.6206 },
      'Tucson, Arizona': { lat: 32.2226, lng: -110.9747 },
      'Tulsa, Oklahoma': { lat: 36.1540, lng: -95.9928 },
      'Uppsala, Sweden': { lat: 59.8586, lng: 17.6389 },
      'Valdosta, Georgia': { lat: 30.8327, lng: -83.2785 },
      'Vancouver, British Columbia': { lat: 49.2827, lng: -123.1207 },
      'Vero Beach, Florida': { lat: 27.6386, lng: -80.3973 },
      'Villahermosa, Mexico': { lat: 17.9892, lng: -92.9477 },
      'Virginia Beach, VA': { lat: 36.8529, lng: -75.9780 },
      'Visayas, Philippines': { lat: 11.0000, lng: 123.0000 },
      'Walton, Kentucky': { lat: 38.8667, lng: -84.6100 },
      'Waterbury, Connecticut': { lat: 41.5582, lng: -73.0515 },
      'Wayne, Michigan': { lat: 42.2814, lng: -83.3863 },
      'West Valley City, Utah': { lat: 40.6916, lng: -112.0011 },
      'Wichita Falls, Texas': { lat: 33.9137, lng: -98.4934 },
      'Williamstown, New Jersey': { lat: 39.6862, lng: -74.9952 },
      'Wilmington, NC': { lat: 34.2257, lng: -77.9447 },
      'Wilson County, Tennessee': { lat: 36.2089, lng: -86.2911 },
      'Wolf Point, Montana': { lat: 48.0906, lng: -105.6406 },
      'York County, Pennsylvania': { lat: 39.9626, lng: -76.7277 },
      // Additional International
      'Al Hudaydah, Yemen': { lat: 14.7978, lng: 42.9545 },
      'Amman, Jordan': { lat: 31.9539, lng: 35.9106 },
      'Bavaria, Germany': { lat: 48.7904, lng: 11.4979 },
      'Devenish, Fermanagh': { lat: 54.3500, lng: -7.8000 },
      'Dodge City, Kansas': { lat: 37.7528, lng: -100.0171 },
      'Doha, Qatar': { lat: 25.2854, lng: 51.5310 },
      'Hawaii, Island': { lat: 19.8968, lng: -155.5828 },
      'Makhachkala, Dagestan': { lat: 42.9833, lng: 47.4833 },
    };
  }

  // City and state name to coordinates mapping (wrapper function)
  getCityCoordinates(locationName) {
    const cityMap = this.getCityMap();
    
    // Try exact match first
    if (cityMap[locationName]) {
      return cityMap[locationName];
    }
    
    // Try case-insensitive match
    const locationNameLower = locationName.toLowerCase();
    for (const [key, coords] of Object.entries(cityMap)) {
      if (key.toLowerCase() === locationNameLower) {
        return coords;
      }
    }
    
    return null;
  }

  // Country name to coordinates mapping (from geography game)
  getCountryCoordinates(countryName) {
    const countryMap = {
      'China': { lat: 35.8617, lng: 104.1954 },
      'India': { lat: 20.5937, lng: 78.9629 },
      'United States': { lat: 37.0902, lng: -95.7129 },
      'USA': { lat: 37.0902, lng: -95.7129 },
      'US': { lat: 37.0902, lng: -95.7129 },
      'America': { lat: 37.0902, lng: -95.7129 },
      'Indonesia': { lat: -0.7893, lng: 113.9213 },
      'Pakistan': { lat: 30.3753, lng: 69.3451 },
      'Brazil': { lat: -14.2350, lng: -51.9253 },
      'Bangladesh': { lat: 23.6850, lng: 90.3563 },
      'Russia': { lat: 61.5240, lng: 105.3188 },
      'Mexico': { lat: 23.6345, lng: -102.5528 },
      'Japan': { lat: 36.2048, lng: 138.2529 },
      'Philippines': { lat: 12.8797, lng: 121.7740 },
      'Egypt': { lat: 26.8206, lng: 30.8025 },
      'Ethiopia': { lat: 9.1450, lng: 38.7667 },
      'Vietnam': { lat: 14.0583, lng: 108.2772 },
      'Democratic Republic of the Congo': { lat: -4.0383, lng: 21.7587 },
      'Iran': { lat: 32.4279, lng: 53.6880 },
      'Türkiye': { lat: 38.9637, lng: 35.2433 },
      'Turkey': { lat: 38.9637, lng: 35.2433 },
      'Germany': { lat: 51.1657, lng: 10.4515 },
      'Thailand': { lat: 15.8700, lng: 100.9925 },
      'United Kingdom': { lat: 55.3781, lng: -3.4360 },
      'UK': { lat: 55.3781, lng: -3.4360 },
      'France': { lat: 46.2276, lng: 2.2137 },
      'Italy': { lat: 41.8719, lng: 12.5674 },
      'Spain': { lat: 40.4637, lng: -3.7492 },
      'Canada': { lat: 56.1304, lng: -106.3468 },
      'Australia': { lat: -25.2744, lng: 133.7751 },
      'South Korea': { lat: 35.9078, lng: 127.7669 },
      'Argentina': { lat: -38.4161, lng: -63.6167 },
      'South Africa': { lat: -30.5595, lng: 22.9375 },
      'Ukraine': { lat: 48.3794, lng: 31.1656 },
      'Poland': { lat: 51.9194, lng: 19.1451 },
      'Iraq': { lat: 33.2232, lng: 43.6793 },
      'Afghanistan': { lat: 33.9391, lng: 67.7100 },
      'Saudi Arabia': { lat: 23.8859, lng: 45.0792 },
      'Uzbekistan': { lat: 41.3775, lng: 64.5853 },
      'Peru': { lat: -9.1900, lng: -75.0152 },
      'Malaysia': { lat: 4.2105, lng: 101.9758 },
      'Angola': { lat: -11.2027, lng: 17.8739 },
      'Mozambique': { lat: -18.6657, lng: 35.5296 },
      'Ghana': { lat: 7.9465, lng: -1.0232 },
      'Yemen': { lat: 15.5527, lng: 48.5164 },
      'Nepal': { lat: 28.3949, lng: 84.1240 },
      'Nigeria': { lat: 9.0820, lng: 8.6753 },
      'Venezuela': { lat: 6.4238, lng: -66.5897 }
    };

    // Try exact match first
    if (countryMap[countryName]) {
      return countryMap[countryName];
    }

    // Try case-insensitive match
    const countryNameLower = countryName.toLowerCase();
    for (const [key, coords] of Object.entries(countryMap)) {
      if (key.toLowerCase() === countryNameLower) {
        return coords;
      }
    }

    return null;
  }

  // Extract location (city, state, or country) from post text
  extractLocationFromPost(post) {
    const text = (post.text || post.story || post.title || '').toLowerCase();
    
    // First try to extract city names (more specific)
    const city = this.extractCityFromPost(post);
    if (city) return city;
    
    // Then try country names
    return this.extractCountryFromPost(post);
  }

  // Extract city names from post text
  extractCityFromPost(post) {
    const text = (post.text || post.story || post.title || '').toLowerCase();
    
    // Get all city keys from the city map by checking a dummy call structure
    // We'll search through common city name patterns
    const cityNames = [
      // US Cities
      'albuquerque', 'anchorage', 'annapolis', 'atlanta', 'austin', 'baltimore',
      'baton rouge', 'boulder', 'chicago', 'cincinnati', 'cleveland', 'dallas',
      'denver', 'des moines', 'el paso', 'fort worth', 'houston', 'las vegas',
      'los angeles', 'miami', 'new york', 'philadelphia', 'phoenix', 'san antonio',
      'san diego', 'san francisco', 'seattle', 'alene', 'anaconda', 'athens',
      'auburn', 'ballymena', 'balıkesir', 'belgorod', 'bethesda', 'black river',
      'bladensburg', 'bosasso', 'bucksnort', 'cadereyta', 'cambridgeshire', 'carbondale',
      'carlow', 'catalonia', 'chapel hill', 'charlottesville', 'chattanooga', 'chino hills',
      'chuluota', 'clayton', 'clearwater', 'concord', 'copake', 'cornella', 'cypress',
      'danville', 'davao', 'daytona beach', 'east palestine', 'edinburgh', 'el segundo',
      'enterprise', 'erie', 'escondido', 'falmouth', 'fayetteville', 'florence',
      'fort lauderdale', 'fort myers', 'fort pierce', 'fort wayne', 'fredericton',
      'freiburg', 'fresno', 'gainesville', 'galveston', 'geelong', 'genoa', 'glenwood',
      'golden', 'grand blanc', 'grand prairie', 'grand rapids', 'green bay', 'greensboro',
      'greenville', 'guatemala city', 'halifax', 'hamburg', 'hartford', 'havana',
      'helensburgh', 'hermiston', 'hillsboro', 'hiroshima', 'hobart', 'hollywood',
      'honolulu', 'hounslow', 'huntington beach', 'indianapolis', 'invercargill',
      'irbil', 'islamabad', 'jalalabad', 'jeddah', 'johannesburg', 'juneau', 'kabul',
      'kamchatka', 'kamchatsky', 'kansas city', 'kennesaw', 'kharkiv', 'lagos',
      'lake ariel', 'lake wales', 'larnaca', 'las cruces', 'lavaur', 'lebanon',
      'leicester', 'lexington', 'lima', 'little river', 'liverpool', 'long beach',
      'louisville', 'lubbock', 'makhachkala', 'makkah', 'mandeville', 'manhattan',
      'maple grove', 'marbella', 'mariupol', 'marseille', 'mcallen', 'melbourne',
      'memphis', 'merseyside', 'miami beach', 'milan', 'milwaukee', 'minneapolis',
      'mobile', 'mogadishu', 'moncton', 'monroe county', 'montreal', 'mount juliet',
      'muncie', 'munich', 'murfreesboro', 'nantes', 'naples', 'nashville', 'nashua',
      'nassau county', 'new brunswick', 'new delhi', 'new haven', 'new orleans',
      'newark', 'newcastle', 'norfolk', 'north las vegas', 'north platte', 'odessa',
      'oklahoma city', 'olympia', 'orlando', 'oslo', 'ottawa', 'oxford', 'paducah',
      'palmdale', 'panama city', 'paterson', 'pensacola', 'pittsburgh', 'portland',
      'prague', 'pretoria', 'prince george', 'providence', 'pueblo', 'pune',
      'quebec city', 'queens', 'quito', 'raleigh', 'rapid city', 'reading',
      'recife', 'reno', 'richmond', 'rio de janeiro', 'riyadh', 'rochester',
      'rockford', 'sacramento', 'salem', 'salt lake city', 'san jose', 'san juan',
      'san luis potosí', 'sanford', 'santa fe', 'santiago', 'santo domingo',
      'são paulo', 'savannah', 'scottsdale', 'sheffield', 'shenzhen', 'shreveport',
      'simferopol', 'sioux city', 'sofia', 'spokane', 'springfield', 'st. augustine',
      'st. elizabeth', 'susquehanna county', 'swidnik', 'tacoma', 'taif', 'tampa',
      'tampere', 'tateyama', 'taylortown', 'the bronx', 'traverse city', 'tucson',
      'tulsa', 'uppsala', 'valdosta', 'vancouver', 'vero beach', 'villahermosa',
      'virginia beach', 'visayas', 'walton', 'waterbury', 'wayne', 'west valley city',
      'wichita falls', 'williamstown', 'wilmington', 'wilson county', 'wolf point',
      'york county',
      // International
      'al hudeidah', 'amman', 'bangkok', 'bavaria', 'bogotá', 'buenos aires',
      'davenish', 'dodge city', 'doha', 'dublin', 'gaza', 'hawaii', 'istanbul',
      'jakarta', 'jerusalem', 'kyiv', 'london', 'madrid', 'manila', 'mexico city',
      'moscow', 'paris', 'rome', 'sydney', 'tehran', 'tel aviv',
    ];
    
    // Search for city names in text (longest match first for multi-word cities)
    const sortedCities = cityNames.sort((a, b) => b.length - a.length);
    const cityMap = this.getCityMap();
    
    for (const cityName of sortedCities) {
      if (text.includes(cityName.toLowerCase())) {
        // Try to find the matching key in city map
        for (const key in cityMap) {
          const keyLower = key.toLowerCase();
          // Check if this key matches the city name we found
          if (keyLower.includes(cityName.toLowerCase()) || cityName.toLowerCase().includes(keyLower.split(',')[0])) {
            return key; // Return the exact key from the map
          }
        }
      }
    }
    
    return null;
  }

  // Extract country names from post text
  extractCountryFromPost(post) {
    const text = (post.text || post.story || post.title || '').toLowerCase();
    
    // Extended country list with common names and variations
    const countryMap = {
      'china': 'China',
      'india': 'India',
      'united states': 'United States',
      'usa': 'United States',
      'us': 'United States',
      'america': 'United States',
      'indonesia': 'Indonesia',
      'pakistan': 'Pakistan',
      'brazil': 'Brazil',
      'bangladesh': 'Bangladesh',
      'russia': 'Russia',
      'russian': 'Russia',
      'mexico': 'Mexico',
      'japan': 'Japan',
      'philippines': 'Philippines',
      'egypt': 'Egypt',
      'ethiopia': 'Ethiopia',
      'vietnam': 'Vietnam',
      'congo': 'Democratic Republic of the Congo',
      'drc': 'Democratic Republic of the Congo',
      'iran': 'Iran',
      'türkiye': 'Turkey',
      'turkey': 'Turkey',
      'germany': 'Germany',
      'thailand': 'Thailand',
      'united kingdom': 'United Kingdom',
      'uk': 'United Kingdom',
      'britain': 'United Kingdom',
      'france': 'France',
      'italy': 'Italy',
      'spain': 'Spain',
      'canada': 'Canada',
      'australia': 'Australia',
      'south korea': 'South Korea',
      'korea': 'South Korea',
      'argentina': 'Argentina',
      'south africa': 'South Africa',
      'ukraine': 'Ukraine',
      'poland': 'Poland',
      'iraq': 'Iraq',
      'afghanistan': 'Afghanistan',
      'saudi arabia': 'Saudi Arabia',
      'saudi': 'Saudi Arabia',
      'uzbekistan': 'Uzbekistan',
      'peru': 'Peru',
      'malaysia': 'Malaysia',
      'angola': 'Angola',
      'mozambique': 'Mozambique',
      'ghana': 'Ghana',
      'yemen': 'Yemen',
      'nepal': 'Nepal',
      'nigeria': 'Nigeria',
      'venezuela': 'Venezuela'
    };

    // Check for country names in text (with word boundaries)
    for (const [key, country] of Object.entries(countryMap)) {
      const regex = new RegExp(`\\b${key}\\b`, 'i');
      if (regex.test(text)) {
        return country;
      }
    }

    return null;
  }

  // Extract locations from posts and convert to coordinates
  async extractLocationsFromPosts() {
    const coveragePoints = [];
    const seenLocations = new Set();

    try {
      // Get posts from localStorage or API
      let posts = [];
      
      // Try to get from enhanced feed cache
      const cacheKey = 'noteworthy-posts-cache-enhanced';
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const cacheData = JSON.parse(cached);
          if (cacheData.posts && Array.isArray(cacheData.posts)) {
            posts = cacheData.posts;
          }
        } catch (e) {
          console.warn('Failed to parse cached posts:', e);
        }
      }

      // If no cached posts, try to fetch from API - fetch more posts to show all locations
      if (posts.length === 0) {
        try {
          const response = await fetch('/.netlify/functions/posts-read?limit=500');
          if (response.ok) {
            const data = await response.json();
            posts = Array.isArray(data) ? data : (data.posts || data.data || []);
          }
        } catch (e) {
          console.warn('Failed to fetch posts for globe:', e);
        }
      }

      // Track how many posts per country to add slight randomization
      const countryCounts = new Map();

      // Extract ALL posts with locations - show every location mentioned
      for (const post of posts) {
        const location = this.extractLocationFromPost(post);
        if (location) {
          const coords = this.getLocationCoordinates(location);
          if (coords) {
            // Count posts per location for randomization
            const count = (countryCounts.get(location) || 0) + 1;
            countryCounts.set(location, count);
            
            // Add slight randomization to prevent exact overlap (only for country-level, not cities)
            // Cities should be more precise, countries can spread
            const isCity = this.getCityCoordinates(location) !== null;
            const spreadRadius = isCity ? 0.5 : 2; // Smaller spread for cities
            const angle = (count * 137.5) % 360; // Golden angle for even distribution
            const distance = isCity ? Math.min(count * 0.1, spreadRadius) : Math.min(count * 0.3, spreadRadius);
            
            const latOffset = (Math.cos(angle * Math.PI / 180) * distance);
            const lngOffset = (Math.sin(angle * Math.PI / 180) * distance / Math.cos(coords.lat * Math.PI / 180));
            
            const postText = post.text || post.story || post.title || '';
            const headline = postText.length > 60 ? postText.substring(0, 57) + '...' : postText;
            
            coveragePoints.push({
              id: `post-${post.id || Date.now()}-${location}-${count}`,
              lat: coords.lat + latOffset,
              lng: coords.lng + lngOffset,
              location: location,
              headline: headline || `Coverage from ${location}`,
              timestamp: post.createdAt || post.datePosted || new Date().toISOString(),
              postId: post.id
            });
          }
        }
      }

      console.log(`[Globe] Extracted ${coveragePoints.length} locations from ${posts.length} posts`);
      return coveragePoints;
    } catch (err) {
      console.error('[Globe] Error extracting locations from posts:', err);
      return [];
    }
  }

  isMobile() {
    return window.innerWidth <= 768;
  }

  async init() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`Container #${this.containerId} not found`);
      return;
    }

    // Wait for Globe to be available
    if (typeof Globe === 'undefined') {
      console.error('Globe.gl not loaded');
      return;
    }

    const isMobile = this.isMobile();

    // Create root structure with mobile class
    container.innerHTML = `
      <div class="cia-globe-root ${isMobile ? 'mobile' : ''}">
        <div class="cia-globe-canvas" id="cia-globe-canvas"></div>
        <div class="cia-hud-overlay ${isMobile ? 'mobile-simple' : ''}" id="cia-hud-overlay"></div>
      </div>
    `;

    const canvasEl = document.getElementById('cia-globe-canvas');
    const hudEl = document.getElementById('cia-hud-overlay');
    
    if (!canvasEl || !hudEl) return;

    // Render HUD (simplified on mobile)
    this.renderHUD(hudEl);

    // Initialize globe with highly detailed, realistic earth texture
    // Using high-resolution NASA Blue Marble Next Generation texture for maximum detail
    // This texture shows detailed land features, coastlines, mountains, and terrain
    // The bump map adds 3D relief and depth to show mountains, valleys, and topography
    this.globeInstance = Globe()(canvasEl)
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg') // High-res NASA Blue Marble texture (detailed)
      .bumpImageUrl(isMobile ? null : '//unpkg.com/three-globe/example/img/earth-topology.png') // Detailed topography/bump map for 3D relief
      .backgroundColor('#07152a') // Match website background
      .showAtmosphere(true)
      .atmosphereColor('#4A9EFF') // Blue atmosphere to match site
      .atmosphereAltitude(0.15);
    
    // Enhance texture quality for maximum detail after globe loads
    setTimeout(() => {
      try {
        // Access Three.js (loaded from CDN) to enhance texture rendering
        if (typeof THREE !== 'undefined') {
          const scene = this.globeInstance.scene();
          if (scene) {
            scene.traverse((obj) => {
              if (obj.material) {
                // Maximum texture filtering quality for crisp, detailed rendering
                if (obj.material.map) {
                  obj.material.map.anisotropy = 16; // 16x anisotropic filtering for maximum detail
                  obj.material.map.minFilter = THREE.LinearMipmapLinearFilter;
                  obj.material.map.magFilter = THREE.LinearFilter;
                  obj.material.map.generateMipmaps = true;
                  obj.material.map.needsUpdate = true;
                }
                // Enhance bump map for better 3D relief detail
                if (obj.material.bumpMap) {
                  obj.material.bumpMap.anisotropy = 16;
                  obj.material.bumpMap.minFilter = THREE.LinearMipmapLinearFilter;
                  obj.material.bumpMap.magFilter = THREE.LinearFilter;
                  obj.material.bumpMap.generateMipmaps = true;
                  obj.material.bumpMap.needsUpdate = true;
                  obj.material.bumpScale = 0.5; // Adjust bump intensity for visible detail
                }
                obj.material.needsUpdate = true;
              }
            });
            console.log('[Globe] ✅ High-quality detailed earth texture rendering enabled');
          }
        }
      } catch (e) {
        console.log('[Globe] Texture enhancement note:', e.message);
      }
    }, 1500);

    // Configure points - show all countries
    this.globeInstance
      .pointsData(this.coveragePoints)
      .pointLat(d => d.lat)
      .pointLng(d => d.lng)
      .pointLabel(isMobile ? d => d.location : d => `${d.location}\n${d.headline}`)
      .pointColor(() => '#4A9EFF') // Blue dots to match site theme
      .pointRadius(isMobile ? 0.4 : 0.5)
      .pointAltitude(isMobile ? 0.02 : 0.03)
      .pointResolution(isMobile ? 4 : 8)
      .pointsTransitionDuration(isMobile ? 500 : 1000);

    // Configure controls - ensure full globe is visible
    const controls = this.globeInstance.controls();
    controls.autoRotate = !isMobile;
    controls.autoRotateSpeed = 0.5; // Slower rotation
    controls.enableZoom = true;
    controls.enablePan = !isMobile;
    controls.enableDamping = !isMobile;
    
    // Set camera distance to show entire globe
    controls.minDistance = 200;
    controls.maxDistance = 800;
    
    // Set initial camera position to show entire globe clearly
    setTimeout(() => {
      // Higher altitude shows more of the globe
      this.globeInstance.pointOfView({ lat: 0, lng: 0, altitude: 3.0 }, 0);
    }, 100);

    // Handle point clicks
    this.globeInstance.onPointClick((point) => {
      if (point) {
        this.setActiveOp(point);
      }
    });

    // Handle resize
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    // Start animation (throttled on mobile)
    this.animate();
  }

  handleResize() {
    if (this.globeInstance) {
      const canvas = document.getElementById('cia-globe-canvas');
      if (canvas) {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        this.globeInstance.width(width);
        this.globeInstance.height(height);
      }
    }
  }

  animate() {
    if (!this.globeInstance) return;

    const isMobile = this.isMobile();
    
    // Throttle animation on mobile (slower updates)
    if (isMobile) {
      this.t += 0.015; // Half speed on mobile
    } else {
      this.t += 0.03;
    }
    
    const baseAltitude = isMobile ? 0.02 : 0.03;
    const pulseAmplitude = isMobile ? 0.01 : 0.02; // Smaller pulse on mobile

    this.globeInstance.pointAltitude(d => {
      const phase = (d.lat + d.lng) * 0.1;
      const scale = (Math.sin(this.t + phase) + 1) / 2;
      return baseAltitude + scale * pulseAmplitude;
    });

    this.globeInstance.pointRadius(d => {
      const phase = (d.lat + d.lng) * 0.1;
      const scale = (Math.sin(this.t + phase) + 1) / 2;
      const baseRadius = isMobile ? 0.5 : 0.6;
      const pulseSize = isMobile ? 0.15 : 0.3; // Smaller pulse on mobile
      return baseRadius + scale * pulseSize;
    });

    // Throttle on mobile - skip every other frame
    if (isMobile) {
      this.animationFrameId = requestAnimationFrame(() => {
        requestAnimationFrame(() => this.animate());
      });
    } else {
      this.animationFrameId = requestAnimationFrame(() => this.animate());
    }
  }

  setActiveOp(point) {
    this.activeOp = point;
    this.renderHUD(document.getElementById('cia-hud-overlay'));
  }

  formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return timestamp;
    }
  }

  renderHUD(container) {
    if (!container) return;

    // Simple, clean HUD - no CIA styling
    const isMobile = this.isMobile();
    const uniqueCountries = new Set(this.coveragePoints.map(p => p.location));
    
    container.innerHTML = `
      <!-- Simple top bar -->
      <div class="globe-hud-simple">
        <div class="globe-hud-title">Global Coverage</div>
        <div class="globe-hud-count">${uniqueCountries.size} Countries • ${this.coveragePoints.length} Stories</div>
      </div>

      <!-- Active location (if selected) -->
      ${this.activeOp ? `
        <div class="globe-hud-active">
          <div class="globe-hud-location">${this.activeOp.location}</div>
          <div class="globe-hud-story">${this.activeOp.headline}</div>
        </div>
      ` : ''}
    `;
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.globeInstance) {
      this.globeInstance._destructor?.();
    }
    window.removeEventListener('resize', () => this.handleResize());
  }
}

// Export for use
if (typeof window !== 'undefined') {
  window.CiaMissionGlobe = CiaMissionGlobe;
}

