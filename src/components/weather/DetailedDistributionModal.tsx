
"use client";

import type { FC } from 'react';
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
import type { WeatherDataPoint, MetricConfig } from '@/types/weather';
import { formatTimestampToFullUTC } from '@/lib/utils';

export interface DetailModalData {
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

const DetailedDistributionModal: FC<DetailedDistributionModalProps> = ({ isOpen, onClose, data }) => {
  if (!isOpen || !data) {
    return null;
  }

  const { metricConfig, aggregationLabel, stats, rawPoints } = data;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl">
            Detailed View: {metricConfig.name}
          </DialogTitle>
          <DialogDescription>
            Raw data points and statistics for the aggregation period: {aggregationLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4 text-sm flex-shrink-0">
          {stats.avg !== undefined && (
            <div className="bg-muted/50 p-3 rounded-md">
              <p className="font-medium text-foreground">Average</p>
              <p className="text-lg font-semibold text-primary">
                {stats.avg.toFixed(2)} {metricConfig.unit}
              </p>
            </div>
          )}
          {stats.min !== undefined && (
            <div className="bg-muted/50 p-3 rounded-md">
              <p className="font-medium text-foreground">Minimum</p>
              <p className="text-lg font-semibold text-primary">
                {stats.min.toFixed(2)} {metricConfig.unit}
              </p>
            </div>
          )}
          {stats.max !== undefined && (
            <div className="bg-muted/50 p-3 rounded-md">
              <p className="font-medium text-foreground">Maximum</p>
              <p className="text-lg font-semibold text-primary">
                {stats.max.toFixed(2)} {metricConfig.unit}
              </p>
            </div>
          )}
          {stats.stdDev !== undefined && (
            <div className="bg-muted/50 p-3 rounded-md">
              <p className="font-medium text-foreground">Std. Deviation</p>
              <p className="text-lg font-semibold text-primary">
                {stats.stdDev.toFixed(2)} {metricConfig.unit}
              </p>
            </div>
          )}
          {stats.count !== undefined && (
            <div className="bg-muted/50 p-3 rounded-md">
              <p className="font-medium text-foreground">Data Points</p>
              <p className="text-lg font-semibold text-primary">{stats.count}</p>
            </div>
          )}
        </div>

        <div className="flex-grow overflow-hidden">
          <h4 className="text-md font-semibold mb-2 text-muted-foreground">Contributing Raw Data Points ({rawPoints.length} points):</h4>
          <ScrollArea className="h-[300px] border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Timestamp (UTC)</TableHead>
                  <TableHead className="text-right">Value ({metricConfig.unit})</TableHead>
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
                        {(point[metricConfig.name.toLowerCase().replace(/\s+/g, '') as keyof WeatherDataPoint] as number)?.toFixed(2) ?? 
                         (point[metricConfig.name.split(' ')[0].toLowerCase() as keyof WeatherDataPoint] as number)?.toFixed(2) ??
                         (point['aqiPpm' as keyof WeatherDataPoint] as number)?.toFixed(0) ?? 'N/A'}
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
