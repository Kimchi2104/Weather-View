"use client";

import type { FC } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { generateWeatherForecast, type GenerateWeatherForecastInput } from '@/ai/flows/generate-weather-forecast';
import { Wand2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';

// Sample historical data for the AI model (replace with actual data fetching if needed)
const sampleHistoricalData = [
  { timestamp: Date.now() - 86400000 * 2, temperature: 22, humidity: 70, precipitation: 0, airQualityIndex: 30, lightPollution: 100 },
  { timestamp: Date.now() - 86400000, temperature: 24, humidity: 65, precipitation: 2, airQualityIndex: 40, lightPollution: 150 },
  { timestamp: Date.now(), temperature: 25, humidity: 60, precipitation: 0, airQualityIndex: 35, lightPollution: 120 },
];

const AIForecastSection: FC = () => {
  const [location, setLocation] = useState<string>('Local Area'); // Default or user input
  const [forecast, setForecast] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [customHistoricalData, setCustomHistoricalData] = useState<string>(JSON.stringify(sampleHistoricalData, null, 2));
  const { toast } = useToast();

  const handleGenerateForecast = async () => {
    setIsLoading(true);
    setForecast(null);

    let historicalDataToUse: string;
    try {
      // Validate if customHistoricalData is valid JSON
      JSON.parse(customHistoricalData);
      historicalDataToUse = customHistoricalData;
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: "The provided historical data is not valid JSON. Using sample data instead.",
        variant: "destructive",
      });
      historicalDataToUse = JSON.stringify(sampleHistoricalData, null, 2);
      setCustomHistoricalData(historicalDataToUse); // Update textarea with sample data
    }
    
    const input: GenerateWeatherForecastInput = {
      historicalData: historicalDataToUse,
      location: location || 'Local Area',
    };

    try {
      const result = await generateWeatherForecast(input);
      setForecast(result.forecast);
    } catch (error) {
      console.error('Error generating forecast:', error);
      setForecast('Failed to generate forecast. Please try again.');
      toast({
        title: "Forecast Error",
        description: "Could not generate forecast. Check console for details.",
        variant: "destructive",
      });
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
            Use AI to predict upcoming weather conditions based on historical data.
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
            <Label htmlFor="historical-data" className="text-sm font-medium">Historical Data (JSON)</Label>
            <Textarea
              id="historical-data"
              value={customHistoricalData}
              onChange={(e) => setCustomHistoricalData(e.target.value)}
              placeholder="Enter historical weather data as JSON array..."
              rows={8}
              className="mt-1 font-code text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Provide an array of data points. Each point should include: timestamp, temperature, humidity, precipitation, airQualityIndex, lightPollution.
            </p>
          </div>
          
          {isLoading && (
            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}

          {forecast && !isLoading && (
            <div>
              <h3 className="font-semibold mb-1">Forecast:</h3>
              <p className="text-sm bg-secondary p-3 rounded-md whitespace-pre-wrap">{forecast}</p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleGenerateForecast} disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? (
              <>
                <Wand2 className="mr-2 h-4 w-4 animate-pulse" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Generate Forecast
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </section>
  );
};

export default AIForecastSection;
