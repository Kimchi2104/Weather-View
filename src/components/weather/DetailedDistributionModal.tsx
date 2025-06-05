
"use client";

import type { FC } from 'react';
import React, { useMemo, useEffect } from 'react'; // Added useEffect
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WeatherDataPoint, MetricConfig, MetricKey } from '@/types/weather'; // Added MetricKey
import { formatTimestampToFullUTC } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'; // Removed Legend
import { Card, CardContent, CardHeader, CardTitle as ModalCardTitle } from '@/components/ui/card';


export interface DetailModalData {
  metricKey: MetricKey; // Added metricKey
  metricConfig: MetricConfig;
  aggregationLabel: string;
  stats: {
    avg?: number;
    min?: number;
    max?: number;
    stdDev?: number;
    count?: number;
  };
  rawPoints: WeatherDataPoint[];
}

interface DetailedDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DetailModalData | null;
}

// Helper to get the correct data key from a raw point based on metricConfig
const getMetricValueFromPoint = (point: WeatherDataPoint, metricKey: MetricKey, metricConfig: MetricConfig): number | string | undefined => {
  const value = point[metricKey]; // Direct access using the actual key

  if (metricConfig.isString) {
    return typeof value === 'string' ? value : (value !== undefined && value !== null ? String(value) : undefined);
  } else {
    const num = Number(value);
    return isFinite(num) ? num : undefined;
  }
};

const DetailedDistributionModal: FC<DetailedDistributionModalProps> = ({ isOpen, onClose, data }) => {
  
  const histogramData = useMemo(() => {
    if (!data || !data.rawPoints || data.rawPoints.length === 0 || data.metricConfig.isString) {
      return null;
    }

    const values = data.rawPoints
      .map(point => getMetricValueFromPoint(point, data.metricKey, data.metricConfig))
      .filter((v): v is number => typeof v === 'number' && isFinite(v));

    if (values.length < 2) return null; 

    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);

    if (dataMin === dataMax) { 
        return [{ range: `${dataMin.toFixed(2)} ${data.metricConfig.unit}`, count: values.length, min: dataMin, max: dataMax }];
    }

    const numBins = Math.min(10, Math.max(3, Math.floor(Math.sqrt(values.length))));
    const binWidth = (dataMax - dataMin) / numBins;

    const bins = Array(numBins).fill(0).map((_, i) => {
      const binStart = dataMin + i * binWidth;
      const binEnd = dataMin + (i + 1) * binWidth;
      return {
        range: `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`,
        min: binStart,
        max: binEnd,
        count: 0,
      };
    });

    values.forEach(value => {
      for (let i = 0; i < bins.length; i++) {
        if (value >= bins[i].min && (value < bins[i].max || (i === bins.length - 1 && value <= bins[i].max + 0.00001))) { 
          bins[i].count++;
          break;
        }
      }
    });
    return bins.filter(bin => bin.count > 0 || bins.length ===1); 
  }, [data]);

  useEffect(() => {
    if (isOpen && data) {
      console.log('[DetailedDistributionModal] Modal Open. Data received:', JSON.parse(JSON.stringify(data)));
      console.log('[DetailedDistributionModal] Calculated histogramData:', histogramData);
    }
  }, [isOpen, data, histogramData]);


  if (!isOpen || !data) {
    return null;
  }

  const { metricKey, metricConfig, aggregationLabel, stats, rawPoints } = data;


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl">
            Detailed View: {metricConfig.name}
          </DialogTitle>
          <DialogDescription>
            Distribution analysis for the aggregation period: {aggregationLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 flex-shrink-0">
            <Card>
                <CardHeader className="pb-2 pt-4">
                    <ModalCardTitle className="text-md font-semibold">Summary Statistics</ModalCardTitle>
                </CardHeader>
                <CardContent className="text-sm grid grid-cols-2 gap-x-4 gap-y-1">
                    {stats.avg !== undefined && (
                        <div className="flex justify-between"><span>Average:</span> <span className="font-semibold text-primary">{stats.avg.toFixed(2)} {metricConfig.unit}</span></div>
                    )}
                    {stats.min !== undefined && (
                         <div className="flex justify-between"><span>Min:</span> <span className="font-semibold text-primary">{stats.min.toFixed(2)} {metricConfig.unit}</span></div>
                    )}
                    {stats.max !== undefined && (
                         <div className="flex justify-between"><span>Max:</span> <span className="font-semibold text-primary">{stats.max.toFixed(2)} {metricConfig.unit}</span></div>
                    )}
                    {stats.stdDev !== undefined && (
                         <div className="flex justify-between"><span>Std. Dev:</span> <span className="font-semibold text-primary">{stats.stdDev.toFixed(2)} {metricConfig.unit}</span></div>
                    )}
                    {stats.count !== undefined && (
                         <div className="flex justify-between col-span-2"><span>Data Points:</span> <span className="font-semibold text-primary">{stats.count}</span></div>
                    )}
                </CardContent>
            </Card>
            
            {histogramData && histogramData.length > 0 && !metricConfig.isString && (
                 <Card>
                    <CardHeader className="pb-2 pt-4">
                        <ModalCardTitle className="text-md font-semibold">Value Distribution (Histogram)</ModalCardTitle>
                    </CardHeader>
                    <CardContent className="h-[150px] p-0 pr-4 pb-2">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={histogramData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="range" angle={-25} textAnchor="end" height={40} tick={{ fontSize: 9 }} interval={0} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                                <Tooltip
                                    formatter={(value: number) => [`${value} points`, 'Count']}
                                    labelFormatter={(label: string) => `Range: ${label} ${metricConfig.unit}`}
                                    cursor={{fill: 'hsl(var(--accent) / 0.3)'}}
                                />
                                <Bar dataKey="count" fill={metricConfig.color || 'hsl(var(--primary))'} radius={[2, 2, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
             {(!histogramData || histogramData.length === 0) && !metricConfig.isString && (
                <Card className="flex items-center justify-center h-full">
                    <CardContent className="text-center text-muted-foreground">
                        <p>Not enough data or variation for a histogram.</p>
                    </CardContent>
                </Card>
            )}
            {metricConfig.isString && (
                 <Card className="flex items-center justify-center h-full">
                    <CardContent className="text-center text-muted-foreground">
                        <p>Histogram not applicable for textual data.</p>
                    </CardContent>
                </Card>
            )}

        </div>

        <div className="flex-grow overflow-hidden mt-2">
          <h4 className="text-md font-semibold mb-2 text-muted-foreground">Contributing Raw Data Points ({rawPoints.length} points):</h4>
          <ScrollArea className="h-[250px] border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Timestamp (UTC)</TableHead>
                  <TableHead className="text-right">Value ({metricConfig.unit || 'N/A'})</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rawPoints.length > 0 ? (
                  rawPoints.map((point, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-xs">
                        {formatTimestampToFullUTC(point.timestamp)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        { metricConfig.isString 
                          ? (getMetricValueFromPoint(point, metricKey, metricConfig) as string || 'N/A') 
                          : (getMetricValueFromPoint(point, metricKey, metricConfig) as number | undefined)?.toFixed(metricConfig.unit === 'ppm' ? 0 : 2) ?? 'N/A'
                        }
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      No raw data points for this aggregate.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        <DialogFooter className="mt-4 flex-shrink-0">
          <Button onClick={onClose} variant="outline">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DetailedDistributionModal;

    