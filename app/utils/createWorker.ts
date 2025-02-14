export function createWorker() {
  if (typeof window === 'undefined') return null;
  
  const workerCode = `
    self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');

    let isPaused = false;
    let resolveResume;

    async function waitIfPaused() {
      if (isPaused) {
        await new Promise(resolve => {
          resolveResume = resolve;
        });
      }
    }

    async function processImage(imageData, filename) {
      await waitIfPaused();
      const canvas = new OffscreenCanvas(imageData.width, imageData.height);
      const ctx = canvas.getContext('2d');
      
      if (!ctx) throw new Error('Failed to get canvas context');

      ctx.drawImage(imageData, 0, 0);

      const watermarkWidth = Math.min(canvas.width * 0.95, 4000);
      const watermarkHeight = watermarkWidth * (150/1000);
      const fontSize = Math.floor(watermarkWidth * (72/1000));
      const marginBottom = canvas.height * 0.1;
      const watermarkY = canvas.height * 0.7;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      const rectX = (canvas.width - watermarkWidth) / 2;
      const rectY = Math.min(watermarkY, canvas.height - watermarkHeight - marginBottom);
      const radius = watermarkHeight * 0.1;
      
      ctx.moveTo(rectX + radius, rectY);
      ctx.lineTo(rectX + watermarkWidth - radius, rectY);
      ctx.quadraticCurveTo(rectX + watermarkWidth, rectY, rectX + watermarkWidth, rectY + radius);
      ctx.lineTo(rectX + watermarkWidth, rectY + watermarkHeight - radius);
      ctx.quadraticCurveTo(rectX + watermarkWidth, rectY + watermarkHeight, rectX + watermarkWidth - radius, rectY + watermarkHeight);
      ctx.lineTo(rectX + radius, rectY + watermarkHeight);
      ctx.quadraticCurveTo(rectX, rectY + watermarkHeight, rectX, rectY + watermarkHeight - radius);
      ctx.lineTo(rectX, rectY + radius);
      ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'black';
      ctx.font = \`bold \${fontSize}px Arial, "Microsoft YaHei"\`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const text = filename.replace(/\\.[^/.]+$/, '');
      ctx.fillText(
        text, 
        canvas.width / 2,
        Math.min(watermarkY, canvas.height - watermarkHeight - marginBottom) + watermarkHeight / 2
      );

      return await canvas.convertToBlob({
        type: 'image/jpeg',
        quality: 0.85
      });
    }

    async function processZipFile(zipData) {
      const zip = await JSZip.loadAsync(zipData);
      const newZip = new JSZip();
      let processed = 0;
      const imageFiles = Object.entries(zip.files).filter(([name, file]) => 
        !file.dir && /\\.(jpe?g|png|gif)$/i.test(name)
      );
      const total = imageFiles.length;

      for (const [filename, file] of imageFiles) {
        await waitIfPaused();
        try {
          const arrayBuffer = await file.async('arraybuffer');
          const blob = new Blob([arrayBuffer]);
          const bitmap = await createImageBitmap(blob);
          const processedBlob = await processImage(bitmap, filename);
          newZip.file(filename, processedBlob);
          processed++;
          self.postMessage({ 
            type: 'progress', 
            progress: (processed / total) * 100 
          });
        } catch (error) {
          console.error(\`Error processing \${filename}:\`, error);
        }
      }

      return await newZip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
    }

    self.onmessage = async function(e) {
      try {
        const { type, data, filename } = e.data;
        
        if (type === 'pause') {
          isPaused = true;
          self.postMessage({ type: 'paused' });
        }
        else if (type === 'resume') {
          isPaused = false;
          if (resolveResume) resolveResume();
          self.postMessage({ type: 'resumed' });
        }
        else if (type === 'image') {
          const bitmap = await createImageBitmap(data);
          const processedBlob = await processImage(bitmap, filename);
          self.postMessage({ type: 'complete', result: processedBlob });
        } 
        else if (type === 'zip') {
          const processedZip = await processZipFile(data);
          self.postMessage({ type: 'complete', result: processedZip });
        }
      } catch (error) {
        self.postMessage({ 
          type: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    };
  `;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(blob);
  return new Worker(workerUrl);
} 