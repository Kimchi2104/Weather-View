
import Header from '@/components/Header';
import WeatherDashboard from '@/components/weather/WeatherDashboard';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="mb-4 p-4 border border-dashed border-primary rounded-md bg-secondary/30">
          <h2 className="text-lg font-semibold text-primary mb-2">Troubleshooting Link:</h2>
          <Link href="/test-chart" className="text-accent hover:underline">
            Go to Minimal Recharts Test Page
          </Link>
          <p className="text-xs text-muted-foreground mt-1">Use this to check if basic Recharts functionality is working.</p>
        </div>
        <WeatherDashboard />
      </main>
      <footer className="bg-muted text-muted-foreground py-4 text-center text-sm">
        <div className="container mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} WeatherView. All rights reserved.</p>
          <p className="text-xs mt-1">Data visualization for your weather station.</p>
        </div>
      </footer>
    </div>
  );
}
