importScripts('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');

async function processImage(imageData, filename) {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('Failed to get canvas context');

  // 绘制原图
  ctx.drawImage(imageData, 0, 0);

  // 计算水印尺寸和位置
  const watermarkWidth = Math.min(canvas.width * 0.95, 4000);
  const watermarkHeight = watermarkWidth * (150/1000);
  const fontSize = Math.floor(watermarkWidth * (72/1000));
  const marginBottom = canvas.height * 0.1;
  const watermarkY = canvas.height * 0.7;

  // 绘制水印背景
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

  // 绘制水印文字
  ctx.fillStyle = 'black';
  ctx.font = `bold ${fontSize}px Arial, "Microsoft YaHei"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = filename.replace(/\.[^/.]+$/, '');
  ctx.fillText(
    text, 
    canvas.width / 2,
    Math.min(watermarkY, canvas.height - watermarkHeight - marginBottom) + watermarkHeight / 2
  );

  // 转换为 Blob
  return await canvas.convertToBlob({
    type: 'image/jpeg',
    quality: 0.85
  });
}

async function processZipFile(zipData) {
  const zip = await JSZip.loadAsync(zipData);
  const newZip = new JSZip();
  let processed = 0;
  const total = Object.keys(zip.files).filter(name => 
    /\.(jpe?g|png|gif)$/i.test(name) && !zip.files[name].dir
  ).length;

  for (const [filename, file] of Object.entries(zip.files)) {
    if (!file.dir && /\.(jpe?g|png|gif)$/i.test(filename)) {
      const arrayBuffer = await file.async('arraybuffer');
      const blob = new Blob([arrayBuffer]);
      const bitmap = await createImageBitmap(blob);
      const processedBlob = await processImage(bitmap, filename);
      newZip.file(filename, processedBlob);
      processed++;
      self.postMessage({ type: 'progress', progress: (processed / total) * 100 });
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
    
    if (type === 'image') {
      const bitmap = await createImageBitmap(data);
      const processedBlob = await processImage(bitmap, filename);
      self.postMessage({ type: 'complete', result: processedBlob });
    } 
    else if (type === 'zip') {
      const processedZip = await processZipFile(data);
      self.postMessage({ type: 'complete', result: processedZip });
    }
  } catch (error) {
    self.postMessage({ type: 'error', error: error.message });
  }
}; 