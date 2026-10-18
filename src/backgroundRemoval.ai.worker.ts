import * as ort from 'onnxruntime-web/webgpu';

const MODEL_URL =
  'https://huggingface.co/Ko033/isnet-general-use-onnx/resolve/main/onnx/model_quantized.onnx';
const CACHE_NAME = 'axis-isnet-general-use-v1';
const SIDE = 1024;
const COUNT = SIDE * SIDE;

type InputMessage = { type: 'segment'; id: number; pixels: ArrayBuffer };
type OutputMessage =
  | { type: 'progress'; id: number; stage: 'download' | 'model' | 'inference'; progress: number }
  | { type: 'result'; id: number; mask: ArrayBuffer }
  | { type: 'error'; id: number; message: string };

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function send(message: OutputMessage, transfer: Transferable[] = []) {
  self.postMessage(message, transfer);
}

async function loadModel(id: number): Promise<ArrayBuffer> {
  const cache = 'caches' in self ? await caches.open(CACHE_NAME) : null;
  let response = await cache?.match(MODEL_URL);
  if (!response) {
    send({ type: 'progress', id, stage: 'download', progress: 0 });
    response = await fetch(MODEL_URL, { mode: 'cors' });
    if (!response.ok) throw new Error(`O modelo não pôde ser baixado (${response.status}).`);
    const total = Number(response.headers.get('content-length')) || 0;
    if (!response.body) {
      const bytes = await response.arrayBuffer();
      try {
        await cache?.put(MODEL_URL, new Response(bytes.slice(0)));
      } catch {
        // Processing can continue even if browser storage is full.
      }
      return bytes;
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      chunks.push(value);
      received += value.byteLength;
      send({
        type: 'progress',
        id,
        stage: 'download',
        progress: total ? Math.min(99, Math.round((received / total) * 100)) : 0,
      });
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      await cache?.put(MODEL_URL, new Response(bytes.slice().buffer));
    } catch {
      // Processing can continue even if browser storage is full.
    }
    return bytes.buffer;
  }
  return response.arrayBuffer();
}

async function getSession(id: number) {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      send({ type: 'progress', id, stage: 'model', progress: 4 });
      const model = await loadModel(id);
      send({ type: 'progress', id, stage: 'model', progress: 72 });
      // ORT's small runtime files are version-pinned. The model and the image remain local.
      ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/';
      try {
        const value = await ort.InferenceSession.create(model, {
          executionProviders: ['webgpu'],
          graphOptimizationLevel: 'all',
        });
        send({ type: 'progress', id, stage: 'model', progress: 100 });
        return value;
      } catch {
        const value = await ort.InferenceSession.create(model, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        });
        send({ type: 'progress', id, stage: 'model', progress: 100 });
        return value;
      }
    })().catch((error: unknown) => {
      sessionPromise = null;
      throw error;
    });
  }
  return sessionPromise;
}

self.onmessage = async (event: MessageEvent<InputMessage>) => {
  const { id, pixels } = event.data;
  if (event.data.type !== 'segment') return;
  try {
    const session = await getSession(id);
    const rgba = new Uint8ClampedArray(pixels);
    if (rgba.length !== COUNT * 4) throw new Error('A imagem de entrada tem dimensões inválidas.');
    const input = new Float32Array(COUNT * 3);
    for (let pixel = 0; pixel < COUNT; pixel++) {
      const offset = pixel * 4;
      input[pixel] = rgba[offset] / 255 - 0.5;
      input[COUNT + pixel] = rgba[offset + 1] / 255 - 0.5;
      input[COUNT * 2 + pixel] = rgba[offset + 2] / 255 - 0.5;
    }
    send({ type: 'progress', id, stage: 'inference', progress: 10 });
    const output = await session.run({ input_image: new ort.Tensor('float32', input, [1, 3, SIDE, SIDE]) });
    const tensor = output.output_image;
    if (!tensor || tensor.data.length < COUNT) throw new Error('O modelo não retornou a máscara de recorte.');
    const values = tensor.data as Float32Array;
    let min = Infinity;
    let max = -Infinity;
    for (let index = 0; index < COUNT; index++) {
      min = Math.min(min, values[index]);
      max = Math.max(max, values[index]);
    }
    const range = Math.max(1e-6, max - min);
    const mask = new Uint8Array(COUNT);
    for (let index = 0; index < COUNT; index++) {
      mask[index] = Math.max(0, Math.min(255, Math.round(((values[index] - min) / range) * 255)));
    }
    send({ type: 'progress', id, stage: 'inference', progress: 100 });
    send({ type: 'result', id, mask: mask.buffer }, [mask.buffer]);
  } catch (error) {
    send({
      type: 'error',
      id,
      message:
        error instanceof Error
          ? error.message
          : 'Não foi possível preparar o recorte inteligente neste navegador.',
    });
  }
};
