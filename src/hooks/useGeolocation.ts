import { useState } from 'react';

export interface LocationContext {
  city: string;
  weather: string;
  temp: string;
}

/**
 * Formats OpenStreetMap Nominatim address into a clean city/region string.
 * Example: "Brooklyn, NY", "Austin, TX", "London, GB".
 */
function formatCityFromAddress(addr: any): string {
  if (!addr) return "Current Location";

  // Prioritize city or town, then village, then suburb if city isn't set, then municipality/county
  let local = addr.city || addr.town || addr.village || addr.suburb || addr.municipality || addr.county;
  
  // Clean up if it's "XYZ Taluka" and city or district is available
  if (local && local.toLowerCase().includes('taluka') && (addr.city || addr.state_district)) {
    local = addr.city || addr.state_district.replace(/ district/i, '');
  }

  // Extract state abbreviation, state, or country code
  let region = "";
  if (addr['ISO3166-2-lvl4']) {
    const parts = addr['ISO3166-2-lvl4'].split('-');
    region = parts[1] || parts[0];
  } else if (addr.state) {
    region = addr.state;
  } else if (addr.country_code) {
    region = addr.country_code.toUpperCase();
  }

  if (local && region && !local.toLowerCase().includes(region.toLowerCase())) {
    return `${local}, ${region}`;
  }
  return local || region || "Current Location";
}

/**
 * Maps WMO weather interpretation codes to readable weather conditions.
 */
function getWeatherCondition(code: number): string {
  if (code === 0) return "Clear";
  if (code >= 1 && code <= 3) return "Partly Cloudy";
  if (code >= 45 && code <= 48) return "Foggy";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 56 && code <= 57) return "Freezing Drizzle";
  if (code >= 61 && code <= 65) return "Rain";
  if (code >= 66 && code <= 67) return "Freezing Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 85 && code <= 86) return "Snow Showers";
  if (code >= 95) return "Thunderstorm";
  return "Partly Cloudy";
}

export function useGeolocation() {
  const [locationContext, setLocationContext] = useState<LocationContext | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchContext = () => {
    // Check if Geolocation is supported in current browser environment
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      // Graceful fallback: leave blank, never show an error
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          // 1. Fetch reverse geocoding via OpenStreetMap Nominatim (keyless, free)
          const geoPromise = fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { Accept: 'application/json' } }
          )
            .then((res) => (res.ok ? res.json() : null))
            .catch(() => null);

          // 2. Fetch current weather via Open-Meteo (keyless, free)
          const weatherPromise = fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&temperature_unit=fahrenheit`
          )
            .then((res) => (res.ok ? res.json() : null))
            .catch(() => null);

          const [geoData, weatherData] = await Promise.all([geoPromise, weatherPromise]);

          const city = geoData?.address ? formatCityFromAddress(geoData.address) : "Current Location";
          
          let temp = "68°F";
          let weatherText = "Partly Cloudy";
          
          if (weatherData?.current_weather) {
            temp = `${Math.round(weatherData.current_weather.temperature)}°F`;
            weatherText = getWeatherCondition(weatherData.current_weather.weathercode);
          }

          setLocationContext({
            city,
            weather: weatherText,
            temp
          });
        } catch {
          // Graceful fallback: leave blank, never show an error or disrupt writing
          setLocationContext(null);
        } finally {
          setLoading(false);
        }
      },
      () => {
        // If user blocks/denies permission: gracefully fall back to leaving location blank.
        // Never show an error or disrupt the writing experience.
        setLocationContext(null);
        setLoading(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 300000 // 5 minutes cache
      }
    );
  };

  const clearLocation = () => setLocationContext(null);

  return { 
    locationContext, 
    loading, 
    fetchContext, 
    clearLocation, 
    setLocationContext 
  };
}

