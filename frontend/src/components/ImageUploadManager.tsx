import React, { useState, useRef } from 'react';
import { Upload, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface UploadFile {
  file: File;
  preview?: string;
  size: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

interface ImageUploadManagerProps {
  onUploadStart?: (jobId: string) => void;
  onUploadProgress?: (jobId: string, progress: number) => void;
  onUploadComplete?: (jobId: string, results: any) => void;
  onUploadError?: (jobId: string, error: string) => void;
  maxFileSize?: number; // in bytes, default 10MB
  acceptedFormats?: string[];
  disabled?: boolean;
}

const ImageUploadManager: React.FC<ImageUploadManagerProps> = ({
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  acceptedFormats = ['image/jpeg', 'image/png', 'image/webp'],
  disabled = false,
}) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!acceptedFormats.includes(file.type)) {
      return `Invalid format. Accepted: ${acceptedFormats.join(', ')}`;
    }

    // Check file size
    if (file.size > maxFileSize) {
      return `File too large. Max: ${formatFileSize(maxFileSize)}`;
    }

    return null;
  };

  const handleFiles = async (fileList: FileList) => {
    setGlobalError(null);
    const newFiles: UploadFile[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const error = validateFile(file);

      if (error) {
        setGlobalError(`${file.name}: ${error}`);
        continue;
      }

      // Create preview
      const preview = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      newFiles.push({
        file,
        preview,
        size: file.size,
        status: 'pending',
        progress: 0,
      });
    }

    setFiles((prev) => [...prev, ...newFiles]);

    // Auto-upload files
    if (newFiles.length > 0) {
      uploadFiles(newFiles);
    }
  };

  const uploadFiles = async (filesToUpload: UploadFile[]) => {
    for (const fileItem of filesToUpload) {
      try {
        // Update status to uploading
        setFiles((prev) =>
          prev.map((f) =>
            f.file === fileItem.file ? { ...f, status: 'uploading' } : f
          )
        );

        // Create form data
        const formData = new FormData();
        formData.append('image', fileItem.file);

        // Start upload
        const response = await fetch('/api/books/detect', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Upload failed');
        }

        const result = await response.json();
        const jobId = result.jobId;

        // Mark as success
        setFiles((prev) =>
          prev.map((f) =>
            f.file === fileItem.file
              ? { ...f, status: 'success', progress: 100 }
              : f
          )
        );

        onUploadComplete?.(jobId, result);

        // Poll for job status
        pollJobStatus(jobId);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        setFiles((prev) =>
          prev.map((f) =>
            f.file === fileItem.file
              ? { ...f, status: 'error', error: errorMsg }
              : f
          )
        );
        onUploadError?.(fileItem.file.name, errorMsg);
      }
    }
  };

  const pollJobStatus = async (jobId: string) => {
    const maxAttempts = 120; // 2 minutes with 1s interval
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/detection-jobs/${jobId}`);
        if (!response.ok) throw new Error('Poll failed');

        const job = await response.json();
        onUploadProgress?.(jobId, job.progress || 0);

        if (job.status === 'completed') {
          onUploadComplete?.(jobId, job);
        } else if (job.status === 'failed') {
          onUploadError?.(jobId, job.error || 'Detection failed');
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 1000);
        }
      } catch (error) {
        console.error('Poll error:', error);
        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 2000); // Retry with longer interval on error
        }
      }
    };

    poll();
  };

  const removeFile = (file: File) => {
    setFiles((prev) => prev.filter((f) => f.file !== file));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 transition-all
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedFormats.join(',')}
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
        />

        <div className="text-center">
          <Upload className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <h3 className="font-semibold text-gray-700 mb-1">
            Drop images here or click to browse
          </h3>
          <p className="text-sm text-gray-500">
            Supported formats: {acceptedFormats.join(', ')} • Max size: {formatFileSize(maxFileSize)}
          </p>
        </div>
      </div>

      {/* Global Error Alert */}
      {globalError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{globalError}</AlertDescription>
        </Alert>
      )}

      {/* Files List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Uploads ({files.length})</h4>
          {files.map((fileItem, idx) => (
            <div
              key={idx}
              className="border rounded-lg p-3 bg-white hover:bg-gray-50 transition"
            >
              <div className="flex items-start gap-3">
                {/* Thumbnail */}
                {fileItem.preview && (
                  <img
                    src={fileItem.preview}
                    alt="Preview"
                    className="w-16 h-16 rounded object-cover flex-shrink-0"
                  />
                )}

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm truncate">
                      {fileItem.file.name}
                    </p>
                    {fileItem.status === 'success' && (
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    )}
                    {fileItem.status === 'error' && (
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    )}
                  </div>

                  <p className="text-xs text-gray-500 mb-2">
                    {formatFileSize(fileItem.size)}
                  </p>

                  {/* Progress Bar */}
                  {fileItem.status === 'uploading' && (
                    <div className="space-y-1">
                      <Progress value={fileItem.progress} className="h-2" />
                      <p className="text-xs text-gray-600">
                        {fileItem.progress}% uploaded
                      </p>
                    </div>
                  )}

                  {/* Status Message */}
                  {fileItem.status === 'success' && (
                    <p className="text-xs text-green-600">
                      Successfully uploaded • waiting for detection results
                    </p>
                  )}

                  {fileItem.status === 'error' && (
                    <p className="text-xs text-red-600">{fileItem.error}</p>
                  )}

                  {fileItem.status === 'pending' && (
                    <p className="text-xs text-gray-500">Waiting to upload...</p>
                  )}
                </div>

                {/* Remove Button */}
                {(fileItem.status === 'pending' || fileItem.status === 'error') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(fileItem.file)}
                    className="flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {files.length === 0 && (
        <div className="text-center py-4 text-gray-500 text-sm">
          <p>No images selected yet</p>
        </div>
      )}
    </div>
  );
};

export default ImageUploadManager;
