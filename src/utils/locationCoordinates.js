// Location coordinate mapping utilities
// Extracted from CiaMissionGlobe-cdn.js for reuse

const cityMap = {
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
  // Additional cities from the full map
  'Alene, Idaho': { lat: 47.6730, lng: -116.7804 },
  'Anaconda, Montana': { lat: 46.1286, lng: -112.9428 },
  'Athens, Georgia': { lat: 33.9519, lng: -83.3576 },
  'Athens, Ohio': { lat: 39.3292, lng: -82.1013 },
  'Ballymena, Northern Ireland': { lat: 54.8636, lng: -6.2765 },
  'Bosasso, Puntland': { lat: 11.2842, lng: 49.1816 },
  'Chattanooga, Tennessee': { lat: 35.0456, lng: -85.3097 },
  'Chino Hills, Southern California': { lat: 33.9898, lng: -117.7326 },
  'El Segundo, California': { lat: 33.9192, lng: -118.4165 },
  'Grand Blanc, Michigan': { lat: 42.9275, lng: -83.6245 },
  'Huntington Beach, California': { lat: 33.6595, lng: -117.9988 },
  'Indianapolis, Indiana': { lat: 39.7684, lng: -86.1581 },
  'Kamchatka, Russia': { lat: 53.0194, lng: 158.6506 },
  'Kamchatsky, Russia': { lat: 53.0194, lng: 158.6506 },
  'Louisville, Kentucky': { lat: 38.2527, lng: -85.7585 },
  'Mandeville, Jamaica': { lat: 18.0417, lng: -77.5075 },
  'Manhattan, New York': { lat: 40.7831, lng: -73.9712 },
  'Oxford, England': { lat: 51.7520, lng: -1.2577 },
  'Savannah, Georgia': { lat: 32.0809, lng: -81.0912 },
  'St. Elizabeth, Jamaica': { lat: 18.0167, lng: -77.8500 },
  'Tateyama City Coast, Chiba': { lat: 35.0167, lng: 139.8667 },
  'Taylortown, North Carolina': { lat: 35.2135, lng: -79.4920 },
  'The Bronx, New York': { lat: 40.8448, lng: -73.8648 },
  'Traverse City, Michigan': { lat: 44.7631, lng: -85.6206 },
  'Valdosta, Georgia': { lat: 30.8327, lng: -83.2785 },
  'Vancouver, British Columbia': { lat: 49.2827, lng: -123.1207 },
  'Villahermosa, Mexico': { lat: 17.9892, lng: -92.9477 },
  'Waterbury, Connecticut': { lat: 41.5582, lng: -73.0515 },
  'Wayne, Michigan': { lat: 42.2814, lng: -83.3863 },
  'Amman, Jordan': { lat: 31.9539, lng: 35.9106 },
  'Bavaria, Germany': { lat: 48.7904, lng: 11.4979 },
  'Doha, Qatar': { lat: 25.2854, lng: 51.5310 },
  'Hawaii, Island': { lat: 19.8968, lng: -155.5828 },
  'Liverpool, England': { lat: 53.4084, lng: -2.9916 },
  'Richmond, Virginia': { lat: 37.5407, lng: -77.4360 },
  'Little River, South Carolina': { lat: 33.8732, lng: -78.6142 },
  'Glenwood, Iowa': { lat: 41.0467, lng: -95.7428 },
};

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
  'Venezuela': { lat: 6.4238, lng: -66.5897 },
  // Additional countries/states
  'Israel': { lat: 31.0461, lng: 34.8516 },
  'Somalia': { lat: 5.1521, lng: 46.1996 },
  'Qatar': { lat: 25.3548, lng: 51.1839 },
  'Jamaica': { lat: 18.1096, lng: -77.2975 },
  'Ireland': { lat: 53.4129, lng: -8.2439 },
  'Scotland': { lat: 56.4907, lng: -4.2026 },
  'Northern Ireland': { lat: 54.7877, lng: -6.4923 },
  'Puntland': { lat: 8.4072, lng: 48.4840 },
  'Dagestan': { lat: 42.9833, lng: 47.4833 },
  'Crimea': { lat: 45.3382, lng: 34.2002 },
  'Palestine': { lat: 31.9522, lng: 35.2332 },
  'Jordan': { lat: 30.5852, lng: 36.2384 },
  'Cyprus': { lat: 35.1264, lng: 33.4299 },
  'Ecuador': { lat: -1.8312, lng: -78.1834 },
  'Chile': { lat: -35.6751, lng: -71.5430 },
  'Colombia': { lat: 4.5709, lng: -74.2973 },
  'Dominican Republic': { lat: 18.7357, lng: -70.1627 },
  'Puerto Rico': { lat: 18.2208, lng: -66.5901 },
  'New Brunswick': { lat: 46.5653, lng: -66.4619 },
  'British Columbia': { lat: 53.7267, lng: -127.6476 },
  'Nova Scotia': { lat: 44.6820, lng: -63.7443 },
  'Tasmania': { lat: -41.4545, lng: 145.9707 },
  'Victoria': { lat: -37.4713, lng: 144.7852 },
  // US States
  'Texas': { lat: 31.9686, lng: -99.9018 },
  'Florida': { lat: 27.7663, lng: -81.6868 },
  'California': { lat: 36.1162, lng: -119.6816 },
  'New York': { lat: 40.7128, lng: -74.0060 },
  'Georgia': { lat: 32.1656, lng: -82.9001 },
  'Ohio': { lat: 40.3888, lng: -82.7649 },
  'Pennsylvania': { lat: 40.5908, lng: -77.2098 },
  'Michigan': { lat: 43.3266, lng: -84.5361 },
  'North Carolina': { lat: 35.5397, lng: -79.8438 },
  'Illinois': { lat: 40.3495, lng: -88.9861 },
  'Tennessee': { lat: 35.7478, lng: -86.6923 },
  'Washington': { lat: 47.4009, lng: -121.4905 },
  'Massachusetts': { lat: 42.2302, lng: -71.5301 },
  'Arizona': { lat: 33.7298, lng: -111.4312 },
  'Indiana': { lat: 39.8494, lng: -86.2583 },
  'Louisiana': { lat: 30.9843, lng: -91.9623 },
  'Montana': { lat: 46.9219, lng: -110.4544 },
  'Idaho': { lat: 44.2405, lng: -114.4788 },
  'Iowa': { lat: 41.8780, lng: -93.0977 },
  'Nebraska': { lat: 41.4925, lng: -99.9018 },
  'New Mexico': { lat: 34.8405, lng: -106.2485 },
  'South Carolina': { lat: 33.8569, lng: -80.9450 },
  'Hawaii': { lat: 19.8968, lng: -155.5828 },
  'Connecticut': { lat: 41.5978, lng: -72.7554 },
  'Kentucky': { lat: 37.6681, lng: -84.6701 },
  'Oregon': { lat: 43.8041, lng: -120.5542 },
  'Oklahoma': { lat: 35.5653, lng: -96.9289 },
  'Utah': { lat: 40.1500, lng: -111.8624 },
  'Nevada': { lat: 39.2502, lng: -116.7512 },
  'Kansas': { lat: 38.5266, lng: -96.7265 },
  'Missouri': { lat: 38.4561, lng: -92.2884 },
  'Alabama': { lat: 32.8067, lng: -86.7911 },
  'Wisconsin': { lat: 44.2685, lng: -89.6165 },
  'Minnesota': { lat: 45.6945, lng: -93.9002 },
  'Colorado': { lat: 39.0598, lng: -105.3111 },
  'Maryland': { lat: 39.0639, lng: -76.8021 },
  'New Jersey': { lat: 40.2989, lng: -74.5210 },
  'Virginia': { lat: 37.7693, lng: -78.1699 },
  'Rhode Island': { lat: 41.6809, lng: -71.5118 },
  'New Hampshire': { lat: 43.4525, lng: -71.5639 },
  'South Dakota': { lat: 44.2998, lng: -99.4388 },
  'Alaska': { lat: 64.2008, lng: -149.4937 },
  'Maine': { lat: 44.3235, lng: -69.7653 },
  'Vermont': { lat: 44.2664, lng: -72.5805 },
  'Delaware': { lat: 39.3185, lng: -75.5071 },
  'West Virginia': { lat: 38.4912, lng: -80.9545 },
  'Mississippi': { lat: 32.7416, lng: -89.6787 },
  'Arkansas': { lat: 34.9697, lng: -92.3731 },
  'North Dakota': { lat: 47.5289, lng: -99.7840 },
  'Wyoming': { lat: 41.1455, lng: -105.3111 },
};

export function getCityCoordinates(locationName) {
  if (!locationName) return null;
  
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

export function getCountryCoordinates(locationName) {
  if (!locationName) return null;
  
  // Try exact match first
  if (countryMap[locationName]) {
    return countryMap[locationName];
  }
  
  // Try case-insensitive match
  const locationNameLower = locationName.toLowerCase();
  for (const [key, coords] of Object.entries(countryMap)) {
    if (key.toLowerCase() === locationNameLower) {
      return coords;
    }
  }
  
  return null;
}

export function getLocationCoordinates(locationName) {
  if (!locationName) return null;
  
  // First try city/state mapping
  const cityCoords = getCityCoordinates(locationName);
  if (cityCoords) {
    return cityCoords;
  }
  
  // Then try country mapping
  const countryCoords = getCountryCoordinates(locationName);
  if (countryCoords) {
    return countryCoords;
  }
  
  return null;
}

