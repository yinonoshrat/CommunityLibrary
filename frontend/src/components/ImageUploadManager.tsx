import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Alert,
  AlertTitle,
  Paper,
  IconButton,
  Stack,
  Button,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Close as CloseIcon,
  PhotoCamera as CameraIcon,
  PhotoLibrary as GalleryIcon,
} from '@mui/icons-material';
import { apiCall } from '../utils/apiCall';

interface UploadFile {
  id?: string; // Job ID
  file?: File;
  preview?: string;
  size?: number;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'processing';
  progress: number;
  error?: string;
  fileName?: string;
}

interface ImageUploadManagerProps {
  initialJobs?: any[]; // Existing jobs from DB
  onUploadStart?: (jobId: string) => void;
  onUploadProgress?: (jobId: string, progress: number) => void;
  onUploadComplete?: (jobId: string, results: any) => void;
  onUploadError?: (jobId: string, error: string) => void;
  maxFileSize?: number; // in bytes, default 10MB
  acceptedFormats?: string[];
  disabled?: boolean;
  selectedJobId?: string | null;
  onJobSelect?: (jobId: string) => void;
  onJobDelete?: (jobId: string) => void;
  loading?: boolean;
}

const ImageUploadManager: React.FC<ImageUploadManagerProps> = ({
  initialJobs = [],
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  acceptedFormats = ['image/jpeg', 'image/png', 'image/webp'],
  disabled = false,
  selectedJobId,
  onJobSelect,
  onJobDelete,
  loading = false,
}) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Initialize with existing jobs and sync state
  React.useEffect(() => {
    const existingFiles: UploadFile[] = initialJobs.map(job => ({
      id: job.id,
      preview: job.image_base64_thumbnail 
        ? `data:image/jpeg;base64,${job.image_base64_thumbnail}` 
        : (job.image?.thumbnail 
            ? `data:image/jpeg;base64,${job.image.thumbnail}` 
            : (job.image_storage_url || job.image?.url || (job.image_data ? `data:${job.image_mime_type || 'image/jpeg'};base64,${job.image_data}` : undefined))),
      size: job.image_size_bytes || job.image?.size_bytes || 0,
      status: job.status === 'completed' ? 'success' : job.status === 'failed' ? 'error' : 'processing',
      progress: job.progress || 0,
      error: job.error,
      fileName: job.image_original_filename || job.image?.filename || 'Existing Image'
    }));
    
    setFiles(prev => {
      // 1. Get IDs of jobs currently in the server list
      const serverJobIds = new Set(initialJobs.map(j => j.id));
      
      // 2. Keep files that are:
      //    a) Local uploads (no ID yet)
      //    b) Server jobs that still exist in initialJobs
      const keptFiles = prev.filter(f => !f.id || serverJobIds.has(f.id));
      
      // 3. Add new files from server that aren't in keptFiles
      const newFiles = existingFiles.filter(ef => !keptFiles.some(kf => kf.id === ef.id));
      
      // 4. Update existing files with new data from server (e.g. status changes)
      const updatedFiles = keptFiles.map(kf => {
        if (!kf.id) return kf;
        const serverFile = existingFiles.find(ef => ef.id === kf.id);
        if (serverFile) {
          // Merge server data
          return { ...kf, ...serverFile };
        }
        return kf;
      });

      return [...updatedFiles, ...newFiles];
    });

    // Poll processing jobs
    initialJobs.forEach(job => {
      if (job.status !== 'completed' && job.status !== 'failed') {
        pollJobStatus(job.id);
      }
    });
  }, [initialJobs]);

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
      if (!fileItem.file) continue;

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
        const result = await apiCall<{ jobId: string }>('/api/books/detect-from-image', {
          method: 'POST',
          body: formData,
        });

        const jobId = result.jobId;

        // Mark as success (initially, waiting for poll)
        // Actually, we should keep it as uploading until poll completes?
        // Or maybe 'processing'?
        // The original code marked as success then polled.
        // But success implies done.
        // Let's keep it as uploading but with progress updates.
        
        onUploadStart?.(jobId);

        // Poll for job status
        pollJobStatus(jobId, fileItem.file);
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

  const pollJobStatus = async (jobId: string, file?: File) => {
    const maxAttempts = 120; // 2 minutes with 1s interval
    let attempts = 0;

    const poll = async () => {
      try {
        const job = await apiCall<any>(`/api/books/detect-job/${jobId}`);
        onUploadProgress?.(jobId, job.progress || 0);
        
        // Update progress in UI
        setFiles((prev) =>
          prev.map((f) =>
            (f.id === jobId || (file && f.file === file)) ? { 
              ...f, 
              id: jobId, 
              // Cap progress at 99% if not completed to avoid confusion
              progress: (job.status !== 'completed' && (job.progress || 0) >= 100) ? 99 : (job.progress || 0) 
            } : f
          )
        );

        if (job.status === 'completed') {
          setFiles((prev) =>
            prev.map((f) =>
              (f.id === jobId || (file && f.file === file)) ? { ...f, id: jobId, status: 'success', progress: 100 } : f
            )
          );
          onUploadComplete?.(jobId, job);
        } else if (job.status === 'failed') {
          setFiles((prev) =>
            prev.map((f) =>
              (f.id === jobId || (file && f.file === file)) ? { ...f, id: jobId, status: 'error', error: job.error || 'Detection failed' } : f
            )
          );
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

  const removeFile = (fileItem: UploadFile) => {
    setFiles((prev) => prev.filter((f) => f !== fileItem));
    if (fileItem.id && onJobDelete) {
      onJobDelete(fileItem.id);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Upload Zone */}
      <Box sx={{ textAlign: 'center', mb: 2 }}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedFormats.join(',')}
          onChange={handleInputChange}
          disabled={disabled}
          style={{ display: 'none' }}
        />
        
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleInputChange}
          disabled={disabled}
          style={{ display: 'none' }}
        />

        <Typography variant="body1" color="text.primary" sx={{ mb: 2, fontWeight: 500 }} dir="auto">
          בחר אפשרות להעלאת תמונות:
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
          <Button
            variant="contained"
            startIcon={<CameraIcon />}
            onClick={() => !disabled && cameraInputRef.current?.click()}
            disabled={disabled}
          >
            צלם תמונה
          </Button>
          <Button
            variant="outlined"
            startIcon={<GalleryIcon />}
            onClick={() => !disabled && fileInputRef.current?.click()}
            disabled={disabled}
          >
            בחר מהגלריה (מרובה)
          </Button>
        </Stack>

        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          פורמטים נתמכים: {acceptedFormats.join(', ')} • גודל מקסימלי: {formatFileSize(maxFileSize)}
        </Typography>
      </Box>

      {/* Global Error Alert */}
      {globalError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <AlertTitle>שגיאה</AlertTitle>
          {globalError}
        </Alert>
      )}

      {/* Files List */}
      {(files.length > 0 || loading) && (
        <Stack spacing={2} sx={{ mt: 3 }}>
          <Typography variant="subtitle2">העלאות ({files.length})</Typography>
          
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <LinearProgress sx={{ width: '100%' }} />
            </Box>
          )}

          {files.map((fileItem, idx) => (
            <Paper
              key={idx}
              variant="outlined"
              onClick={() => {
                if (fileItem.status === 'success' && fileItem.id && onJobSelect) {
                  onJobSelect(fileItem.id);
                }
              }}
              sx={{ 
                p: 2, 
                display: 'flex', 
                gap: 2, 
                alignItems: 'flex-start',
                cursor: (fileItem.status === 'success' && onJobSelect) ? 'pointer' : 'default',
                borderColor: (selectedJobId && fileItem.id === selectedJobId) ? 'primary.main' : 'divider',
                bgcolor: (selectedJobId && fileItem.id === selectedJobId) ? 'action.selected' : 'background.paper',
                transition: 'all 0.2s',
                '&:hover': {
                   borderColor: (fileItem.status === 'success' && onJobSelect) ? 'primary.main' : undefined,
                   bgcolor: (fileItem.status === 'success' && onJobSelect && (!selectedJobId || fileItem.id !== selectedJobId)) ? 'action.hover' : undefined
                }
              }}
            >
              {/* Thumbnail */}
              {fileItem.preview && (
                <Box
                  component="img"
                  src={fileItem.preview}
                  alt="Preview"
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: 1,
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                />
              )}

              {/* File Info */}
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="body2" noWrap fontWeight="medium">
                    {fileItem.file?.name || fileItem.fileName || 'תמונה'}
                  </Typography>
                  {fileItem.status === 'success' && (
                    <CheckCircleIcon color="success" fontSize="small" />
                  )}
                  {fileItem.status === 'error' && (
                    <ErrorIcon color="error" fontSize="small" />
                  )}
                </Box>

                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  {formatFileSize(fileItem.size || 0)}
                </Typography>

                {/* Progress Bar */}
                {(fileItem.status === 'uploading' || fileItem.status === 'pending' || fileItem.status === 'processing') && (
                  <Box sx={{ width: '100%', mt: 1 }}>
                    <LinearProgress variant="determinate" value={fileItem.progress} />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                      {fileItem.progress >= 99 ? 'מעבד תוצאות סופיות...' : `${Math.round(fileItem.progress)}% הושלם`}
                    </Typography>
                  </Box>
                )}
                
                {fileItem.status === 'error' && (
                  <Typography variant="caption" color="error">
                    {fileItem.error}
                  </Typography>
                )}
              </Box>
              
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); removeFile(fileItem); }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default ImageUploadManager;
