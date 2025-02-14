export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import sharp from 'sharp';
import JSZip from 'jszip';

export async function POST(req: Request) {
  try {
    if (!req.body) {
      return new Response('No request body', { status: 400 });
    }

    const formData = await req.formData();
    const files = formData.getAll('files');
    
    if (files.length === 0) {
      return new Response('No files found in request', { status: 400 });
    }

    // 处理ZIP文件
    async function processZipFile(zipBuffer: Buffer) {
      const zip = new JSZip();
      await zip.loadAsync(zipBuffer);
      const processedFiles = [];

      for (const [filename, zipEntry] of Object.entries(zip.files)) {
        if (!zipEntry.dir && /\.(jpe?g|png|gif)$/i.test(filename)) {
          const imageBuffer = await zipEntry.async('nodebuffer');
          const processedImage = await processImage(imageBuffer, filename);
          processedFiles.push({
            name: filename,
            data: processedImage
          });
        }
      }

      const newZip = new JSZip();
      for (const file of processedFiles) {
        newZip.file(file.name, file.data);
      }

      return await newZip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
    }

    // 处理单个图片
    async function processImage(buffer: Buffer, filename: string) {
      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image dimensions');
      }

      const { width, height } = metadata;
      const watermarkWidth = Math.max(Math.min(width * 0.95, 4000), 2000);
      const watermarkHeight = Math.floor(watermarkWidth * (750/4000));
      const fontSize = Math.floor(watermarkWidth * (360/4000));

      const marginBottom = Math.floor(height * 0.1);
      const watermarkY = Math.floor(height * 0.7);

      const watermarkText = Buffer.from(`
        <svg width="${watermarkWidth}" height="${watermarkHeight}">
          <style>
            .text { 
              fill: black; 
              font-size: ${fontSize}px;
              font-family: "Arial", "Microsoft YaHei"; 
              font-weight: bold;
            }
            .background { 
              fill: white; 
              fill-opacity: 0.85; 
            }
          </style>
          <rect class="background" 
            x="${watermarkWidth * 0.0125}" 
            y="${watermarkHeight * 0.0667}" 
            width="${watermarkWidth * 0.975}" 
            height="${watermarkHeight * 0.867}" 
            rx="${watermarkHeight * 0.1}"
          />
          <text class="text" 
            x="${watermarkWidth/2}" 
            y="${watermarkHeight/2 + fontSize/3}" 
            text-anchor="middle"
          >
            ${filename.replace(/\.[^/.]+$/, '')}
          </text>
        </svg>
      `);

      return await sharp(buffer)
        .rotate()
        .resize({
          width,
          height,
          fit: 'inside',
          withoutEnlargement: true
        })
        .composite([{
          input: watermarkText,
          top: Math.min(watermarkY, height - watermarkHeight - marginBottom),
          left: Math.max(0, Math.floor((width - watermarkWidth) / 2)),
          blend: 'over'
        }])
        .jpeg({ 
          quality: 85,
          progressive: true
        })
        .toBuffer();
    }

    // 处理所有文件
    const processedFiles = await Promise.all(
      files.map(async (file: FormDataEntryValue) => {
        if (!(file instanceof File)) {
          throw new Error('Invalid file type');
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (file.type === 'application/zip') {
          const processedZip = await processZipFile(buffer);
          return {
            name: file.name,
            data: processedZip,
            type: 'zip' as const
          };
        }

        const processedImage = await processImage(buffer, file.name);
        return {
          name: file.name,
          data: processedImage,
          type: 'image' as const
        };
      })
    );

    // 返回处理结果
    if (processedFiles.length === 1) {
      const file = processedFiles[0];
      const contentType = file.type === 'zip' ? 'application/zip' : 'image/jpeg';
      
      return new Response(file.data, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
        }
      });
    } else {
      // 多文件打包
      const zip = new JSZip();
      processedFiles.forEach(file => {
        zip.file(file.name, file.data);
      });
      
      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      return new Response(zipBuffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="processed_images.zip"',
        }
      });
    }

  } catch (error: unknown) {
    console.error('Processing error:', error);
    
    let errorMessage = 'Internal server error';
    let errorStack: string | undefined = undefined;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        stack: errorStack
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}