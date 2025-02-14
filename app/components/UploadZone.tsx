'use client';

import { useDropzone } from 'react-dropzone';
import { create } from 'zustand';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface UploadStore {
  progress: number;
  isUploading: boolean;
  processingTime: number;
  downloadUrl: string;
  fileName: string;
  reset: () => void;
}

const useUploadStore = create<UploadStore>((set) => ({
  progress: 0,
  isUploading: false,
  processingTime: 0,
  downloadUrl: '',
  fileName: '',
  reset: () => set({ 
    progress: 0, 
    isUploading: false, 
    processingTime: 0,
    downloadUrl: '',
    fileName: ''
  })
}));

export default function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const startTimeRef = useRef<number>(0);
  const { progress, isUploading, processingTime, downloadUrl, fileName, reset } = useUploadStore();
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    reset();
  };

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const formData = new FormData();
    acceptedFiles.forEach(file => {
      formData.append('files', file);
    });
    
    startTimeRef.current = performance.now();
    useUploadStore.setState({ 
      isUploading: true, 
      progress: 0,
      downloadUrl: '',
      fileName: acceptedFiles.length > 1 ? 'processed_images.zip' : acceptedFiles[0].name
    });
    
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) throw new Error('Upload failed');

      const endTime = performance.now();
      const processTime = (endTime - startTimeRef.current) / 1000; // 转换为秒
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      useUploadStore.setState({ 
        processingTime: Number(processTime.toFixed(2)),
        progress: 100,
        downloadUrl: url
      });
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Upload cancelled');
      } else {
        console.error('Upload error:', error);
        alert('上传失败，请重试');
      }
      reset();
    } finally {
      abortControllerRef.current = null;
    }
  };

  // 清理函数
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (downloadUrl) {
        window.URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);
  
  // 模拟上传进度
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isUploading && progress < 90) {
      interval = setInterval(() => {
        useUploadStore.setState(state => ({
          progress: Math.min(state.progress + Math.random() * 10, 90)
        }));
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isUploading, progress]);

  const { getRootProps, getInputProps } = useDropzone({ 
    onDrop,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'application/zip': ['.zip']
    },
    maxSize: 100 * 1024 * 1024,
    disabled: isUploading
  });

  return (
    <div className="space-y-6">
      <motion.div 
        {...getRootProps()} 
        className={`
          upload-container
          ${isDragging ? 'dragging' : ''}
          ${isUploading ? 'pointer-events-none opacity-50' : ''}
        `}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <input {...getInputProps()} />
        <motion.div className="text-center">
          <motion.div 
            className="mb-4"
            animate={{ rotate: isDragging ? [0, -10, 10, -10, 0] : 0 }}
          >
            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
          <p className="text-gray-600">拖拽文件到这里或点击选择文件</p>
          <p className="text-sm text-gray-500 mt-2">
            支持 JPG, PNG, GIF 图片或 ZIP 文件 (最大 100MB)
          </p>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {(isUploading || downloadUrl) && (
          <motion.div 
            className="bg-white rounded-lg shadow-lg p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="space-y-4">
              {isUploading && !downloadUrl && (
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
                      处理中... {Math.round(progress)}%
                    </div>
                    <motion.button
                      onClick={handleCancel}
                      className="px-4 py-2 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 transition-colors"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      取消处理
                    </motion.button>
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