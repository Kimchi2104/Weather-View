
"use client";

import type { FC } from 'react';
import React, { useMemo, useState } from 'react';
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
import type { WeatherDataPoint, MetricConfig, MetricKey, DetailModalData as DetailModalDataType } from '@/types/weather';
import { formatTimestampToFullUTC } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle as ModalCardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


interface DetailedDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DetailModalDataType | null;
}

const getMetricValueFromPoint = (point: WeatherDataPoint, metricKey: MetricKey, metricConfig?: MetricConfig): number | string | undefined => {
  if (!point || metricKey === undefined) return undefined;

  const value = point[metricKey];

  if (metricConfig?.isString) {
    return typeof value === 'string' ? value : (value !== undefined && value !== null ? String(value) : undefined);
  } else {
    const num = Number(value);
    return isFinite(num) ? num : undefined;
  }
};

const CustomViolinTooltip: FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload; // This is one of the jittered points
    const metricConfig = dataPoint.metricConfig as MetricConfig;
    
    return (
      <div className="bg-popover text-popover-foreground border rounded-md shadow-md p-2 text-xs">
        <p className="font-semibold">{metricConfig?.name || 'Value'}: 
          <span className="font-normal"> {Number(dataPoint.yValue).toFixed(metricConfig?.unit === 'ppm' ? 0 : 2)}{metricConfig?.unit || ''}</span>
        </p>
        {dataPoint.originalTimestamp && (
            <p className="text-muted-foreground text-xs mt-0.5">Time: {formatTimestampToFullUTC(dataPoint.originalTimestamp)}</p>
        )}
      </div>
    );
  }
  return null;
};

// Helper function to calculate quartiles and median
const calculateQuartiles = (arr: number[]): { q1: number; median: number; q3: number } | null => {
  if (!arr || arr.length === 0) return null;
  const sortedArr = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sortedArr.length / 2);
  const median = sortedArr.length % 2 === 1 ? sortedArr[mid] : (sortedArr[mid - 1] + sortedArr[mid]) / 2;
  
  const lowerHalf = sortedArr.slice(0, mid);
  const upperHalf = sortedArr.length % 2 === 1 ? sortedArr.slice(mid + 1) : sortedArr.slice(mid);

  const q1 = lowerHalf.length > 0 
    ? (lowerHalf.length % 2 === 1 ? lowerHalf[Math.floor(lowerHalf.length / 2)] : (lowerHalf[lowerHalf.length / 2 - 1] + lowerHalf[lowerHalf.length / 2]) / 2)
    : median; // Fallback for very small arrays

  const q3 = upperHalf.length > 0
    ? (upperHalf.length % 2 === 1 ? upperHalf[Math.floor(upperHalf.length / 2)] : (upperHalf[upperHalf.length / 2 - 1] + upperHalf[upperHalf.length / 2]) / 2)
    : median; // Fallback for very small arrays

  return { q1, median, q3 };
};


