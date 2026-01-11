'use client';

import { useState } from 'react';
import BarcodeCapture from './BarcodeCapture';

export interface Item {
  id: string;
  barcode: string;
  servings: number;
}

interface MultiItemManagerProps {
  items: Item[];
  onItemsChange: (items: Item[]) => void;
  maxItems?: number;
}

export default function MultiItemManager({ items, onItemsChange, maxItems = 5 }: MultiItemManagerProps) {
  const handleAddItem = (barcode: string) => {
    if (items.length >= maxItems) {
      return; // Already at max
    }

    // Check if barcode already exists
    if (items.some(item => item.barcode === barcode)) {
      return; // Already added
    }

    const newItem: Item = {
      id: `${Date.now()}-${Math.random()}`,
      barcode,
      servings: 1,
    };

    onItemsChange([...items, newItem]);
  };

  return (
    <div className="w-full space-y-4">
      {/* Barcode input for adding items */}
      {items.length < maxItems && (
        <div>
          <BarcodeCapture
            onBarcodeSubmit={handleAddItem}
            disabled={false}
          />
          {items.length > 0 && (
            <p className="text-xs text-forest-500 mt-2 text-center">
              Add up to {maxItems - items.length} more item{maxItems - items.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Show message when max items reached */}
      {items.length >= maxItems && items.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800 text-center">
            Maximum {maxItems} items reached. Remove an item to add another.
          </p>
        </div>
      )}

    </div>
  );
}
