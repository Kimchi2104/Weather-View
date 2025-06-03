
"use client";

import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import DateRangePicker from './DateRangePicker';
import type { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';
import { database } from '@/lib/firebase';
import { ref, get, type DataSnapshot } from "firebase/database";
import type { RawFirebaseDataPoint } from '@/types/weather';
import { parseCustomTimestamp } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface RawDataTableRow extends RawFirebaseDataPoint {
  id: string; // Firebase key
  parsedTimestamp: number | null; // For filtering
}

const RawDataViewer: FC = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 1), // Default to last 1 day for raw data viewer
    to: new Date(),
  });
  const [startTime, setStartTime] = useState<string>("00:00");
  const [endTime, setEndTime] = useState<string>("23:59");
  const [allFetchedRawData, setAllFetchedRawData] = useState<RawDataTableRow[]>([]);
  const [displayedData, setDisplayedData] = useState<RawDataTableRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const firebaseDataPath = 'devices/TGkMhLL4k4ZFBwgOyRVNKe5mTQq1/records/';

  const fetchAllRawData = useCallback(async () => {
    setIsLoading(true);
    setAllFetchedRawData([]);
    setDisplayedData([]);
    try {
      const dataRef = ref(database, firebaseDataPath);
      const snapshot: DataSnapshot = await get(dataRef);

      if (snapshot.exists()) {
        const rawDataContainer = snapshot.val();
        if (typeof rawDataContainer !== 'object' || rawDataContainer === null) {
          setAllFetchedRawData([]);
          setIsLoading(false);
          return;
        }

        const recordsArray: [string, RawFirebaseDataPoint][] = Object.entries(rawDataContainer);
        const processedData: RawDataTableRow[] = recordsArray
          .map(([key, rawPoint]) => ({
            ...rawPoint,
            id: key,
            parsedTimestamp: parseCustomTimestamp(rawPoint.timestamp),
          }))
          .filter(item => item.parsedTimestamp !== null)
          .sort((a, b) => (b.parsedTimestamp as number) - (a.parsedTimestamp as number)); 

        setAllFetchedRawData(processedData);
      } else {
        setAllFetchedRawData([]);
      }
    } catch (error) {
      console.error("[RawDataViewer] Firebase raw data fetching error:", error);
      setAllFetchedRawData([]);
    } finally {
      setIsLoading(false);
    }
  }, [firebaseDataPath]);

  const filterDataByDateTimeRange = useCallback(() => {
    if (isLoading) return;
    if (!dateRange?.from || !dateRange?.to) {
      setDisplayedData([]);
      return;
    }
    if (allFetchedRawData.length === 0) {
      setDisplayedData([]);
      return;
    }

    const fromDate = new Date(dateRange.from);
    const [startH, startM] = startTime.split(':').map(Number);
    fromDate.setHours(startH, startM, 0, 0);
    const fromTimestamp = fromDate.getTime();

    const toDate = new Date(dateRange.to);
    const [endH, endM] = endTime.split(':').map(Number);
    toDate.setHours(endH, endM, 59, 999); // Inclusive of the last minute
    const toTimestamp = toDate.getTime();

    const filtered = allFetchedRawData.filter(point => {
      if (point.parsedTimestamp === null) return false;
      return point.parsedTimestamp >= fromTimestamp && point.parsedTimestamp <= toTimestamp;
    });
    setDisplayedData(filtered);
  }, [allFetchedRawData, dateRange, isLoading, startTime, endTime]);

  useEffect(() => {
    fetchAllRawData();
  }, [fetchAllRawData]);

  useEffect(() => {
    filterDataByDateTimeRange();
  }, [dateRange, allFetchedRawData, filterDataByDateTimeRange, startTime, endTime]);

  const tableHeaders: { key: keyof RawFirebaseDataPoint | 'timestamp'; label: string }[] = [
    { key: 'timestamp', label: 'Timestamp (Raw)' },
    { key: 'temperature', label: 'Temp (°C)' },
    { key: 'humidity', label: 'Humidity (%)' },
    { key: 'rainStatus', label: 'Rain Status' },
    { key: 'airQuality', label: 'Air Quality' },
    { key: 'mq135PPM', label: 'AQI (PPM)' },
    { key: 'lux', label: 'Light (Lux)' },
    { key: 'pressure', label: 'Pressure (hPa)' },
  ];

  return (
    <section className="mb-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Raw Device Data Viewer</CardTitle>
          <CardDescription>
            View raw data records from your Firebase Realtime Database. Select a date and time range to filter.
            Data is sorted by timestamp in descending order (newest first).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div className="sm:col-span-2">
                    <Label htmlFor="raw-data-date-range" className="text-sm font-medium text-muted-foreground mb-1 block">Select Date Range:</Label>
                    <DateRangePicker onDateChange={setDateRange} initialRange={dateRange} id="raw-data-date-range" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <Label htmlFor="start-time-raw" className="text-sm font-medium text-muted-foreground mb-1 block">Start Time:</Label>
                        <Input 
                            type="time" 
                            id="start-time-raw" 
                            value={startTime} 
                            onChange={(e) => setStartTime(e.target.value)}
                            className="w-full"
                        />
                    </div>
                    <div>
                        <Label htmlFor="end-time-raw" className="text-sm font-medium text-muted-foreground mb-1 block">End Time:</Label>
                        <Input 
                            type="time" 
                            id="end-time-raw" 
                            value={endTime} 
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>
            <Button onClick={fetchAllRawData} disabled={isLoading} className="w-full md:w-auto lg:w-full">
              {isLoading ? 'Loading Data...' : 'Refresh Data'}
            </Button>
          </div>
           <p className="text-xs text-muted-foreground">
            Displaying raw data from Firebase path: `{firebaseDataPath}`. Time selection applies to the chosen date range.
          </p>

          {isLoading && allFetchedRawData.length === 0 ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-8 w-full opacity-75" />
              <Skeleton className="h-8 w-full opacity-50" />
              <Skeleton className="h-8 w-full opacity-25" />
            </div>
          ) : displayedData.length > 0 ? (
            <ScrollArea className="h-[400px] w-full border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    {tableHeaders.map((header) => (
                      <TableHead key={header.key}>{header.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedData.map((row) => (
                    <TableRow key={row.id}>
                      {tableHeaders.map(header => (
                        <TableCell key={`${row.id}-${header.key}`}>
                          {String(row[header.key as keyof RawFirebaseDataPoint] ?? 'N/A')}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              {allFetchedRawData.length > 0 ? 'No data available for the selected date and time range.' : 'No data found at the Firebase path, or failed to load.'}
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
};

export default RawDataViewer;
