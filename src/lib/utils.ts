
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parses a timestamp string in "dd/MM/yyyy HH:mm:ss" format to a Unix timestamp (milliseconds).
 * Allows for single or double digits for day and month.
 * @param timestampStr The timestamp string to parse.
 * @returns A Unix timestamp in milliseconds, or null if parsing fails.
 */
export function parseCustomTimestamp(timestampStr: string | undefined): number | null {
  if (!timestampStr || typeof timestampStr !== 'string') {
    console.warn(`[parseCustomTimestamp] Invalid input: timestampStr is undefined or not a string:`, timestampStr);
    return null;
  }
  // Assumes dd/MM/yyyy HH:mm:ss format, allows for d/M/yyyy or dd/MM/yyyy
  const parts = timestampStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s(\d{2}):(\d{2}):(\d{2})/);
  if (parts) {
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1; // JS months are 0-indexed
    const year = parseInt(parts[3], 10);
    const hour = parseInt(parts[4], 10);
    const minute = parseInt(parts[5], 10);
    const second = parseInt(parts[6], 10);

    const date = new Date(Date.UTC(year, month, day, hour, minute, second));
    
    if (isNaN(date.getTime())) {
      console.error(`[parseCustomTimestamp] CRITICAL: Invalid date constructed. Raw: "${timestampStr}", Attempted UTC Components -> Year: ${year}, Month(0-idx): ${month}, Day: ${day}, H:${hour}, M:${minute}, S:${second}`);
      return null;
    }
    // Log the components used for Date.UTC and the resulting ISO string and millis
    // console.log(`[parseCustomTimestamp] Raw: "${timestampStr}", Parsed for UTC -> Y:${year}, M:${month}(0-idx), D:${day}, H:${hour}, M:${minute}, S:${second} => Millis: ${date.getTime()}, ISO: ${date.toISOString()}`);
    return date.getTime();
  }
  console.error(`[parseCustomTimestamp] CRITICAL: Could not parse format. Raw: "${timestampStr}". Expected "dd/MM/yyyy HH:mm:ss" (day/month can be single or double digit).`);
  return null;
}

// Helper to convert raw Firebase data to WeatherDataPoint
import type { RawFirebaseDataPoint, WeatherDataPoint } from '@/types/weather';

const parseNumeric = (val: any): number | undefined => {
  if (val === undefined || val === null) return undefined;
  const num = Number(val);
  return isFinite(num) ? num : undefined;
};

export function transformRawDataToWeatherDataPoint(rawData: RawFirebaseDataPoint, recordKey?: string): WeatherDataPoint | null {
  // console.log(`[transformRawDataToWeatherDataPoint] Processing raw record (key: ${recordKey || 'N/A'}):`, JSON.parse(JSON.stringify(rawData)));

  if (!rawData || typeof rawData !== 'object') {
    // console.warn('[transformRawDataToWeatherDataPoint] Invalid rawData input (not an object or null):', rawData);
    return null;
  }

  const numericalTimestamp = parseCustomTimestamp(rawData.timestamp);
  // console.log(`[transformRawDataToWeatherDataPoint] Parsed timestamp for (key: ${recordKey || 'N/A'}):`, numericalTimestamp, rawData.timestamp);

  if (numericalTimestamp === null) {
    // console.warn(`[transformRawDataToWeatherDataPoint] Skipping record (key: ${recordKey || 'N/A'}) due to unparseable timestamp:`, rawData.timestamp);
    return null;
  }

  let precipitationValue: string;
  if (typeof rawData.rainStatus === 'string') {
    precipitationValue = rawData.rainStatus;
  } else {
    // console.warn(`[transformRawDataToWeatherDataPoint] rainStatus is missing or not a string for (key: ${recordKey || 'N/A'}). Defaulting to "Unknown". Value:`, rawData.rainStatus);
    precipitationValue = "Unknown";
  }
  // console.log(`[transformRawDataToWeatherDataPoint] Precipitation status for (key: ${recordKey || 'N/A'}):`, precipitationValue);
  
  const temperatureValue = parseNumeric(rawData.temperature);
  const humidityValue = parseNumeric(rawData.humidity);
  const luxValue = parseNumeric(rawData.lux);
  
  const airQualityStringValue = typeof rawData.airQuality === 'string' ? rawData.airQuality : "Unknown";
  // if (typeof rawData.airQuality !== 'string') console.warn(`[transformRawDataToWeatherDataPoint] airQuality (string) is not a string for (key: ${recordKey || 'N/A'}). Defaulting to "Unknown". Value:`, rawData.airQuality);
  // console.log(`[transformRawDataToWeatherDataPoint] Air Quality (string) for (key: ${recordKey || 'N/A'}):`, airQualityStringValue);
  
  const aqiPpmValue = parseNumeric(rawData.mq135PPM);
  // if (typeof rawData.mq135PPM !== 'number') console.warn(`[transformRawDataToWeatherDataPoint] mq135PPM (for AQI PPM) is not a number for (key: ${recordKey || 'N/A'}). Defaulting to 0. Value:`, rawData.mq135PPM);
  // console.log(`[transformRawDataToWeatherDataPoint] AQI PPM (from mq135PPM) for (key: ${recordKey || 'N/A'}):`, aqiPpmValue);

  const pressureValue = parseNumeric(rawData.pressure); 

  // Default numeric values to 0 if they are undefined after parsing, as WeatherDataPoint expects numbers for these.
  // Pressure remains optional.
  const finalTemperature = temperatureValue === undefined ? 0 : temperatureValue;
  const finalHumidity = humidityValue === undefined ? 0 : humidityValue;
  const finalLux = luxValue === undefined ? 0 : luxValue;
  const finalAqiPpm = aqiPpmValue === undefined ? 0 : aqiPpmValue;


  const transformedPoint: WeatherDataPoint = {
    timestamp: numericalTimestamp,
    rawTimestampString: rawData.timestamp, // Store the original string
    temperature: finalTemperature,
    humidity: finalHumidity,
    precipitation: precipitationValue,
    airQuality: airQualityStringValue,
    aqiPpm: finalAqiPpm,
    lux: finalLux,
    ...(pressureValue !== undefined && { pressure: pressureValue }),
  };

  // console.log(`[transformRawDataToWeatherDataPoint] Successfully transformed point for (key: ${recordKey || 'N/A'}):`, JSON.parse(JSON.stringify(transformedPoint)));
  return transformedPoint;
}

export const formatTimestampToDdMmHhMmUTC = (timestamp: number): string => {
  const date = new Date(timestamp);
  const day = date.getUTCDate().toString().padStart(2, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${day}/${month} ${hours}:${minutes}`;
};

export const formatTimestampToFullUTC = (timestamp: number): string => {
  const date = new Date(timestamp);
  const day = date.getUTCDate().toString().padStart(2, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = date.getUTCFullYear();
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const seconds = date.getUTCSeconds().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds} UTC`;
};

