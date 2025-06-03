import Header from '@/components/Header';
import WeatherDashboard from '@/components/weather/WeatherDashboard';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
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
