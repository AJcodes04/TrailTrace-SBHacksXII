'use client';

import { formatProvider, formatDateTime } from '@/lib/format';

interface SourceInfo {
  provider: 'openfoodfacts' | 'usda_fdc' | 'none';
  providerProductUrl: string | null;
  retrievedAtIso: string;
}

interface SourceAndWarningsProps {
  source: SourceInfo;
  warnings: string[];
  normalizedBarcode?: string;
  items?: Array<{
    barcode: string;
    name: string | null;
    source: SourceInfo;
  }>;
}

export default function SourceAndWarnings({ source, warnings, normalizedBarcode, items }: SourceAndWarningsProps) {
  const isMultiItem = items && items.length > 0;

  return (
    <div className="w-full space-y-3 md:space-y-4">
      <div className="bg-gray-50 p-3 md:p-4 rounded-lg border border-gray-200">
        <h3 className="text-xs md:text-sm font-semibold text-gray-700 mb-2">Data Source</h3>
        {isMultiItem ? (
          <div className="space-y-3">
            {items!.map((item, index) => (
              <div key={item.barcode} className={`${index < items!.length - 1 ? 'pb-3 border-b border-gray-300' : ''}`}>
                <p className="text-xs md:text-sm font-medium text-gray-900 mb-2">
                  {item.name || `Item ${index + 1}`}
                </p>
                <div className="space-y-1 text-xs md:text-sm text-gray-600 pl-2">
                  <p>
                    <span className="font-medium">Barcode:</span> {item.barcode}
                  </p>
                  <p>
                    <span className="font-medium">Provider:</span> {formatProvider(item.source.provider)}
                  </p>
                  <p>
                    <span className="font-medium">Retrieved:</span> {formatDateTime(item.source.retrievedAtIso)}
                  </p>
                  {item.source.providerProductUrl && (
                    <p>
                      <a
                        href={item.source.providerProductUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline break-all"
                      >
                        View on {formatProvider(item.source.provider)} →
                      </a>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1 text-xs md:text-sm text-gray-600">
            <p>
              <span className="font-medium">Provider:</span> {formatProvider(source.provider)}
            </p>
            <p>
              <span className="font-medium">Retrieved:</span> {formatDateTime(source.retrievedAtIso)}
            </p>
            {normalizedBarcode && (
              <p>
                <span className="font-medium">Normalized Barcode:</span> {normalizedBarcode}
              </p>
            )}
            {source.providerProductUrl && (
              <p>
                <a
                  href={source.providerProductUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  View on {formatProvider(source.provider)} →
                </a>
              </p>
            )}
          </div>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="bg-yellow-50 p-3 md:p-4 rounded-lg border border-yellow-200">
          <h3 className="text-xs md:text-sm font-semibold text-yellow-800 mb-2">Warnings</h3>
          <ul className="list-disc list-inside space-y-1 text-xs md:text-sm text-yellow-700">
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
