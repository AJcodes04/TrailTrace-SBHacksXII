'use client';

import { useState, FormEvent, useRef } from 'react';

interface BarcodeCaptureProps {
  onBarcodeSubmit: (barcode: string) => void;
  disabled?: boolean;
}

interface DebugLogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  data?: any;
}

export default function BarcodeCapture({ onBarcodeSubmit, disabled = false }: BarcodeCaptureProps) {
  const [inputValue, setInputValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [decodeState, setDecodeState] = useState<'idle' | 'decoding' | 'success' | 'error'>('idle');
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper to add debug log entries
  const addDebugLog = (level: DebugLogEntry['level'], message: string, data?: any) => {
    const entry: DebugLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };
    setDebugLogs((prev) => [...prev, entry]);
    // Also log to console for immediate debugging
    const consoleMethod = level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log';
    console[consoleMethod](`[${entry.timestamp}] ${message}`, data || '');
  };

  // Generate formatted debug output for copying
  const getDebugOutput = (): string => {
    const lines: string[] = [];
    lines.push('=== Barcode Scan Debug Information ===');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');
    
    // Add browser/device information
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      lines.push('--- Browser/Device Information ---');
      lines.push(`User Agent: ${navigator.userAgent}`);
      lines.push(`Platform: ${navigator.platform}`);
      lines.push(`Screen: ${window.screen.width}x${window.screen.height} (${window.devicePixelRatio}x DPI)`);
      lines.push(`Viewport: ${window.innerWidth}x${window.innerHeight}`);
      lines.push(`Has BarcodeDetector: ${'BarcodeDetector' in window}`);
      lines.push(`Has createImageBitmap: ${typeof createImageBitmap !== 'undefined'}`);
      lines.push(`Canvas supported: ${typeof HTMLCanvasElement !== 'undefined'}`);
      lines.push(`WebAssembly supported: ${typeof WebAssembly !== 'undefined'}`);
      lines.push('');
    }
    
    lines.push('--- Scan Logs ---');
    if (debugLogs.length === 0) {
      lines.push('No debug logs yet. Scan a barcode to see debug information.');
      lines.push('');
    } else {
      debugLogs.forEach((log) => {
        lines.push(`[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`);
        if (log.data) {
          if (typeof log.data === 'object') {
            lines.push(`  Data: ${JSON.stringify(log.data, null, 2).split('\n').join('\n  ')}`);
          } else {
            lines.push(`  Data: ${log.data}`);
          }
        }
        lines.push('');
      });
    }

    return lines.join('\n');
  };

  const validateBarcode = (barcode: string): string | null => {
    const cleaned = barcode.trim().replace(/\D/g, '');
    
    if (!cleaned) {
      return 'Barcode cannot be empty';
    }

    const length = cleaned.length;
    if (![8, 12, 13, 14].includes(length)) {
      return `Barcode must be 8, 12, 13, or 14 digits. Got ${length} digits.`;
    }

    return null;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleaned = inputValue.trim().replace(/\D/g, '');
    const error = validateBarcode(cleaned);

    if (error) {
      setValidationError(error);
      return;
    }

    onBarcodeSubmit(cleaned);
  };


  /**
   * Applies transformation to canvas (rotation and/or flip)
   * Used to try different orientations for barcode detection
   * Properly handles all 8 possible orientations
   */
  const transformCanvas = (
    canvas: HTMLCanvasElement,
    rotation: number,
    flipHorizontal: boolean = false,
    flipVertical: boolean = false
  ): HTMLCanvasElement => {
    if (rotation === 0 && !flipHorizontal && !flipVertical) {
      return canvas; // No transformation needed
    }

    const outputCanvas = document.createElement('canvas');
    const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true });
    if (!outputCtx) return canvas;

    const radians = (rotation * Math.PI) / 180;
    const sourceWidth = canvas.width;
    const sourceHeight = canvas.height;
    
    // Determine output dimensions (90° and 270° swap width/height)
    if (rotation === 90 || rotation === 270) {
      outputCanvas.width = sourceHeight;
      outputCanvas.height = sourceWidth;
    } else {
      outputCanvas.width = sourceWidth;
      outputCanvas.height = sourceHeight;
    }

    // Preserve image quality during transformation (important for barcode clarity)
    outputCtx.imageSmoothingEnabled = true;
    outputCtx.imageSmoothingQuality = 'high';
    
    outputCtx.save();
    
    // Move origin to center of output canvas
    outputCtx.translate(outputCanvas.width / 2, outputCanvas.height / 2);
    
    // Apply rotation (around center)
    if (rotation !== 0) {
      outputCtx.rotate(radians);
    }
    
    // Apply flips (after rotation)
    const scaleX = flipHorizontal ? -1 : 1;
    const scaleY = flipVertical ? -1 : 1;
    outputCtx.scale(scaleX, scaleY);
    
    // Draw source canvas centered (relative to its own center)
    outputCtx.drawImage(canvas, -sourceWidth / 2, -sourceHeight / 2);
    
    outputCtx.restore();

    return outputCanvas;
  };

  /**
   * Generates all possible orientations to try for barcode detection
   * Prioritizes common orientations first (no flips, then flips)
   * Barcodes can be horizontal, vertical, upside-down, or mirrored in any direction
   */
  const getAllOrientations = (): Array<{ rotation: number; flipH: boolean; flipV: boolean; label: string }> => {
    // Return orientations in order of likelihood
    // Start with simple rotations (most common), then add flips
    return [
      // Most common: simple rotations (no flips)
      { rotation: 0, flipH: false, flipV: false, label: 'original (0°)' },
      { rotation: 90, flipH: false, flipV: false, label: '90° CW' },
      { rotation: 180, flipH: false, flipV: false, label: '180°' },
      { rotation: 270, flipH: false, flipV: false, label: '270° CW (90° CCW)' },
      
      // Horizontal flips of each rotation
      { rotation: 0, flipH: true, flipV: false, label: '0° + H flip' },
      { rotation: 90, flipH: true, flipV: false, label: '90° + H flip' },
      { rotation: 180, flipH: true, flipV: false, label: '180° + H flip' },
      { rotation: 270, flipH: true, flipV: false, label: '270° + H flip' },
      
      // Vertical flips of each rotation
      { rotation: 0, flipH: false, flipV: true, label: '0° + V flip' },
      { rotation: 90, flipH: false, flipV: true, label: '90° + V flip' },
      { rotation: 180, flipH: false, flipV: true, label: '180° + V flip' },
      { rotation: 270, flipH: false, flipV: true, label: '270° + V flip' },
      
      // Both flips (less common but possible)
      { rotation: 0, flipH: true, flipV: true, label: '0° + H+V flip' },
      { rotation: 90, flipH: true, flipV: true, label: '90° + H+V flip' },
      { rotation: 180, flipH: true, flipV: true, label: '180° + H+V flip' },
      { rotation: 270, flipH: true, flipV: true, label: '270° + H+V flip' },
    ];
  };

  /**
   * Preprocesses image: creates canvas, handles resizing
   * We'll try multiple orientations during detection if needed
   */
  const preprocessImage = async (file: File): Promise<HTMLCanvasElement> => {
    const preprocessStart = performance.now();
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        try {
          addDebugLog('info', 'Image loaded successfully', {
            displaySize: `${img.width}x${img.height}`,
            naturalSize: `${img.naturalWidth}x${img.naturalHeight}`,
            aspectRatio: (img.naturalWidth / img.naturalHeight).toFixed(2),
          });
          
          // Create canvas - use displayed dimensions (browser applies EXIF orientation automatically)
          // When browser displays img, it shows it with orientation applied, so width/height reflect that
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          
          if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            addDebugLog('error', 'Failed to create canvas context');
            reject(new Error('Failed to create canvas context'));
            return;
          }

          // Use natural dimensions (raw pixel data from file)
          // Note: canvas.drawImage() draws the raw pixels, not the browser-oriented display
          // So we'll try all orientations during detection
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;

          addDebugLog('info', 'Canvas created', {
            canvasSize: `${canvas.width}x${canvas.height}`,
            pixelCount: (canvas.width * canvas.height).toLocaleString(),
          });

          // Draw the raw image pixels to canvas
          // High-quality rendering to preserve barcode clarity
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Cleanup object URL
          URL.revokeObjectURL(objectUrl);

          // Start with original orientation
          let orientedCanvas = canvas;

          // Resize if image is very large (helps with performance)
          // But maintain good resolution for barcode detection - barcodes need detail
          // Increased from 2000 to 3000 to preserve more detail for iPhone photos
          const MAX_DIMENSION = 3000;
          const MIN_DIMENSION = 1000; // Don't resize if already smaller than this
          
          if ((orientedCanvas.width > MAX_DIMENSION || orientedCanvas.height > MAX_DIMENSION) &&
              (orientedCanvas.width > MIN_DIMENSION || orientedCanvas.height > MIN_DIMENSION)) {
            const originalWidth = orientedCanvas.width;
            const originalHeight = orientedCanvas.height;
            const ratio = Math.min(MAX_DIMENSION / orientedCanvas.width, MAX_DIMENSION / orientedCanvas.height);
            const resizedCanvas = document.createElement('canvas');
            const resizedCtx = resizedCanvas.getContext('2d', { willReadFrequently: true });
            
            if (resizedCtx) {
              resizedCanvas.width = Math.round(orientedCanvas.width * ratio);
              resizedCanvas.height = Math.round(orientedCanvas.height * ratio);
              
              addDebugLog('info', 'Image resized for performance', {
                originalSize: `${originalWidth}x${originalHeight}`,
                resizedTo: `${resizedCanvas.width}x${resizedCanvas.height}`,
                ratio: ratio.toFixed(3),
                reason: 'Image exceeds max dimension, preserving detail for barcode detection',
              });
              
              // High-quality scaling with best algorithm
              resizedCtx.imageSmoothingEnabled = true;
              resizedCtx.imageSmoothingQuality = 'high';
              resizedCtx.drawImage(orientedCanvas, 0, 0, resizedCanvas.width, resizedCanvas.height);
              orientedCanvas = resizedCanvas;
            }
          } else {
            addDebugLog('info', 'Image size is within limits, no resizing needed', {
              width: orientedCanvas.width,
              height: orientedCanvas.height,
              reason: orientedCanvas.width <= MAX_DIMENSION && orientedCanvas.height <= MAX_DIMENSION
                ? 'Within max dimension'
                : 'Below min dimension threshold',
            });
          }

          const preprocessTime = performance.now() - preprocessStart;
          addDebugLog('info', 'Image preprocessing complete', {
            finalCanvasSize: `${orientedCanvas.width}x${orientedCanvas.height}`,
            totalDuration: `${preprocessTime.toFixed(2)}ms`,
          });

          resolve(orientedCanvas);
        } catch (error: any) {
          URL.revokeObjectURL(objectUrl);
          addDebugLog('error', 'Image preprocessing error', {
            errorName: error.name,
            errorMessage: error.message,
          });
          reject(error);
        }
      };

      img.onerror = (error) => {
        URL.revokeObjectURL(objectUrl);
        addDebugLog('error', 'Failed to load image file', {
          error: String(error),
        });
        reject(new Error('Failed to load image file'));
      };

      img.src = objectUrl;
    });
  };

  /**
   * Attempts barcode detection on a canvas using ZXing
   * Converts canvas to Image element which ZXing can reliably decode
   * Tries multiple strategies for better detection
   */
  const detectBarcodeFromCanvas = async (
    canvas: HTMLCanvasElement,
    reader: any,
    orientationLabel?: string
  ): Promise<string | null> => {
    const startTime = performance.now();
    
    // Try multiple detection strategies
    const strategies = [
      { quality: 1.0, hint: 'max quality' },
      { quality: 0.95, hint: 'high quality' },
      { quality: 0.9, hint: 'standard quality' },
    ];
    
    for (const strategy of strategies) {
      try {
        // Convert canvas to Image element (ZXing's most reliable method)
        const img = new Image();
        
        // Use different JPEG qualities to see if compression affects detection
        const encodeStart = performance.now();
        const dataUrl = canvas.toDataURL('image/jpeg', strategy.quality);
        const encodeTime = performance.now() - encodeStart;
        
        if (orientationLabel && strategy.quality === 1.0) {
          addDebugLog('info', `Attempting ZXing detection: ${orientationLabel}`, {
            canvasSize: `${canvas.width}x${canvas.height}`,
            dataUrlSize: `${(dataUrl.length / 1024).toFixed(2)} KB`,
            encodeTime: `${encodeTime.toFixed(2)}ms`,
            strategy: strategy.hint,
          });
        }
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image from canvas'));
          img.src = dataUrl;
        });
        
        // Try standard ZXing decode
        const decodeStart = performance.now();
        const result = await reader.decodeFromImageElement(img);
        
        const decodeTime = performance.now() - decodeStart;
        const totalTime = performance.now() - startTime;
        
        if (result && result.getText()) {
          const rawText = result.getText();
          const digits = rawText.replace(/\D/g, '');
          
          if (orientationLabel && strategy.quality === 1.0) {
            addDebugLog('info', `ZXing detected text: ${rawText}`, {
              extractedDigits: digits,
              digitLength: digits.length,
              isValidLength: [8, 12, 13, 14].includes(digits.length),
              decodeTime: `${decodeTime.toFixed(2)}ms`,
              totalTime: `${totalTime.toFixed(2)}ms`,
              strategy: strategy.hint,
            });
          }
          
          if ([8, 12, 13, 14].includes(digits.length)) {
            if (orientationLabel) {
              addDebugLog('success', `ZXing barcode detected in ${orientationLabel}: ${digits} (strategy: ${strategy.hint})`);
            }
            return digits;
          } else {
            if (orientationLabel && strategy.quality === 1.0) {
              addDebugLog('warning', `ZXing detected invalid length (${digits.length}): ${digits}`);
            }
          }
        } else {
          if (orientationLabel && strategy.quality === 1.0) {
            addDebugLog('info', `ZXing no result in ${orientationLabel}`, {
              decodeTime: `${decodeTime.toFixed(2)}ms`,
              totalTime: `${totalTime.toFixed(2)}ms`,
              strategy: strategy.hint,
            });
          }
        }
      } catch (error: any) {
        const totalTime = performance.now() - startTime;
        // Check if it's a NotFoundException (expected when no barcode)
        if (error.name === 'NotFoundException' || error.message?.includes('No MultiFormat Readers')) {
          // Only log for first strategy to avoid spam
          if (orientationLabel && strategy.quality === 1.0) {
            addDebugLog('info', `ZXing NotFoundException in ${orientationLabel} (expected)`, {
              duration: `${totalTime.toFixed(2)}ms`,
              strategy: strategy.hint,
            });
          }
          // Continue to next strategy
          continue;
        }
        // Log other errors for debugging
        if (orientationLabel && strategy.quality === 1.0) {
          addDebugLog('warning', `ZXing decode error in ${orientationLabel}`, {
            errorName: error.name,
            errorMessage: error.message,
            duration: `${totalTime.toFixed(2)}ms`,
            strategy: strategy.hint,
          });
        }
      }
    }

    return null;
  };

  /**
   * Decodes barcode from uploaded image using ZXing library
   * Handles iPhone photos with proper orientation and preprocessing
   */
  const decodeBarcodeFromImage = async (file: File, signal?: AbortSignal): Promise<string | null> => {
    const overallStartTime = performance.now();
    addDebugLog('info', '=== Starting barcode detection ===', {
      fileName: file.name,
      fileType: file.type,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
    });

    // Ensure we're in the browser
    if (typeof window === 'undefined') {
      addDebugLog('error', 'Barcode detection attempted outside browser');
      throw new Error('Barcode detection is only available in the browser');
    }

    // Dynamically import ZXing library (client-side only) with retry logic
    // Network issues on mobile can cause chunk loading failures
    const importStart = performance.now();
    let ZXingModule: any;
    let importAttempts = 0;
    const maxImportAttempts = 3;
    
    while (importAttempts < maxImportAttempts) {
      importAttempts++;
      try {
        addDebugLog('info', `Attempting to load ZXing library (attempt ${importAttempts}/${maxImportAttempts})`);
        
        // Add timeout to prevent hanging on slow networks
        const importPromise = import('@zxing/library');
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('ZXing library import timed out after 30 seconds')), 30000);
        });
        
        ZXingModule = await Promise.race([importPromise, timeoutPromise]);
        
        const importTime = performance.now() - importStart;
        addDebugLog('success', `ZXing library loaded successfully in ${importTime.toFixed(2)}ms (attempt ${importAttempts})`);
        break; // Success, exit retry loop
      } catch (importError: any) {
        const importTime = performance.now() - importStart;
        
        if (importAttempts >= maxImportAttempts) {
          // Final attempt failed
          const isChunkError = importError.name === 'ChunkLoadError' || 
                              importError.message?.includes('chunk') ||
                              importError.message?.includes('Loading chunk');
          
          addDebugLog('error', 'ZXing library failed to load after all attempts', {
            errorName: importError.name,
            errorMessage: importError.message,
            attempts: importAttempts,
            totalDuration: `${importTime.toFixed(2)}ms`,
            isChunkError,
            suggestion: isChunkError 
              ? 'This is likely a network/chunk loading issue. Try: 1) Refresh the page, 2) Check your internet connection, 3) Try again on a better network.'
              : 'This may be due to network issues. Please check your connection and try again.',
          });
          
          let errorMessage = `Failed to load barcode scanner library after ${maxImportAttempts} attempts. `;
          
          if (isChunkError) {
            errorMessage += `Network/loading error detected: ${importError.message}. ` +
              `This often happens on slow or unstable connections. ` +
              `Please try: 1) Refreshing the page, 2) Checking your internet connection, ` +
              `3) Trying again on a more stable network (WiFi recommended).`;
          } else {
            errorMessage += `Error: ${importError.message}. ` +
              `This may be due to network connectivity issues. Please check your connection and try again.`;
          }
          
          throw new Error(errorMessage);
        }
        
        // Check if it's a chunk loading error (common on slow networks)
        const isChunkError = importError.name === 'ChunkLoadError' || 
                            importError.message?.includes('chunk') ||
                            importError.message?.includes('Loading chunk');
        
        addDebugLog('warning', `ZXing library import failed (attempt ${importAttempts}/${maxImportAttempts}), retrying...`, {
          errorName: importError.name,
          errorMessage: importError.message,
          duration: `${importTime.toFixed(2)}ms`,
          isChunkError,
          suggestion: isChunkError ? 'This appears to be a network/chunk loading issue. Retrying with longer delay...' : 'Retrying...',
        });
        
        // Wait before retry (exponential backoff, longer for chunk errors)
        const baseDelay = isChunkError ? 2000 : 1000;
        const retryDelay = Math.min(baseDelay * Math.pow(2, importAttempts - 1), 10000);
        addDebugLog('info', `Waiting ${retryDelay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    if (!ZXingModule || !ZXingModule.BrowserMultiFormatReader) {
      throw new Error('ZXing library loaded but BrowserMultiFormatReader is not available. Module keys: ' + Object.keys(ZXingModule || {}).join(', '));
    }
    
    const { BrowserMultiFormatReader, NotFoundException } = ZXingModule;
    const reader = new BrowserMultiFormatReader();
    
    // Verify reader was created successfully
    if (!reader) {
      throw new Error('Failed to create BrowserMultiFormatReader instance');
    }
    
    addDebugLog('info', 'ZXing BrowserMultiFormatReader initialized successfully');

    let canvas: HTMLCanvasElement | null = null;

    try {
      // Preprocess image (handles orientation, resizing)
      const preprocessStart = performance.now();
      canvas = await preprocessImage(file);
      const preprocessTime = performance.now() - preprocessStart;
      addDebugLog('info', 'Image preprocessing complete', {
        canvasSize: `${canvas.width}x${canvas.height}`,
        duration: `${preprocessTime.toFixed(2)}ms`,
      });

      // Try native BarcodeDetector first if available (often handles orientation better)
      if ('BarcodeDetector' in window) {
        addDebugLog('info', 'Native BarcodeDetector is available, trying first');
        try {
          const BarcodeDetectorClass = (window as any).BarcodeDetector;
          const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
          const detector = new BarcodeDetectorClass({ formats });
          const orientations = getAllOrientations();
          addDebugLog('info', `Trying ${orientations.length} orientations with native BarcodeDetector`);

          const nativeStartTime = performance.now();
          let nativeAttempts = 0;
          
          // Try native detector with all orientations
          for (const { rotation, flipH, flipV, label } of orientations) {
            if (signal?.aborted) {
              addDebugLog('info', 'Barcode detection cancelled by user');
              throw new Error('Cancelled');
            }
            nativeAttempts++;
            const attemptStart = performance.now();
            try {
              const transformedCanvas = transformCanvas(canvas, rotation, flipH, flipV);
              const bitmap = await createImageBitmap(transformedCanvas);
              
              try {
                const detectedCodes = await detector.detect(bitmap);
                bitmap.close();
                const attemptTime = performance.now() - attemptStart;

                if (detectedCodes && detectedCodes.length > 0) {
                  addDebugLog('info', `Native BarcodeDetector found ${detectedCodes.length} codes in ${label}`, {
                    attempt: `${nativeAttempts}/${orientations.length}`,
                    duration: `${attemptTime.toFixed(2)}ms`,
                  });
                  
                  // Extract digits and find best candidate
                  const candidates = detectedCodes.map((code: { rawValue: string; format: any; }) => {
                    const digits = code.rawValue.replace(/\D/g, '');
                    return { digits, length: digits.length, format: code.format };
                  });
                  
                  addDebugLog('info', 'Native BarcodeDetector candidates', { candidates });
                  
                  const upcEanCandidate = candidates.find((c: string | any[]) => [8, 12, 13, 14].includes(c.length));
                  const selected = upcEanCandidate || candidates[0];
                  if (selected && selected.digits) {
                    const totalNativeTime = performance.now() - nativeStartTime;
                    addDebugLog('success', `Native BarcodeDetector SUCCESS in ${label}: ${selected.digits}`, {
                      selectedCandidate: selected,
                      totalAttempts: nativeAttempts,
                      totalTime: `${totalNativeTime.toFixed(2)}ms`,
                    });
                    return selected.digits;
                  } else {
                    addDebugLog('warning', `Native BarcodeDetector found codes but none had valid length`, {
                      candidates,
                    });
                  }
                } else {
                  addDebugLog('info', `Native BarcodeDetector no codes in ${label}`, {
                    attempt: `${nativeAttempts}/${orientations.length}`,
                    duration: `${attemptTime.toFixed(2)}ms`,
                  });
                }
              } catch (detectError: any) {
                bitmap.close();
                const attemptTime = performance.now() - attemptStart;
                addDebugLog('warning', `Native BarcodeDetector detect error in ${label}`, {
                  errorMessage: detectError.message,
                  duration: `${attemptTime.toFixed(2)}ms`,
                });
              }
            } catch (transformError: any) {
              const attemptTime = performance.now() - attemptStart;
              addDebugLog('warning', `Native BarcodeDetector transform error in ${label}`, {
                errorMessage: transformError.message,
                duration: `${attemptTime.toFixed(2)}ms`,
              });
            }
          }
          
          const totalNativeTime = performance.now() - nativeStartTime;
          addDebugLog('info', `Native BarcodeDetector completed all ${nativeAttempts} attempts`, {
            totalTime: `${totalNativeTime.toFixed(2)}ms`,
            noSuccess: true,
          });
        } catch (nativeError: any) {
          addDebugLog('error', 'Native BarcodeDetector initialization failed', {
            errorName: nativeError.name,
            errorMessage: nativeError.message,
          });
        }
      } else {
        addDebugLog('info', 'Native BarcodeDetector not available, using ZXing only');
      }

      // Try ZXing with all possible orientations
      addDebugLog('info', 'Starting ZXing detection with all orientations');
      const orientations = getAllOrientations();
      addDebugLog('info', `Trying ${orientations.length} orientations with ZXing`);
      
      const zxingStartTime = performance.now();
      let zxingAttempts = 0;
      
      for (const { rotation, flipH, flipV, label } of orientations) {
        if (signal?.aborted) {
          addDebugLog('info', 'Barcode detection cancelled by user');
          throw new Error('Cancelled');
        }
        zxingAttempts++;
        try {
          const transformedCanvas = transformCanvas(canvas, rotation, flipH, flipV);
          const result = await detectBarcodeFromCanvas(transformedCanvas, reader, label);
          if (result) {
            const totalZxingTime = performance.now() - zxingStartTime;
            addDebugLog('success', `ZXing SUCCESS in ${label}: ${result}`, {
              attempt: `${zxingAttempts}/${orientations.length}`,
              totalTime: `${totalZxingTime.toFixed(2)}ms`,
            });
            return result;
          }
        } catch (error: any) {
          addDebugLog('warning', `ZXing error in ${label}`, {
            errorMessage: error.message,
            attempt: `${zxingAttempts}/${orientations.length}`,
          });
        }
      }
      
      const totalZxingTime = performance.now() - zxingStartTime;
      addDebugLog('info', `ZXing completed all ${zxingAttempts} attempts`, {
        totalTime: `${totalZxingTime.toFixed(2)}ms`,
        noSuccess: true,
      });

      // If still no result, try with multiple image enhancement strategies
      addDebugLog('info', 'Starting image enhancement strategies');
      const enhanceStartTime = performance.now();
      
      // Try different enhancement strategies
      const enhancementStrategies: Array<{
        name: string;
        contrast: number;
        brightness: number;
        threshold?: boolean | number;
        adaptiveThreshold?: boolean;
      }> = [
        { name: 'high contrast', contrast: 2.0, brightness: 0 },
        { name: 'moderate contrast', contrast: 1.5, brightness: 0 },
        { name: 'threshold binary', contrast: 10.0, brightness: 0, threshold: true },
        { name: 'adaptive threshold', contrast: 5.0, brightness: 0, adaptiveThreshold: true },
      ];
      
      for (const strategy of enhancementStrategies) {
        if (signal?.aborted) {
          addDebugLog('info', 'Barcode detection cancelled by user');
          throw new Error('Cancelled');
        }
        try {
          const enhancedCanvas = document.createElement('canvas');
          enhancedCanvas.width = canvas.width;
          enhancedCanvas.height = canvas.height;
          const enhancedCtx = enhancedCanvas.getContext('2d', { willReadFrequently: true });
          
          if (!enhancedCtx) continue;
          
          enhancedCtx.drawImage(canvas, 0, 0);
          const imageData = enhancedCtx.getImageData(0, 0, enhancedCanvas.width, enhancedCanvas.height);
          const data = imageData.data;
          
          // Calculate histogram for adaptive thresholding
          let thresholdValue: number | boolean | undefined = strategy.threshold;
          if (strategy.adaptiveThreshold) {
            const histogram = new Array(256).fill(0);
            for (let i = 0; i < data.length; i += 4) {
              const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
              histogram[gray]++;
            }
            // Find median threshold
            let sum = 0;
            let threshold = 128;
            const total = data.length / 4;
            for (let i = 0; i < 256; i++) {
              sum += histogram[i];
              if (sum >= total / 2) {
                threshold = i;
                break;
              }
            }
            thresholdValue = threshold;
          }
          
          // Apply enhancement
          for (let i = 0; i < data.length; i += 4) {
            // Convert to grayscale using luminance formula
            let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            
            // Apply contrast enhancement
            const factor = (259 * (strategy.contrast + 1)) / (259 - strategy.contrast);
            gray = factor * (gray - 128) + 128 + strategy.brightness;
            
            // Apply threshold if needed
            if (thresholdValue === true) {
              gray = gray > 128 ? 255 : 0;
            } else if (typeof thresholdValue === 'number') {
              gray = gray > thresholdValue ? 255 : 0;
            }
            
            // Clamp values
            gray = Math.max(0, Math.min(255, gray));
            
            data[i] = gray;     // R
            data[i + 1] = gray; // G
            data[i + 2] = gray; // B
            // Alpha stays the same
          }
          enhancedCtx.putImageData(imageData, 0, 0);
          
          const enhanceProcessTime = performance.now() - enhanceStartTime;
          addDebugLog('info', `Image enhancement complete: ${strategy.name}`, {
            duration: `${enhanceProcessTime.toFixed(2)}ms`,
            contrast: strategy.contrast,
            threshold: thresholdValue || 'none',
          });
          
          // Try enhanced image in all orientations (but prioritize common ones first)
          const priorityOrientations = orientations.slice(0, 8); // Try first 8 orientations first
          addDebugLog('info', `Trying ${priorityOrientations.length} orientations with ${strategy.name} enhancement`);
          
          let enhancedAttempts = 0;
          const enhancedDetectStart = performance.now();
          
          for (const { rotation, flipH, flipV, label } of priorityOrientations) {
            if (signal?.aborted) {
              addDebugLog('info', 'Barcode detection cancelled by user');
              throw new Error('Cancelled');
            }
            enhancedAttempts++;
            try {
              const transformedEnhanced = transformCanvas(enhancedCanvas, rotation, flipH, flipV);
              const result = await detectBarcodeFromCanvas(transformedEnhanced, reader, `enhanced ${strategy.name} ${label}`);
              if (result) {
                const totalEnhancedTime = performance.now() - enhanceStartTime;
                addDebugLog('success', `Enhanced image (${strategy.name}) SUCCESS in ${label}: ${result}`, {
                  attempt: `${enhancedAttempts}/${priorityOrientations.length}`,
                  totalTime: `${totalEnhancedTime.toFixed(2)}ms`,
                });
                return result;
              }
            } catch (e: any) {
              // Silent continue for NotFoundException
              if (e.name !== 'NotFoundException') {
                addDebugLog('warning', `Enhanced image (${strategy.name}) error in ${label}`, {
                  errorMessage: e.message,
                });
              }
            }
          }
          
          // If no success with priority orientations, try remaining ones (but limit to avoid timeout)
          if (priorityOrientations.length < orientations.length) {
            const remainingOrientations = orientations.slice(8, 12); // Try 4 more
            for (const { rotation, flipH, flipV, label } of remainingOrientations) {
              if (signal?.aborted) {
                addDebugLog('info', 'Barcode detection cancelled by user');
                throw new Error('Cancelled');
              }
              enhancedAttempts++;
              try {
                const transformedEnhanced = transformCanvas(enhancedCanvas, rotation, flipH, flipV);
                const result = await detectBarcodeFromCanvas(transformedEnhanced, reader, `enhanced ${strategy.name} ${label}`);
                if (result) {
                  const totalEnhancedTime = performance.now() - enhanceStartTime;
                  addDebugLog('success', `Enhanced image (${strategy.name}) SUCCESS in ${label}: ${result}`, {
                    attempt: `${enhancedAttempts}/${orientations.length}`,
                    totalTime: `${totalEnhancedTime.toFixed(2)}ms`,
                  });
                  return result;
                }
              } catch (e: any) {
                // Silent continue
              }
            }
          }
          
          const enhancedDetectTime = performance.now() - enhancedDetectStart;
          addDebugLog('info', `Enhanced image (${strategy.name}) attempts completed`, {
            attempts: enhancedAttempts,
            duration: `${enhancedDetectTime.toFixed(2)}ms`,
            noSuccess: true,
          });
        } catch (enhanceError: any) {
          addDebugLog('warning', `Image enhancement (${strategy.name}) failed`, {
            errorName: enhanceError.name,
            errorMessage: enhanceError.message,
          });
        }
      }
      
      const totalEnhancedTime = performance.now() - enhanceStartTime;
      addDebugLog('info', 'All image enhancement strategies completed', {
        totalTime: `${totalEnhancedTime.toFixed(2)}ms`,
        strategiesTried: enhancementStrategies.length,
        noSuccess: true,
      });

      const overallTime = performance.now() - overallStartTime;
      addDebugLog('error', 'Barcode detection failed - no barcode found in any orientation', {
        totalDuration: `${overallTime.toFixed(2)}ms`,
        totalAttempts: `Native: ${'BarcodeDetector' in window ? orientations.length : 0}, ZXing: ${orientations.length}, Enhanced: ${orientations.length}`,
      });

      return null;
    } catch (error: any) {
      // Handle ZXing NotFoundException gracefully
      if (error instanceof NotFoundException || error.name === 'NotFoundException') {
        return null; // No barcode found
      }

      throw error;
    }
  };

  /**
   * Converts HEIC/HEIF files to JPEG for browser compatibility
   * iPhone photos are often in HEIC format which browsers can't read directly
   */
  const convertHeicToJpeg = async (file: File): Promise<File> => {
    const startTime = performance.now();
    
    // Check if file is HEIC/HEIF format (check multiple ways for robustness)
    // iPhone HEIC files may have various MIME types or extensions
    const fileName = file.name.toLowerCase();
    const fileType = (file.type || '').toLowerCase();
    
    // Check by MIME type (various possible values)
    const isHeicByType = fileType === 'image/heic' || 
                         fileType === 'image/heif' ||
                         fileType === 'image/heic-sequence' ||
                         fileType === 'image/heif-sequence' ||
                         fileType === 'image/avci' || // AVCI is HEIF-based
                         fileType === 'image/avcs'; // AVCS is HEIF-based sequence
    
    // Check by file extension
    const isHeicByExtension = fileName.endsWith('.heic') ||
                               fileName.endsWith('.heif') ||
                               fileName.endsWith('.hif') ||
                               fileName.endsWith('.avci') ||
                               fileName.endsWith('.avcs');
    
    // Also check if file type is empty or generic "image" and extension suggests HEIC
    const isHeicByHeuristic = (!fileType || fileType === 'image' || fileType === 'application/octet-stream') && 
                               isHeicByExtension;
    
    const isHeic = isHeicByType || isHeicByExtension || isHeicByHeuristic;
    
    addDebugLog('info', 'Checking file format', {
      fileName: file.name,
      fileType: file.type || 'unknown/empty',
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      isHeicByType,
      isHeicByExtension,
      isHeicByHeuristic,
      isHeic,
    });
    
    if (!isHeic) {
      addDebugLog('info', 'File is not HEIC format, using as-is');
      return file; // Not HEIC, return as-is
    }

    // Ensure we're in the browser
    if (typeof window === 'undefined') {
      addDebugLog('error', 'HEIC conversion attempted outside browser');
      throw new Error('HEIC conversion is only available in the browser');
    }

    try {
      addDebugLog('info', 'Starting HEIC to JPEG conversion');
      
      // First, try Safari native HEIC support (iOS/macOS Safari can display HEIC in img elements)
      // This works by loading the HEIC in an img element and drawing to canvas
      // Only try on Safari (not Chrome/Edge which identify as Safari)
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || 
                       /iPhone|iPad|iPod/.test(navigator.userAgent);
      
      if (isSafari) {
        addDebugLog('info', 'Detected Safari browser, trying Safari native HEIC support');
        try {
          const safariFallbackStart = performance.now();
          const img = new Image();
          const objectUrl = URL.createObjectURL(file);
          
          // Set a timeout for image loading
          const loadPromise = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Safari native HEIC loading timed out'));
            }, 10000); // 10 second timeout
            
            img.onload = () => {
              clearTimeout(timeout);
              resolve();
            };
            img.onerror = () => {
              clearTimeout(timeout);
              reject(new Error('Safari native HEIC loading failed - image could not be loaded'));
            };
            img.src = objectUrl;
          });
          
          await loadPromise;
          
          // Draw to canvas and convert to JPEG
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          
          if (canvas.width === 0 || canvas.height === 0) {
            URL.revokeObjectURL(objectUrl);
            throw new Error('Safari loaded HEIC but image dimensions are invalid');
          }
          
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(objectUrl);
            
            // Convert canvas to JPEG blob
            const jpegBlob = await new Promise<Blob>((resolve, reject) => {
              canvas.toBlob((blob) => {
                if (blob && blob.size > 0) {
                  resolve(blob);
                } else {
                  reject(new Error('Canvas toBlob failed or produced empty blob'));
                }
              }, 'image/jpeg', 0.92);
            });
            
            const safariTime = performance.now() - safariFallbackStart;
            addDebugLog('success', `Safari native HEIC conversion successful in ${safariTime.toFixed(2)}ms`, {
              originalSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
              convertedSize: `${(jpegBlob.size / 1024 / 1024).toFixed(2)} MB`,
              dimensions: `${canvas.width}x${canvas.height}`,
            });
            
            const jpegFile = new File([jpegBlob], file.name.replace(/\.(heic|heif|hif)$/i, '.jpg'), {
              type: 'image/jpeg',
              lastModified: file.lastModified,
            });
            
            return jpegFile;
          }
          
          URL.revokeObjectURL(objectUrl);
          throw new Error('Failed to get canvas context');
        } catch (safariError: any) {
          addDebugLog('warning', 'Safari native HEIC support failed, trying heic2any', {
            error: safariError.message,
            errorName: safariError.name,
          });
          // Fall through to heic2any
        }
      } else {
        addDebugLog('info', 'Not Safari browser, skipping Safari native HEIC support');
      }
      
      // Fallback to heic2any library
      addDebugLog('info', 'Using heic2any library for conversion');
      
      // Dynamically import heic2any (client-side only, avoids SSR issues)
      const importStart = performance.now();
      const heic2anyModule = await import('heic2any');
      const importTime = performance.now() - importStart;
      addDebugLog('info', `heic2any module loaded in ${importTime.toFixed(2)}ms`);
      
      // Handle different export formats
      const heic2any = heic2anyModule.default || heic2anyModule;
      
      if (typeof heic2any !== 'function') {
        throw new Error(`heic2any is not a function. Type: ${typeof heic2any}, Module: ${JSON.stringify(Object.keys(heic2anyModule))}`);
      }
      
      // Convert HEIC to JPEG blob with timeout
      const convertStart = performance.now();
      const conversionPromise = heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.92, // High quality conversion for barcode readability
      });

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('HEIC conversion timed out after 30 seconds')), 30000);
      });

      const convertedBlob = await Promise.race([conversionPromise, timeoutPromise]) as any;
      const convertTime = performance.now() - convertStart;
      
      addDebugLog('info', `heic2any conversion completed in ${convertTime.toFixed(2)}ms`);

      // heic2any can return a single blob or array of blobs
      const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      
      if (!blob) {
        throw new Error(`Conversion returned null/undefined. Type: ${typeof convertedBlob}, Is Array: ${Array.isArray(convertedBlob)}`);
      }
      
      if (!(blob instanceof Blob)) {
        throw new Error(`Conversion did not return a valid blob. Type: ${typeof blob}, Value: ${JSON.stringify(blob)}`);
      }
      
      addDebugLog('info', 'heic2any conversion successful', {
        originalSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        convertedSize: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
        blobType: blob.type,
      });
      
      // Create a new File object from the converted blob
      const jpegFile = new File([blob], file.name.replace(/\.(heic|heif|hif)$/i, '.jpg'), {
        type: 'image/jpeg',
        lastModified: file.lastModified,
      });
      
      const totalTime = performance.now() - startTime;
      addDebugLog('success', `HEIC conversion completed successfully in ${totalTime.toFixed(2)}ms`);
      
      return jpegFile;
    } catch (error: any) {
      const totalTime = performance.now() - startTime;
      addDebugLog('error', 'HEIC conversion failed', {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        duration: `${totalTime.toFixed(2)}ms`,
      });
      
      // Last resort: try loading as-is (some browsers might handle it)
      if (error.message.includes('ERR_LIBHEIF') || error.message.includes('format not supported')) {
        addDebugLog('info', 'Trying to use HEIC file directly (browser might support it)');
        try {
          // Try loading the HEIC file directly - Safari might be able to handle it
          const testImg = new Image();
          const testUrl = URL.createObjectURL(file);
          
          await new Promise<void>((resolve, reject) => {
            testImg.onload = () => {
              URL.revokeObjectURL(testUrl);
              resolve();
            };
            testImg.onerror = () => {
              URL.revokeObjectURL(testUrl);
              reject(new Error('Browser cannot load HEIC directly'));
            };
            testImg.src = testUrl;
          });
          
          // If we get here, the browser can handle it, so return the original file
          // The preprocessing step will handle it
          addDebugLog('success', 'Browser can handle HEIC directly, using original file');
          return file;
        } catch (directError: any) {
          addDebugLog('error', 'Direct HEIC loading also failed', {
            error: directError.message,
          });
        }
      }
      
      // Provide more detailed error message
      let errorMsg = 'Unable to process HEIC photo. ';
      
      if (error.message.includes('timeout')) {
        errorMsg += 'Conversion timed out. The image may be too large or corrupted. ';
      } else if (error.message.includes('not a function')) {
        errorMsg += 'HEIC conversion library error. Please refresh the page. ';
      } else if (error.message.includes('ERR_LIBHEIF') || error.message.includes('format not supported')) {
        errorMsg += 'This HEIC format variant is not supported. Please try: ';
      } else {
        errorMsg += `Error: ${error.message}. `;
      }
      
      errorMsg += '1) Enable JPEG format in iPhone Settings > Camera > Formats > Most Compatible, 2) Use a photo that was already converted to JPEG, or 3) Try taking the photo again.';
      
      throw new Error(errorMsg);
    }
  };

  /**
   * Handles file selection and triggers barcode decoding
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return; // User cancelled
    }

    // Cancel any in-flight decode operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this scan
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Reset debug logs for new scan
    setDebugLogs([]);
    setDecodeState('decoding');
    setDecodeError(null);
    setValidationError(null);
    addDebugLog('info', 'File selected, starting barcode detection', {
      fileName: file.name,
      fileType: file.type,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
    });

    try {
      // Convert HEIC to JPEG if needed (transparent to user)
      const processedFile = await convertHeicToJpeg(file);
      
      // Check if cancelled during conversion
      if (abortController.signal.aborted) {
        setDecodeState('idle');
        return;
      }
      
      // Check if file was converted
      if (processedFile.name !== file.name || processedFile.type !== file.type) {
        addDebugLog('info', 'File was converted', {
          original: `${file.name} (${file.type})`,
          converted: `${processedFile.name} (${processedFile.type})`,
        });
      }
      
      const digits = await decodeBarcodeFromImage(processedFile, abortController.signal);

      if (!digits) {
        setDecodeState('error');
        const errorMsg = 'No barcode detected in image. ' +
          'Tips: Ensure the barcode is clearly visible, well-lit, and fills a good portion of the image. ' +
          'Try taking the photo from a slight distance (not too close).';
        setDecodeError(errorMsg);
        addDebugLog('error', 'No barcode detected after all attempts', {
          showDebugOutput: 'Use the debug output below to see detailed information',
        });
        return;
      }

      // Validate length client-side
      const length = digits.length;
      if (![8, 12, 13, 14].includes(length)) {
        setDecodeState('error');
        const errorMsg = `Detected barcode has ${length} digits, but we need 8, 12, 13, or 14 digits. Detected: ${digits}`;
        setDecodeError(errorMsg);
        addDebugLog('error', 'Detected barcode has invalid length', {
          detected: digits,
          length,
          expectedLengths: [8, 12, 13, 14],
        });
        return;
      }

      // Success: set input value and submit
      setInputValue(digits);
      setDecodeState('success');
      setDecodeError(null);
      addDebugLog('success', 'Barcode detection completed successfully', {
        barcode: digits,
        length,
      });
      onBarcodeSubmit(digits);

      // Reset decode state after a brief delay
      setTimeout(() => {
        setDecodeState('idle');
      }, 2000);

      // Reset file input for re-use
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      abortControllerRef.current = null;
    } catch (error: any) {
      // Handle cancellation gracefully
      if (error.message === 'Cancelled' || abortController.signal.aborted) {
        setDecodeState('idle');
        setDecodeError(null);
        abortControllerRef.current = null;
        return;
      }
      console.error('Barcode decode error:', error);
      setDecodeState('error');
      const errorMsg = error.message || 'Failed to decode barcode from image. Please try again.';
      setDecodeError(errorMsg);
      addDebugLog('error', 'Barcode decode error', {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
      });
      abortControllerRef.current = null;
    }
  };

  const handleCancelScan = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setDecodeState('idle');
      setDecodeError(null);
      addDebugLog('info', 'Scan cancelled by user');
    }
  };

  const handlePhotoButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Small delay to ensure iOS Safari handles the click properly
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  };

  return (
    <div className="w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="barcode-input" className="block text-sm font-medium text-gray-700 mb-2">
            Barcode (UPC/GTIN)
          </label>
          <div className="flex gap-2">
            <input
              id="barcode-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setValidationError(null);
              }}
              placeholder="Enter 8, 12, 13, or 14 digit barcode"
              disabled={disabled}
              className="flex-1 px-4 py-3 md:py-2 text-base md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed touch-manipulation"
              aria-describedby={validationError ? 'barcode-error' : 'barcode-help'}
              aria-invalid={!!validationError}
            />
            <button
              type="submit"
              disabled={disabled || !inputValue.trim()}
              className="px-6 py-3 md:py-2 min-h-[44px] bg-blue-600 text-white rounded-lg active:bg-blue-800 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors touch-manipulation font-medium text-base md:text-sm"
            >
              {disabled ? 'Loading...' : 'Lookup'}
            </button>
          </div>
          {validationError && (
            <p id="barcode-error" className="mt-2 text-sm text-red-600" role="alert">
              {validationError}
            </p>
          )}
          <p id="barcode-help" className="mt-2 text-sm text-gray-500">
            Enter a barcode number (spaces and dashes will be removed automatically)
          </p>
        </div>
      </form>

      {/* Photo Upload Section */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Scan from Photo
        </label>
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            capture="environment"
            onChange={handleFileSelect}
            disabled={disabled || decodeState === 'decoding'}
            className="hidden"
            aria-label="Upload barcode photo"
            // iOS Safari: ensure proper camera access
            style={{ display: 'none' }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePhotoButtonClick}
              disabled={disabled || decodeState === 'decoding'}
              className="flex-1 px-4 py-3 min-h-[44px] bg-green-600 text-white rounded-lg active:bg-green-800 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 touch-manipulation font-medium text-base"
            >
              {decodeState === 'decoding' ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Decoding...</span>
                </>
              ) : decodeState === 'success' ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Barcode Detected!</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Scan from Photo</span>
                </>
              )}
            </button>
            {decodeState === 'decoding' && (
              <button
                type="button"
                onClick={handleCancelScan}
                className="px-4 py-3 min-h-[44px] bg-red-600 text-white rounded-lg active:bg-red-800 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors touch-manipulation font-medium text-base"
                aria-label="Cancel scan"
              >
                Cancel
              </button>
            )}
          </div>
          {decodeError && (
            <p className="text-sm text-red-600" role="alert" aria-live="polite">
              {decodeError}
            </p>
          )}
          <p className="text-xs text-gray-500">
            Take or upload a photo of a barcode. Works best with clear, well-lit images.
          </p>
        </div>
      </div>

      {/* Debug Output - Fixed at bottom right */}
      {debugLogs.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowDebug(!showDebug)}
            className="fixed bottom-4 right-4 z-50 px-3 py-2 text-xs text-gray-600 bg-white border border-gray-300 rounded-lg shadow-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {showDebug ? 'Hide Debug' : `Debug (${debugLogs.length})`}
          </button>
          {showDebug && (
            <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] max-h-96 bg-white border border-gray-300 rounded-lg shadow-xl">
              <div className="flex items-center justify-between p-2 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-700">Debug Output</span>
                <button
                  type="button"
                  onClick={() => setShowDebug(false)}
                  className="text-gray-500 hover:text-gray-700 focus:outline-none"
                  aria-label="Close debug"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <textarea
                readOnly
                value={getDebugOutput()}
                className="w-full h-80 p-3 text-xs font-mono bg-gray-50 border-0 rounded-b-lg focus:ring-0 resize-none"
                onClick={(e) => {
                  (e.target as HTMLTextAreaElement).select();
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
