
'use server';

/**
 * @fileOverview Generates a structured weather forecast based on historical data,
 *               including a daily breakdown for graphical representation.
 *
 * - generateWeatherForecast - A function that generates a structured weather forecast.
 * - GenerateWeatherForecastInput - The input type for the generateWeatherForecast function.
 * - GenerateWeatherForecastOutput - The return type for the generateWeatherForecast function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateWeatherForecastInputSchema = z.object({
  historicalData: z
    .string()
    .describe('Historical weather data in JSON format. Each entry should be an object with: timestamp (number), temperature (number), humidity (number), precipitation (string, e.g., "No Rain", "Rain"), aqi (number, Air Quality Index in PPM from an MQ135 sensor), lux (number), pressure (number, optional).'),
  location: z.string().describe('The location for which to generate the weather forecast.'),
});
export type GenerateWeatherForecastInput = z.infer<typeof GenerateWeatherForecastInputSchema>;

const DailyForecastSchema = z.object({
  date: z.string().describe("The date for this specific day's forecast (e.g., YYYY-MM-DD)."),
  temperatureHigh: z.number().describe("Predicted highest temperature in Celsius for this day."),
  temperatureLow: z.number().describe("Predicted lowest temperature in Celsius for this day."),
  precipitationChance: z.number().min(0).max(100).describe("Chance of precipitation as a percentage (0-100) for this day."),
  daySummary: z.string().describe("A brief summary of the weather conditions for this specific day.")
});

const GenerateWeatherForecastOutputSchema = z.object({
  overallSummary: z.string().describe("A concise overall summary of the weather forecast for the next 2-3 days."),
  dailyForecasts: z.array(DailyForecastSchema).describe("An array of daily forecast predictions for the next 2-3 days. Provide at least 2 days, and up to 3 if the data supports it."),
  windConditions: z.string().describe("Description of expected wind conditions (e.g., 'Light breeze from NW at 10 km/h') for the overall forecast period."),
  aqiOutlook: z.string().describe("A brief outlook on the Air Quality based on the provided PPM values (e.g., 'Air quality expected to remain good based on PPM levels') for the overall forecast period.")
});
export type GenerateWeatherForecastOutput = z.infer<typeof GenerateWeatherForecastOutputSchema>;

export async function generateWeatherForecast(input: GenerateWeatherForecastInput): Promise<GenerateWeatherForecastOutput> {
  return generateWeatherForecastFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateWeatherForecastPrompt',
  input: {schema: GenerateWeatherForecastInputSchema},
  output: {schema: GenerateWeatherForecastOutputSchema},
  prompt: `You are an expert meteorologist. Your task is to analyze the provided historical weather data for {{location}} and generate a detailed weather forecast.

The historical data includes:
- timestamp: Unix timestamp in milliseconds
- temperature: in Celsius
- humidity: in percentage
- precipitation: a string describing precipitation status (e.g., "No Rain", "Rain", "Light Rain"). Interpret this to estimate precipitation chance for daily forecasts.
- aqi: Air Quality Index in PPM (parts per million) from an MQ135 sensor (numeric value). Higher PPM generally means poorer air quality.
- lux: light level in lux
- pressure: atmospheric pressure in hPa (optional)

Historical Data:
{{{historicalData}}}

Based on this data, provide the following forecast details. Ensure your output strictly adheres to the requested structured format:
- overallSummary: A concise overall summary of the weather forecast for the next 2-3 days.
- dailyForecasts: An array of daily forecast predictions for the next 2-3 days. For each day, provide:
    - date: The date for this specific day's forecast (e.g., YYYY-MM-DD).
    - temperatureHigh: Predicted highest temperature in Celsius for this day.
    - temperatureLow: Predicted lowest temperature in Celsius for this day.
    - precipitationChance: Chance of precipitation as a percentage (0-100) for this day.
    - daySummary: A brief summary of the weather conditions for this specific day (e.g., "Sunny with occasional clouds").
  Provide at least 2 days of forecast, and up to 3 days if the historical data patterns allow for reasonable prediction.
- windConditions: Description of expected wind conditions (e.g., 'Light breeze from NW at 10 km/h') for the overall forecast period.
- aqiOutlook: A brief outlook on the Air Quality based on the provided PPM values (e.g., 'Air quality expected to remain good based on PPM levels', 'Air quality might degrade due to elevated PPM levels') for the overall forecast period.`,
});

const generateWeatherForecastFlow = ai.defineFlow(
  {
    name: 'generateWeatherForecastFlow',
    inputSchema: GenerateWeatherForecastInputSchema,
    outputSchema: GenerateWeatherForecastOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('AI failed to generate a forecast. Output was undefined.');
    }
    return output;
  }
);
