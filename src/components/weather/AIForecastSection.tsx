
"use client";

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { generateWeatherForecast, type GenerateWeatherForecastInput, type GenerateWeatherForecastOutput } from '@/ai/flows/generate-weather-forecast';
import { Wand2, Thermometer, CloudDrizzle, WindIcon, CheckCircle, Leaf, CalendarDays } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from '@/components/ui/skeleton';
import type { WeatherDataPoint } from '@/types/weather';
import AIForecastChart from './AIForecastChart';

const sampleHistoricalDataForAI: { timestamp: number; temperature: number; humidity: number; precipitation: string; aqi: number; lux: number; pressure?: number }[] = [
  { timestamp: Date.now() - 86400000 * 2, temperature: 22, humidity: 70, precipitation: "Rain", aqi: 60, lux: 100, pressure: 1010 },
  { timestamp: Date.now() - 86400000, temperature: 24, humidity: 65, precipitation: "No Rain", aqi: 45, lux: 150, pressure: 1012 },
  { timestamp: Date.now(), temperature: 25, humidity: 60, precipitation: "No Rain", aqi: 50, lux: 120, pressure: 1011 },
];

interface AIForecastSectionProps {
  initialDataForForecast?: WeatherDataPoint[] | null;
}

const AIForecastSection: FC<AIForecastSectionProps> = ({ initialDataForForecast }) => {
  const [location, setLocation] = useState<string>('Local Area');
  const [forecast, setForecast] = useState<GenerateWeatherForecastOutput | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
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
      const aiInputData = initialDataForForecast.map(p => ({
        timestamp: p.timestamp,
        temperature: p.temperature,
        humidity: p.humidity,
        precipitation: p.precipitation,
        aqi: p.aqiPpm, 
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
    } else if (initialDataForForecast && initialDataForForecast.length === 0) {
       setCustomHistoricalData('');
       toast({
         title: "Chart Selection Cleared or Empty",
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
      const dataToParse = customHistoricalData.trim() === '' ? JSON.stringify(sampleHistoricalDataForAI, null, 2) : customHistoricalData;
      const parsedData = JSON.parse(dataToParse);

      if (!Array.isArray(parsedData) || !parsedData.every(item =>
        typeof item.timestamp === 'number' &&
        typeof item.temperature === 'number' &&
        typeof item.humidity === 'number' &&
        typeof item.precipitation === 'string' &&
        typeof item.aqi === 'number' && 
        typeof item.lux === 'number' &&
        (item.pressure === undefined || typeof item.pressure === 'number')
      )) {
        throw new Error("Data does not conform to AI's expected historical data structure (ensure 'aqi' is numerical PPM, 'precipitation' is string).");
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

    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[AIForecastSection] Attempt ${attempt} to generate forecast.`);
        const result = await generateWeatherForecast(input);
        setForecast(result);
        setIsLoading(false);
        return; 
      } catch (error: any) {
        console.error(`Error generating forecast (attempt ${attempt}):`, error);

        const is503Error = error.message && (error.message.includes('503 Service Unavailable') || error.message.includes('503') || error.message.includes('model is overloaded'));

        if (is503Error) {
          if (attempt < MAX_RETRIES) {
            const delay = attempt * 1500; 
            toast({
              title: `Forecast Attempt ${attempt} Failed (Model Overloaded)`,
              description: `Retrying in ${delay / 1000}s...`,
              duration: delay + 500,
            });
            await new Promise(resolve => setTimeout(resolve, delay));
            
          } else {
            
            toast({
              title: "Forecast Generation Failed",
              description: `The AI model is currently overloaded. Please try again later. (Failed after ${MAX_RETRIES} attempts)`,
              variant: "destructive",
            });
            setForecast(null);
            setIsLoading(false);
            return; 
          }
        } else {
          
          toast({
            title: "Forecast Generation Error",
            description: `An unexpected error occurred: ${error instanceof Error ? error.message : 'Please check console.'}`,
            variant: "destructive",
          });
          setForecast(null);
          setIsLoading(false);
          return; 
        }
      }
    }
    
    setIsLoading(false);
  };


  return (
    <section className="mb-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline flex items-center">
            <Wand2 className="mr-2 h-5 w-5 text-accent" />
            AI-Powered Weather Forecast
          </CardTitle>
          <CardDescription>
            Use AI to predict upcoming weather. 
            Click a point on the chart in the &quot;Historical Data Analysis&quot; section, or use the &quot;Use All Displayed Data for AI Forecast&quot; button there to auto-fill historical data. 
            You can also manually input a JSON array below. The AI expects 'aqi' to be the numerical PPM value.
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
              placeholder="Click a point on the chart or use the button in Historical section, or enter historical weather data as JSON array..."
              rows={8}
              className="mt-1 font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Each point should include: timestamp (number), temperature (number), humidity (number), precipitation (string, e.g., "No Rain"), aqi (number, in PPM), lux (number). Pressure (number) is optional.
            </p>
          </div>

          {isLoading && (
            <div className="space-y-3 pt-4 mt-4 border-t">
              <Skeleton className="h-6 w-1/3 mb-3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
              <Skeleton className="h-40 w-full mt-4" /> 
            </div>
          )}

          {forecast && !isLoading && (
            <div className="space-y-4 pt-4 mt-4 border-t">
              <h3 className="text-xl font-semibold text-primary mb-2">Forecast for {location}:</h3>

              <p className="text-sm bg-secondary/50 p-3 rounded-md"><strong className="font-medium">Overall Summary:</strong> {forecast.overallSummary}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center bg-muted/30 p-3 rounded-md">
                   <WindIcon className="mr-2 h-5 w-5 text-accent" />
                  <strong className="font-medium">Wind:</strong>&nbsp;{forecast.windConditions}
                </div>
                 <div className="flex items-center bg-muted/30 p-3 rounded-md">
                   <Leaf className="mr-2 h-5 w-5 text-accent" />
                  <strong className="font-medium">AQI Outlook:</strong>&nbsp;{forecast.aqiOutlook}
                </div>
              </div>

              {forecast.dailyForecasts && forecast.dailyForecasts.length > 0 && (
                <AIForecastChart dailyForecasts={forecast.dailyForecasts} />
              )}

              {forecast.dailyForecasts && forecast.dailyForecasts.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h4 className="text-lg font-semibold text-primary-700">Daily Details:</h4>
                  {forecast.dailyForecasts.map((day, index) => (
                    <Card key={index} className="bg-muted/20 p-4">
                      <CardHeader className="p-0 pb-2">
                        <CardTitle className="text-md font-semibold flex items-center">
                          <CalendarDays className="mr-2 h-5 w-5 text-accent"/>
                          {new Date(day.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 text-sm space-y-1">
                        <p>{day.daySummary}</p>
                        <div className="flex items-center">
                          <Thermometer className="mr-1 h-4 w-4 text-accent-600"/>
                          High: {day.temperatureHigh}°C, Low: {day.temperatureLow}°C
                        </div>
                        <div className="flex items-center">
                          <CloudDrizzle className="mr-1 h-4 w-4 text-accent-600"/>
                          Precipitation: {day.precipitationChance}%
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
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
