'use client';

import { useDropzone } from 'react-dropzone';
import { create } from 'zustand';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import { createWorker } from '../utils/createWorker';

interface UploadStore {
  progress: number;
  isProcessing: boolean;
  isPaused: boolean;
  processingTime: number;
  downloadUrl: string;
  fileName: string;
  reset: () => void;
}

const useUploadStore = create<UploadStore>((set) => ({
  progress: 0,
  isProcessing: false,
  isPaused: false,
  processingTime: 0,
  downloadUrl: '',
  fileName: '',
  reset: () => set({ 
    progress: 0, 
    isProcessing: false,
    isPaused: false,
    processingTime: 0,
    downloadUrl: '',
    fileName: ''
  })
}));

export default function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const startTimeRef = useRef<number>(0);
  const workerRef = useRef<Worker | null>(null);
  const { progress, isProcessing, isPaused, processingTime, downloadUrl, fileName, reset } = useUploadStore();

  const handlePauseResume = () => {
    if (!workerRef.current) return;

    if (isPaused) {
      workerRef.current.postMessage({ type: 'resume' });
    } else {
      workerRef.current.postMessage({ type: 'pause' });
    }
  };

  useEffect(() => {
    workerRef.current = createWorker();
    
    if (!workerRef.current) return;

    workerRef.current.onmessage = (e) => {
      const { type, result, progress: workerProgress, error } = e.data;
      
      if (type === 'progress') {
        useUploadStore.setState({ progress: workerProgress });
      }
      else if (type === 'complete') {
        const endTime = performance.now();
        const processTime = (endTime - startTimeRef.current) / 1000;
        
        const url = URL.createObjectURL(result);
        useUploadStore.setState({ 
          processingTime: Number(processTime.toFixed(2)),
          progress: 100,
          downloadUrl: url,
          isProcessing: false,
          isPaused: false
        });
      }
      else if (type === 'error') {
        console.error('Processing error:', error);
        alert('处理失败，请重试');
        reset();
      }
      else if (type === 'paused') {
        useUploadStore.setState({ isPaused: true });
      }
      else if (type === 'resumed') {
        useUploadStore.setState({ isPaused: false });
      }
    };

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl, reset]);

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    console.log('Files dropped:', acceptedFiles);

    startTimeRef.current = performance.now();
    useUploadStore.setState({ 
      isProcessing: true, 
      progress: 0,
      downloadUrl: '',
      fileName: acceptedFiles.length > 1 || acceptedFiles[0].type === 'application/zip' 
        ? 'processed_images.zip' 
        : acceptedFiles[0].name
    });

    try {
      if (!workerRef.current) {
        throw new Error('Worker not initialized');
      }

      if (acceptedFiles.length === 1 && acceptedFiles[0].type === 'application/zip') {
        console.log('Processing ZIP file');
        const arrayBuffer = await acceptedFiles[0].arrayBuffer();
        workerRef.current.postMessage({
          type: 'zip',
          data: arrayBuffer,
          filename: acceptedFiles[0].name
        });
      }
      else if (acceptedFiles.length === 1) {
        console.log('Processing single image');
        workerRef.current.postMessage({
          type: 'image',
          data: acceptedFiles[0],
          filename: acceptedFiles[0].name
        }, [acceptedFiles[0]]);
      }
      else {
        console.log('Processing multiple images');
        const zip = new JSZip();
        for (const file of acceptedFiles) {
          zip.file(file.name, file);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const arrayBuffer = await zipBlob.arrayBuffer();
        
        workerRef.current.postMessage({
          type: 'zip',
          data: arrayBuffer,
          filename: 'processed_images.zip'
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('上传失败，请重试');
      reset();
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'application/zip': ['.zip']
    },
    multiple: true
  });

  return (
    <div className="space-y-6">
      <div
        {...getRootProps()}
        className={`upload-container ${isDragging ? 'dragging' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="text-center">
          <div className="text-4xl mb-4">📷</div>
          <p className="text-gray-600">
            拖放图片或ZIP文件到这里，或点击选择文件
          </p>
          <p className="text-sm text-gray-500 mt-2">
            支持 JPG、PNG、GIF 格式，或包含这些格式的 ZIP 文件
          </p>
        </div>
      </div>

      <AnimatePresence>
        {(isProcessing || downloadUrl) && (
          <motion.div 
            className="bg-white rounded-lg shadow-lg p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="space-y-4">
              {isProcessing && !downloadUrl && (
                <div className="space-y-4">
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <motion.div 
                      className="h-full bg-blue-500"
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      {isPaused ? '已暂停' : `处理中... ${Math.round(progress)}%`}
                    </div>
                    <div className="flex gap-2">
                      <motion.button
                        onClick={handlePauseResume}
                        className={`px-4 py-2 text-white text-sm rounded-md transition-colors ${
                          isPaused ? 'bg-green-500 hover:bg-green-600' : 'bg-yellow-500 hover:bg-yellow-600'
                        }`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {isPaused ? '继续处理' : '暂停处理'}
                      </motion.button>
                      <motion.button
                        onClick={reset}
                        className="px-4 py-2 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        取消处理
                      </motion.button>
                    </div>
                  </div>
                </div>
              )}

              {downloadUrl && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-green-600 font-medium">
                      ✓ 处理完成
                    </span>
                    <span className="text-gray-500">
                      用时: {processingTime}秒
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 truncate flex-1 mr-4">
                      {fileName}
                    </span>
                    <div className="flex gap-3">
                      <motion.a
                        href={downloadUrl}
                        download={fileName}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        下载文件
                      </motion.a>
                      <motion.button
                        onClick={reset}
                        className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        处理新文件
                      </motion.button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 