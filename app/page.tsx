import UploadZone from './components/UploadZone';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            图片水印处理工具
          </h1>
          <p className="text-lg text-gray-600">
            支持单张图片或批量上传，自动添加水印并打包下载
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <UploadZone />
          
          <div className="mt-8 space-y-4 text-gray-600">
            <h2 className="font-semibold text-gray-800">使用说明：</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>支持上传 ZIP 文件（最大100MB）或多选图片</li>
              <li>支持中文文件名，处理后保持原文件名</li>
              <li>自动添加美观的中文水印</li>
              <li>批量处理自动打包为 ZIP 下载</li>
              <li>单张图片处理后直接下载</li>
            </ul>
          </div>
        </div>

        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>© 2024 图片水印工具 - 快速处理您的图片</p>
        </footer>
      </div>
    </main>
  );
}
