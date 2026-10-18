/// <reference lib="webworker" />
import { createBackgroundMask } from './backgroundRemoval';
import type { BackgroundColor } from './backgroundRemoval';

type WorkerRequest =
  | { type: 'init'; width: number; height: number; pixels: ArrayBuffer }
  | {
      type: 'process';
      id: number;
      color: BackgroundColor;
      sensitivity: number;
      feather: number;
    };

const scope = self as DedicatedWorkerGlobalScope;
let source: Uint8ClampedArray | null = null;
let width = 0;
let height = 0;

scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type === 'init') {
    width = request.width;
    height = request.height;
    source = new Uint8ClampedArray(request.pixels);
    scope.postMessage({ type: 'ready' });
    return;
  }
  if (!source) return;
  try {
    const mask = createBackgroundMask(
      source,
      width,
      height,
      request.color,
      request.sensitivity,
      request.feather,
    );
    scope.postMessage({ type: 'mask', id: request.id, mask: mask.buffer }, [mask.buffer]);
  } catch {
    scope.postMessage({ type: 'error', id: request.id });
  }
};

export {};
