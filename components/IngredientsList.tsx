'use client';

interface IngredientsListProps {
  ingredients: string | null;
}

export default function IngredientsList({ ingredients }: IngredientsListProps) {
  if (!ingredients) {
    return null;
  }

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg border border-gray-200 shadow-sm">
      <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3">Ingredients</h3>
      <p className="text-sm md:text-base text-gray-700 leading-relaxed break-words whitespace-pre-wrap">
        {ingredients}
      </p>
    </div>
  );
}
