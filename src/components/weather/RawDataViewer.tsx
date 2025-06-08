
"use client";

import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import DateRangePicker from './DateRangePicker';
import type { DateRange } from 'react-day-picker';
import { subDays, format as formatDateFns } from 'date-fns';
import { database } from '@/lib/firebase';
import { ref, get, type DataSnapshot } from "firebase/database";
import type { RawFirebaseDataPoint } from '@/types/weather';
import { parseCustomTimestamp } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface RawDataTableRow extends RawFirebaseDataPoint {
  id: string; // Firebase key
  parsedTimestamp: number | null; // For filtering
  sunriseSunset?: string; // Derived
}

const RawDataViewer: FC = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    const sevenDaysAgo = subDays(today, 7);
    return {
      from: sevenDaysAgo < today ? sevenDaysAgo : today, // Ensure 'from' isn't after 'to'
      to: today,
    };
  });
  const [startTime, setStartTime] = useState<string>("00:00");
  const [endTime, setEndTime] = useState<string>("23:59");
  const [allFetchedRawData, setAllFetchedRawData] = useState<RawDataTableRow[]>([]);
  const [displayedData, setDisplayedData] = useState<RawDataTableRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const firebaseDataPath = 'devices/TGkMhLL4k4ZFBwgOyRVNKe5mTQq1/records/';

  const tableHeaders: { key: keyof RawFirebaseDataPoint | 'timestamp' | 'sunriseSunset'; label: string }[] = [
    { key: 'timestamp', label: 'Timestamp (Raw)' },
    { key: 'temperature', label: 'Temp (°C)' },
    { key: 'humidity', label: 'Humidity (%)' },
    { key: 'rainStatus', label: 'Rain Status' },
    { key: 'airQuality', label: 'Air Quality' },
    { key: 'mq135PPM', label: 'AQI (PPM)' },
    { key: 'lux', label: 'Light (Lux)' },
    { key: 'sunriseSunset', label: 'Day/Night' },
    { key: 'pressure', label: 'Pressure (hPa)' },
  ];

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
          .map(([key, rawPoint]) => {
            const luxVal = typeof rawPoint.lux === 'number' ? rawPoint.lux : 0;
            const sunriseSunsetVal = luxVal > 0 ? "Sunrise" : "Sunset";
            return {
              ...rawPoint,
              id: key,
              parsedTimestamp: parseCustomTimestamp(rawPoint.timestamp),
              sunriseSunset: sunriseSunsetVal,
            };
          })
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

    const [startH, startM] = startTime.split(':').map(Number);
    const fromDateObj = dateRange.from;
    const fromTimestamp = Date.UTC(
      fromDateObj.getFullYear(),
      fromDateObj.getMonth(),
      fromDateObj.getDate(),
      startH, startM, 0, 0
    );

    const [endH, endM] = endTime.split(':').map(Number);
    const toDateObj = dateRange.to;
    const toTimestamp = Date.UTC(
      toDateObj.getFullYear(),
      toDateObj.getMonth(),
      toDateObj.getDate(),
      endH, endM, 59, 999
    );

    console.log(`[RawDataViewer] Filtering data for UTC datetime range: ${new Date(fromTimestamp).toISOString()} to ${new Date(toTimestamp).toISOString()}`);

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
    if (dateRange) {
      filterDataByDateTimeRange();
    }
  }, [dateRange, allFetchedRawData, filterDataByDateTimeRange, startTime, endTime]);

  const generateFilename = (extension: string): string => {
    return `raw_data_export_${formatDateFns(new Date(), 'yyyyMMdd_HHmmss')}.${extension}`;
  };

  const triggerDownload = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const exportToCSV = () => {
    if (displayedData.length === 0) return;
    const headers = ['ID', ...tableHeaders.map(h => h.label)];
    const rows = displayedData.map(row => [
      row.id,
      ...tableHeaders.map(header => {
        if (header.key === 'sunriseSunset') return row.sunriseSunset ?? 'N/A';
        return String(row[header.key as keyof RawFirebaseDataPoint] ?? 'N/A');
      })
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');
    triggerDownload(csvContent, generateFilename('csv'), 'text/csv;charset=utf-8;');
  };

  const exportToTXT = () => {
    if (displayedData.length === 0) return;
    let txtContent = `Raw Data Export - ${formatDateFns(new Date(), 'yyyy-MM-dd HH:mm:ss')}\n`;
    txtContent += `Date Range: ${dateRange?.from ? formatDateFns(dateRange.from, 'yyyy-MM-dd') : 'N/A'} ${startTime} to ${dateRange?.to ? formatDateFns(dateRange.to, 'yyyy-MM-dd') : 'N/A'} ${endTime}\n`;
    txtContent += `Total Records: ${displayedData.length}\n\n`;

    displayedData.forEach((row, index) => {
      txtContent += `Record ${index + 1}\n`;
      txtContent += `ID: ${row.id}\n`;
      tableHeaders.forEach(header => {
        let value;
        if (header.key === 'sunriseSunset') {
          value = row.sunriseSunset ?? 'N/A';
        } else {
          value = String(row[header.key as keyof RawFirebaseDataPoint] ?? 'N/A');
        }
        txtContent += `${header.label}: ${value}\n`;
      });
      txtContent += '---\n';
    });
    triggerDownload(txtContent, generateFilename('txt'), 'text/plain;charset=utf-8;');
  };

  const escapeXml = (unsafe: string): string => {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  };

  const exportToXML = () => {
    if (displayedData.length === 0) return;
    let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<records>\n';
    displayedData.forEach(row => {
      xmlContent += '  <record>\n';
      xmlContent += `    <id>${escapeXml(row.id)}</id>\n`;
      tableHeaders.forEach(header => {
        const key = header.label.replace(/\s+/g, '').replace(/[^a-zA-Z0-9_]/g, '_'); 
        let value;
        if (header.key === 'sunriseSunset') {
          value = row.sunriseSunset ?? 'N/A';
        } else {
          value = String(row[header.key as keyof RawFirebaseDataPoint] ?? 'N/A');
        }
        xmlContent += `    <${key}>${escapeXml(value)}</${key}>\n`;
      });
      xmlContent += '  </record>\n';
    });
    xmlContent += '</records>';
    triggerDownload(xmlContent, generateFilename('xml'), 'application/xml;charset=utf-8;');
  };


  return (
    <section className="mb-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Raw Device Data Viewer</CardTitle>
          <CardDescription>
            View raw data records from your Firebase Realtime Database. Select a date and time range to filter, then export if needed.
            Data is sorted by timestamp in descending order (newest first).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div>
                <Label htmlFor="raw-data-date-range" className="text-sm font-medium text-muted-foreground mb-1 block">Select Date Range:</Label>
                <DateRangePicker onDateChange={setDateRange} initialRange={dateRange} id="raw-data-date-range" />
              </div>

              <div className="grid grid-cols-2 gap-2 items-end">
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

            <div className="lg:col-span-1 flex flex-col space-y-2 lg:space-y-0 lg:flex-row lg:space-x-2 lg:items-end">
              <Button onClick={fetchAllRawData} disabled={isLoading} className="w-full lg:flex-1">
                {isLoading ? 'Loading...' : 'Refresh Data'}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full lg:flex-1" disabled={displayedData.length === 0 && !isLoading}>
                    <Download className="mr-2 h-4 w-4" /> Export Data
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportToCSV}>Export as CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToTXT}>Export as TXT</DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToXML}>Export as XML</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
                    <TableHead>ID (Firebase Key)</TableHead>
                    {tableHeaders.map((header) => (
                      <TableHead key={header.key}>{header.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedData.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.id}</TableCell>
                      {tableHeaders.map(header => (
                        <TableCell key={`${row.id}-${header.key}`}>
                           {header.key === 'sunriseSunset'
                            ? row.sunriseSunset ?? 'N/A'
                            : String(row[header.key as keyof RawFirebaseDataPoint] ?? 'N/A')}
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

