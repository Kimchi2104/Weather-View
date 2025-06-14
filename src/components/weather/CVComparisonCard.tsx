import type { FC } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Percent, Info } from 'lucide-react';

interface CVComparisonCardProps {
  cvData: {
    metricName: string;
    cv: number | null;
  }[];
}

const CVComparisonCard: FC<CVComparisonCardProps> = ({ cvData }) => {
  if (cvData.length < 2) {
    return null; // Don't render the card if there are fewer than 2 metrics with CV data
  }

  return (
    <Card className="shadow-lg mt-6">
      <CardHeader>
        <div className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-accent" />
            <CardTitle className="font-headline">Coefficient of Variation (CV) Comparison</CardTitle>
        </div>
        <CardDescription className="flex items-start gap-2 pt-1 text-xs">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
                The CV measures relative variability, allowing comparison between metrics with different units. A higher CV indicates greater variability, while a lower CV suggests more consistency.
            </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {cvData.map(({ metricName, cv }) => (
            <li key={metricName} className="flex justify-between items-center bg-muted/50 p-2 rounded-md">
              <span className="font-medium text-foreground">{metricName}</span>
              <span className="font-mono text-primary font-semibold">
                {cv !== null ? `${cv.toFixed(1)}%` : 'N/A'}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default CVComparisonCard;