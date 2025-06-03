
"use client";

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { generateWeatherForecast, type GenerateWeatherForecastInput, type GenerateWeatherForecastOutput } from '@/ai/flows/generate-weather-forecast';
import { Wand2, Thermometer, CloudDrizzle, WindIcon, CheckCircle, Leaf } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import type { WeatherDataPoint } from '@/types/weather';

// Sample historical data (can be kept for manual testing or fallback if initialDataForForecast is null)
const sampleHistoricalData: WeatherDataPoint[] = [
  { timestamp: Date.now() - 86400000 * 2, temperature: 22, humidity: 70, precipitation: 4000, airQualityIndex: 30, lux: 100 },
  { timestamp: Date.now() - 86400000, temperature: 24, humidity: 65, precipitation: 2000, airQualityIndex: 40, lux: 150 },
  { timestamp: Date.now(), temperature: 25, humidity: 60, precipitation: 0, airQualityIndex: 35, lux: 120 },
];

interface AIForecastSectionProps {
  initialDataForForecast?: WeatherDataPoint[] | null;
}

const AIForecastSection: FC<AIForecastSectionProps> = ({ initialDataForForecast }) => {
  const [location, setLocation] = useState<string>('Local Area');
  const [forecast, setForecast] = useState<GenerateWeatherForecastOutput | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [customHistoricalData, setCustomHistoricalData] = useState<string>(JSON.stringify(sampleHistoricalData, null, 2));
  const { toast } = useToast();

  useEffect(() => {
    if (initialDataForForecast === null || initialDataForForecast === undefined) {
      // On initial load or if explicitly set to null, use sample data
      // This ensures the textarea isn't empty before any chart interaction
      if (customHistoricalData !== JSON.stringify(sampleHistoricalData, null, 2)) { // Avoid unnecessary updates
        setCustomHistoricalData(JSON.stringify(sampleHistoricalData, null, 2));
      }
    } else if (initialDataForForecast.length > 0) {
      setCustomHistoricalData(JSON.stringify(initialDataForForecast, null, 2));
      toast({
        title: "Historical Data Populated for AI Forecast",
        description: `${initialDataForForecast.length} data point(s) from chart ${initialDataForForecast.length === 1 ? 'click' : 'selection'} loaded.`,
        action: (
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            <span>Data Loaded</span>
          </div>
        ),
      });
    } else if (initialDataForForecast.length === 0) {
      // This means the brush selection was cleared or resulted in no points
      setCustomHistoricalData(''); // Clear the textarea
      toast({
        title: "Chart Selection Cleared",
        description: "Historical data input for AI forecast has been cleared.",
        duration: 3000,
      });
    }
  }, [initialDataForForecast, toast]);

  const handleGenerateForecast = async () => {
    setIsLoading(true);
    setForecast(null);

    let historicalDataToUse: string;
    try {
      // Ensure there's data to parse, if customHistoricalData is empty, use sample as a fallback for generation.
      const dataToParse = customHistoricalData.trim() === '' ? JSON.stringify(sampleHistoricalData, null, 2) : customHistoricalData;
      const parsedData = JSON.parse(dataToParse);
      if (!Array.isArray(parsedData) || !parsedData.every(item =>
        typeof item.timestamp === 'number' &&
        typeof item.temperature === 'number' &&
        typeof item.humidity === 'number' &&
        typeof item.precipitation === 'number' &&
        typeof item.airQualityIndex === 'number' &&
        typeof item.lux === 'number'
      )) {
        throw new Error("Data does not conform to expected WeatherDataPoint structure.");
      }
      historicalDataToUse = dataToParse;
       if (customHistoricalData.trim() === '') {
        setCustomHistoricalData(historicalDataToUse); // Update textarea if it was empty and sample data was used
      }
    } catch (error: any) {
      toast({
        title: "Invalid JSON or Data Structure",
        description: `The historical data is not valid or does not match the required structure. Error: ${error.message}. Using sample data instead.`,
        variant: "destructive",
        duration: 7000,
      });
      historicalDataToUse = JSON.stringify(sampleHistoricalData, null, 2);
      setCustomHistoricalData(historicalDataToUse);
    }

    const input: GenerateWeatherForecastInput = {
      historicalData: historicalDataToUse,
      location: location || 'Local Area',
    };

    try {
      const result = await generateWeatherForecast(input);
      setForecast(result);
    } catch (error) {
      console.error('Error generating forecast:', error);
      toast({
        title: "Forecast Generation Error",
        description: `Could not generate forecast. ${error instanceof Error ? error.message : 'Please check console for details.'}`,
        variant: "destructive",
      });
      setForecast(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-headline font-semibold mb-4 text-primary">AI-Powered Weather Forecast</h2>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline flex items-center">
            <Wand2 className="mr-2 h-5 w-5 text-accent" />
            Generate Forecast
          </CardTitle>
          <CardDescription>
            Use AI to predict upcoming weather. Click a point or drag on the chart above to auto-fill historical data, or manually input a JSON array of WeatherDataPoint objects.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="location" className="text-sm font-medium">Location</Label>
            <Input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter location (e.g., San Francisco)"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="historical-data" className="text-sm font-medium">Historical Data (JSON array of WeatherDataPoint)</Label>
            <Textarea
              id="historical-data"
              value={customHistoricalData}
              onChange={(e) => setCustomHistoricalData(e.target.value)}
              placeholder="Click or drag on the chart above, or enter historical weather data as JSON array..."
              rows={8}
              className="mt-1 font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Each point should include numerical fields: timestamp, temperature, humidity, precipitation, airQualityIndex, lux.
            </p>
          </div>

          {isLoading && (
            <div className="space-y-3 pt-2 bg-muted/50 p-4 rounded-md">
              <Skeleton className="h-5 w-1/3 mb-2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
               <Skeleton className="h-4 w-3/4" />
            </div>
          )}

          {forecast && !isLoading && (
            <div className="space-y-3 pt-2 bg-secondary/50 p-4 rounded-md">
              <h3 className="text-lg font-semibold text-primary mb-2">Forecast for {location}:</h3>

              <p className="text-sm"><strong className="font-medium">Summary:</strong> {forecast.summary}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="flex items-center">
                  <Thermometer className="mr-2 h-4 w-4 text-accent" />
                  <strong className="font-medium">High:</strong> {forecast.temperatureHigh}°C
                </div>
                <div className="flex items-center">
                  <Thermometer className="mr-2 h-4 w-4 text-accent" />
                  <strong className="font-medium">Low:</strong> {forecast.temperatureLow}°C
                </div>
                <div className="flex items-center">
                  <CloudDrizzle className="mr-2 h-4 w-4 text-accent" />
                  <strong className="font-medium">Precipitation:</strong> {forecast.precipitationChance}%
                </div>
                <div className="flex items-center">
                   <WindIcon className="mr-2 h-4 w-4 text-accent" />
                  <strong className="font-medium">Wind:</strong> {forecast.windConditions}
                </div>
                 <div className="flex items-center">
                   <Leaf className="mr-2 h-4 w-4 text-accent" />
                  <strong className="font-medium">AQI Outlook:</strong> {forecast.aqiOutlook}
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleGenerateForecast} disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? (
              <>
                <Wand2 className="mr-2 h-4 w-4 animate-pulse" />
                Generating Forecast...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Generate Detailed Forecast
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </section>
  );
};

export default AIForecastSection;
