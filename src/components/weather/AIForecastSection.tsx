
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

// Sample data for the AI flow input, notice `aqi` is the numerical PPM value.
const sampleHistoricalDataForAI: Omit<WeatherDataPoint, 'airQuality' | 'aqiPpm'> & { aqi: number }[] = [
  { timestamp: Date.now() - 86400000 * 2, temperature: 22, humidity: 70, precipitation: "Rain", aqi: 60, lux: 100, pressure: 1010 },
  { timestamp: Date.now() - 86400000, temperature: 24, humidity: 65, precipitation: "No Rain", aqi: 45, lux: 150, pressure: 1012 },
  { timestamp: Date.now(), temperature: 25, humidity: 60, precipitation: "No Rain", aqi: 50, lux: 120, pressure: 1011 },
];

interface AIForecastSectionProps {
  initialDataForForecast?: WeatherDataPoint[] | null; // This comes from chart selection (WeatherDashboard)
}

const AIForecastSection: FC<AIForecastSectionProps> = ({ initialDataForForecast }) => {
  const [location, setLocation] = useState<string>('Local Area');
  const [forecast, setForecast] = useState<GenerateWeatherForecastOutput | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // customHistoricalData is a string representation of data for the AI flow (expects 'aqi' as PPM)
  const [customHistoricalData, setCustomHistoricalData] = useState<string>(JSON.stringify(sampleHistoricalDataForAI, null, 2));
  const { toast } = useToast();

  useEffect(() => {
    if (initialDataForForecast === null) {
       setCustomHistoricalData('');
       toast({
         title: "Chart Selection Cleared",
         description: "Historical data input for AI forecast has been cleared.",
         duration: 3000,
       });
    } else if (initialDataForForecast && initialDataForForecast.length > 0) {
      // Map WeatherDataPoint (with aqiPpm) to the structure expected by the AI (with aqi for PPM)
      const aiInputData = initialDataForForecast.map(p => ({
        timestamp: p.timestamp,
        temperature: p.temperature,
        humidity: p.humidity,
        precipitation: p.precipitation,
        aqi: p.aqiPpm, // Map aqiPpm to aqi for the AI
        lux: p.lux,
        pressure: p.pressure,
      }));
      setCustomHistoricalData(JSON.stringify(aiInputData, null, 2));
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
    } else if (initialDataForForecast && initialDataForForecast.length === 0 && customHistoricalData !== '') {
       setCustomHistoricalData(''); 
       toast({
         title: "Chart Selection Cleared or Empty",
         description: "Historical data input for AI forecast has been cleared.",
         duration: 3000,
       });
    }
    // If initialDataForForecast is undefined, do nothing to preserve manual input.
  }, [initialDataForForecast, toast, customHistoricalData]);


  const handleGenerateForecast = async () => {
    setIsLoading(true);
    setForecast(null);

    let historicalDataToUse: string;
    try {
      const dataToParse = customHistoricalData.trim() === '' ? JSON.stringify(sampleHistoricalDataForAI, null, 2) : customHistoricalData;
      const parsedData = JSON.parse(dataToParse);
      
      // Validation for the AI input structure (expects 'aqi' for PPM)
      if (!Array.isArray(parsedData) || !parsedData.every(item =>
        typeof item.timestamp === 'number' &&
        typeof item.temperature === 'number' &&
        typeof item.humidity === 'number' &&
        typeof item.precipitation === 'string' && // This is correct for AI input
        typeof item.aqi === 'number' && // Expects 'aqi' as number (PPM) for AI
        typeof item.lux === 'number' &&
        (item.pressure === undefined || typeof item.pressure === 'number')
      )) {
        throw new Error("Data does not conform to AI's expected historical data structure (aqi should be number (PPM), precipitation should be string).");
      }
      historicalDataToUse = dataToParse;
       if (customHistoricalData.trim() === '') {
        setCustomHistoricalData(historicalDataToUse);
      }
    } catch (error: any) {
      toast({
        title: "Invalid JSON or Data Structure for AI",
        description: `The historical data is not valid or does not match AI's required structure. Error: ${error.message}. Using sample data instead.`,
        variant: "destructive",
        duration: 7000,
      });
      historicalDataToUse = JSON.stringify(sampleHistoricalDataForAI, null, 2);
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
            Use AI to predict upcoming weather. Click a point or drag on the chart above to auto-fill historical data, or manually input a JSON array. The AI expects 'aqi' to be the numerical PPM value.
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
            <Label htmlFor="historical-data" className="text-sm font-medium">Historical Data (JSON array)</Label>
            <Textarea
              id="historical-data"
              value={customHistoricalData}
              onChange={(e) => setCustomHistoricalData(e.target.value)}
              placeholder="Click or drag on the chart above, or enter historical weather data as JSON array..."
              rows={8}
              className="mt-1 font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Each point should include: timestamp (number), temperature (number), humidity (number), precipitation (string, e.g., "No Rain"), aqi (number, in PPM), lux (number). Pressure (number) is optional.
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
                  <strong className="font-medium">Precipitation Chance:</strong> {forecast.precipitationChance}%
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

