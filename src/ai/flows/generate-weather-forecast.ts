'use server';

/**
 * @fileOverview Generates a weather forecast based on historical data.
 *
 * - generateWeatherForecast - A function that generates a weather forecast.
 * - GenerateWeatherForecastInput - The input type for the generateWeatherForecast function.
 * - GenerateWeatherForecastOutput - The return type for the generateWeatherForecast function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateWeatherForecastInputSchema = z.object({
  historicalData: z
    .string()
    .describe('Historical weather data in JSON format, including precipitation, temperature, humidity, light pollution level, and air quality index.'),
  location: z.string().describe('The location for which to generate the weather forecast.'),
});
export type GenerateWeatherForecastInput = z.infer<typeof GenerateWeatherForecastInputSchema>;

const GenerateWeatherForecastOutputSchema = z.object({
  forecast: z.string().describe('The weather forecast generated from the historical data.'),
});
export type GenerateWeatherForecastOutput = z.infer<typeof GenerateWeatherForecastOutputSchema>;

export async function generateWeatherForecast(input: GenerateWeatherForecastInput): Promise<GenerateWeatherForecastOutput> {
  return generateWeatherForecastFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateWeatherForecastPrompt',
  input: {schema: GenerateWeatherForecastInputSchema},
  output: {schema: GenerateWeatherForecastOutputSchema},
  prompt: `You are an expert meteorologist. Analyze the following historical weather data for {{location}} and generate a concise weather forecast.

Historical Data:
{{{historicalData}}}

Forecast:`,
});

const generateWeatherForecastFlow = ai.defineFlow(
  {
    name: 'generateWeatherForecastFlow',
    inputSchema: GenerateWeatherForecastInputSchema,
    outputSchema: GenerateWeatherForecastOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
