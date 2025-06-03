
'use server';

/**
 * @fileOverview Generates a structured weather forecast based on historical data.
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
    .describe('Historical weather data in JSON format. Each entry should be an object with: timestamp (number), temperature (number), humidity (number), precipitation (string, e.g., "No Rain", "Rain"), aqi (number, Air Quality Index in PPM), lux (number), pressure (number, optional).'),
  location: z.string().describe('The location for which to generate the weather forecast.'),
});
export type GenerateWeatherForecastInput = z.infer<typeof GenerateWeatherForecastInputSchema>;

const GenerateWeatherForecastOutputSchema = z.object({
  summary: z.string().describe("A concise summary of the weather forecast for the next 24-48 hours."),
  temperatureHigh: z.number().describe("Predicted highest temperature in Celsius for the forecast period."),
  temperatureLow: z.number().describe("Predicted lowest temperature in Celsius for the forecast period."),
  precipitationChance: z.number().min(0).max(100).describe("Chance of precipitation as a percentage (0-100) for the forecast period, interpreted from precipitation status like 'No Rain' or 'Rain'."),
  windConditions: z.string().describe("Description of expected wind conditions (e.g., 'Light breeze from NW at 10 km/h')."),
  aqiOutlook: z.string().describe("A brief outlook on the Air Quality based on the provided PPM values (e.g., 'Air quality expected to remain good based on PPM levels').")
});
export type GenerateWeatherForecastOutput = z.infer<typeof GenerateWeatherForecastOutputSchema>;

export async function generateWeatherForecast(input: GenerateWeatherForecastInput): Promise<GenerateWeatherForecastOutput> {
  return generateWeatherForecastFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateWeatherForecastPrompt',
  input: {schema: GenerateWeatherForecastInputSchema},
  output: {schema: GenerateWeatherForecastOutputSchema},
  prompt: `You are an expert meteorologist. Your task is to analyze the provided historical weather data for {{location}} and generate a detailed weather forecast for the next 24-48 hours.

The historical data includes:
- timestamp: Unix timestamp in milliseconds
- temperature: in Celsius
- humidity: in percentage
- precipitation: a string describing precipitation status (e.g., "No Rain", "Rain", "Light Rain"). Interpret this to estimate precipitation chance.
- aqi: Air Quality Index in PPM (parts per million) from an MQ135 sensor (numeric value). Higher PPM generally means poorer air quality.
- lux: light level in lux
- pressure: atmospheric pressure in hPa (optional)

Historical Data:
{{{historicalData}}}

Based on this data, provide the following forecast details. Ensure your output strictly adheres to the requested structured format:
- summary: A concise summary of the weather forecast for the next 24-48 hours.
- temperatureHigh: Predicted highest temperature in Celsius for the forecast period.
- temperatureLow: Predicted lowest temperature in Celsius for the forecast period.
- precipitationChance: Chance of precipitation as a percentage (0-100) for the forecast period. For example, if historical data consistently shows "No Rain", the chance should be low. If it shows "Rain", it should be higher.
- windConditions: Description of expected wind conditions (e.g., 'Light breeze from NW at 10 km/h').
- aqiOutlook: A brief outlook on the Air Quality based on the provided PPM values (e.g., 'Air quality expected to remain good based on PPM levels', 'Air quality might degrade due to elevated PPM levels').`,
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