const DetailedDistributionModal: FC<DetailedDistributionModalProps> = ({ isOpen, onClose, data }) => {
  const [selectedDistributionChart, setSelectedDistributionChart] = useState<'histogram' | 'violin'>('histogram');

  const numericValuesForDistribution = useMemo(() => {
    if (!data || !data.rawPoints || !data.metricKey || !data.metricConfig || data.metricConfig.isString) {
      return null;
    }
    return data.rawPoints
      .map(point => getMetricValueFromPoint(point, data.metricKey, data.metricConfig))
      .filter((v): v is number => typeof v === 'number' && isFinite(v));
  }, [data]);

  const histogramData = useMemo(() => {
    if (!numericValuesForDistribution || numericValuesForDistribution.length < 2 || !data?.metricConfig) {
      return null;
    }

    const values = numericValuesForDistribution;
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);

    if (dataMin === dataMax) {
      return [{ range: `${dataMin.toFixed(2)} ${data.metricConfig.unit || ''}`, count: values.length, min: dataMin, max: dataMax }];
    }

    const numBins = Math.min(10, Math.max(3, Math.floor(Math.sqrt(values.length))));
    const binWidth = (dataMax - dataMin) / numBins;

    if (binWidth <= 0) {
        return null;
    }

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
  }, [numericValuesForDistribution, data?.metricConfig]);

  const enhancedJitterDataForViolin = useMemo(() => {
    if (!data || !data.rawPoints || !data.metricConfig || data.metricConfig.isString) {
      return { points: [], quartiles: null };
    }
    const points = data.rawPoints
      .map(rawPoint => {
        const yVal = getMetricValueFromPoint(rawPoint, data.metricKey, data.metricConfig);
        if (typeof yVal === 'number' && isFinite(yVal)) {
          return {
            yValue: yVal,
            xJitter: (Math.random() - 0.5) * 0.6, // Jitter between -0.3 and 0.3
            metricConfig: data.metricConfig, // Pass config for tooltip
            originalTimestamp: rawPoint.timestamp, // For tooltip
          };
        }
        return null;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
    
    const values = points.map(p => p.yValue);
    const quartiles = calculateQuartiles(values);

    return { points, quartiles };
  }, [data]);


  const violinYAxisDomain = useMemo(() => {
    if (!enhancedJitterDataForViolin.points || enhancedJitterDataForViolin.points.length === 0) {
      return undefined; 
    }
    const values = enhancedJitterDataForViolin.points.map(p => p.yValue);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    if (minVal === maxVal) {
      return [minVal - 1, maxVal + 1]; 
    }
    const padding = (maxVal - minVal) * 0.1 || 1; 
    return [minVal - padding, maxVal + padding];
  }, [enhancedJitterDataForViolin.points]);


  if (!isOpen || !data) {
    return null;
  }

  const { metricKey, metricConfig, aggregationLabel, stats, rawPoints } = data;
  const canShowDistributionPlots = numericValuesForDistribution && numericValuesForDistribution.length > 0;

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

            <Card>
                <CardHeader className="pb-2 pt-4">
                    <ModalCardTitle className="text-md font-semibold">
                        Value Distribution
                    </ModalCardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Tabs defaultValue="histogram" onValueChange={(value) => setSelectedDistributionChart(value as 'histogram' | 'violin')} className="w-full pt-2">
                        <TabsList className="grid w-full grid-cols-2 mb-1 px-2">
                            <TabsTrigger value="histogram" className="text-xs h-8">Histogram</TabsTrigger>
                            <TabsTrigger value="violin" className="text-xs h-8">Violin Plot</TabsTrigger>
                        </TabsList>
                        <TabsContent value="histogram" className="h-[250px] p-0 pr-4 pb-2 mt-0"> {/* Increased height */}
                            {canShowDistributionPlots && histogramData && histogramData.length > 0 ? (
                                 <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={histogramData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis dataKey="range" angle={-25} textAnchor="end" height={40} tick={{ fontSize: 9 }} interval={0} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                                        <Tooltip
                                            formatter={(value: number) => [`${value} points`, 'Count']}
                                            labelFormatter={(label: string) => `Range: ${label} ${metricConfig.unit || ''}`}
                                            cursor={{fill: 'hsl(var(--accent) / 0.3)'}}
                                        />
                                        <Bar dataKey="count" fill={metricConfig.color || 'hsl(var(--primary))'} radius={[2, 2, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                    {metricConfig.isString ? "Histogram not applicable for textual data." : "Not enough data or variation for histogram."}
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="violin" className="h-[250px] p-0 pr-1 pb-2 mt-0"> {/* Increased height */}
                            {canShowDistributionPlots && enhancedJitterDataForViolin.points.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis type="number" dataKey="xJitter" domain={[-0.5, 0.5]} hide />
                                        <YAxis 
                                            type="number" 
                                            dataKey="yValue" 
                                            domain={violinYAxisDomain} 
                                            allowDecimals 
                                            tick={{ fontSize: 10 }} 
                                            width={50}
                                            tickFormatter={(value) => Number(value).toFixed(metricConfig?.unit === 'ppm' ? 0 : 1)}
                                            label={{ value: metricConfig.unit, angle: -90, position: 'insideLeft', offset: -5, style: {fontSize: '10px', fill: 'hsl(var(--muted-foreground))'} }}
                                        />
                                        <Tooltip cursor={{ fill: 'hsl(var(--accent) / 0.3)' }} content={<CustomViolinTooltip />} />
                                        {enhancedJitterDataForViolin.quartiles && (
                                          <>
                                            <ReferenceLine y={enhancedJitterDataForViolin.quartiles.q1} stroke="hsl(var(--accent))" strokeDasharray="3 3" strokeOpacity={0.7}>
                                                <YAxis.Label value="Q1" offset={5} position="right" style={{fontSize: '9px', fill: 'hsl(var(--accent))'}} />
                                            </ReferenceLine>
                                            <ReferenceLine y={enhancedJitterDataForViolin.quartiles.median} stroke="hsl(var(--primary))" strokeDasharray="2 2" strokeOpacity={0.9}>
                                                 <YAxis.Label value="Median" offset={5} position="right" style={{fontSize: '9px', fill: 'hsl(var(--primary))'}}/>
                                            </ReferenceLine>
                                            <ReferenceLine y={enhancedJitterDataForViolin.quartiles.q3} stroke="hsl(var(--accent))" strokeDasharray="3 3" strokeOpacity={0.7}>
                                                <YAxis.Label value="Q3" offset={5} position="right" style={{fontSize: '9px', fill: 'hsl(var(--accent))'}}/>
                                            </ReferenceLine>
                                          </>
                                        )}
                                        <Scatter 
                                            name={metricConfig.name} 
                                            data={enhancedJitterDataForViolin.points} 
                                            fill={metricConfig.color || 'hsl(var(--primary))'} 
                                            shape="circle"
                                            legendType="none" 
                                            size={6} // Fixed small size for jitter points
                                        />
                                    </ScatterChart>
                                </ResponsiveContainer>
                            ) : (
                                 <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                    {metricConfig.isString ? "Violin plot not applicable for textual data." : "Not enough data for violin plot."}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
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
    
