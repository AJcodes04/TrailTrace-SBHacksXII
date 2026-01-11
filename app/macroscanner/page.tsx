import NutritionDashboard from "@/components/NutritionDashboard";


export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 py-4 px-4 pb-safe">
      <div className="max-w-7xl mx-auto">
        <NutritionDashboard />
      </div>
    </main>
  );
}
