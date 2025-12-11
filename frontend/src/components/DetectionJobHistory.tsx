import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, CheckCircle, Clock, Trash2, Eye } from 'lucide-react';

interface DetectionJob {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  stage: string;
  result?: { books: any[] };
  error?: string;
  error_code?: string;
  can_retry?: boolean;
  created_at: string;
  updated_at: string;
  image: {
    filename: string;
    thumbnail?: string;
    url?: string;
    size_bytes: number;
  };
}

const DetectionJobHistory: React.FC = () => {
  const [jobs, setJobs] = useState<DetectionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<DetectionJob | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchJobs();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/detection-jobs');
      if (!response.ok) throw new Error('Failed to fetch jobs');
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      const response = await fetch(`/api/detection-jobs/${jobId}/retry`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Retry failed');
      await fetchJobs();
    } catch (error) {
      console.error('Error retrying job:', error);
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job and its images?')) return;
    try {
      const response = await fetch(`/api/detection-jobs/${jobId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Delete failed');
      await fetchJobs();
    } catch (error) {
      console.error('Error deleting job:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'processing':
        return <Clock className="w-5 h-5 text-blue-600 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      completed: 'default',
      processing: 'secondary',
      failed: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading && jobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Detection Job History</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Detection Job History</CardTitle>
          <CardDescription>
            View all detection jobs and their results. Click on a job to see details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No detection jobs yet. Upload an image to get started!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Results</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="text-sm">
                      {formatDate(job.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status)}
                        {getStatusBadge(job.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {job.image.thumbnail ? (
                          <img
                            src={`data:image/jpeg;base64,${job.image.thumbnail}`}
                            alt="Job thumbnail"
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-200" />
                        )}
                        <div className="text-sm">
                          <p className="font-medium truncate max-w-[150px]">
                            {job.image.filename}
                          </p>
                          <p className="text-gray-500">
                            {formatBytes(job.image.size_bytes)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <span className="text-sm">{job.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {job.status === 'completed' && job.result?.books ? (
                        <Badge variant="outline">
                          {job.result.books.length} books
                        </Badge>
                      ) : job.status === 'failed' ? (
                        <Badge variant="destructive">{job.error_code}</Badge>
                      ) : (
                        <Badge variant="secondary">{job.stage}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedJob(job);
                            setShowDetails(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {job.status === 'failed' && job.can_retry && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRetry(job.id)}
                          >
                            Retry
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(job.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Job Details</DialogTitle>
            <DialogDescription>
              {selectedJob && formatDate(selectedJob.created_at)}
            </DialogDescription>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-4">
              {/* Job Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold mb-1">Status</h4>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(selectedJob.status)}
                    {getStatusBadge(selectedJob.status)}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-1">Progress</h4>
                  <p className="text-lg font-bold">{selectedJob.progress}%</p>
                </div>
              </div>

              {/* Image Details */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Image</h4>
                <div className="flex gap-4">
                  {selectedJob.image.thumbnail && (
                    <img
                      src={`data:image/jpeg;base64,${selectedJob.image.thumbnail}`}
                      alt="Job thumbnail"
                      className="w-40 h-40 rounded object-cover border"
                    />
                  )}
                  <div>
                    <p className="text-sm"><strong>Name:</strong> {selectedJob.image.filename}</p>
                    <p className="text-sm"><strong>Size:</strong> {formatBytes(selectedJob.image.size_bytes)}</p>
                    {selectedJob.image.url && (
                      <a
                        href={selectedJob.image.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        View full image
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Results */}
              {selectedJob.status === 'completed' && selectedJob.result?.books && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">
                    Detected Books ({selectedJob.result.books.length})
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedJob.result.books.map((book, idx) => (
                      <div key={idx} className="text-sm border-l-2 border-blue-600 pl-3 py-1">
                        <p className="font-medium">{book.title}</p>
                        {book.author && <p className="text-gray-600">by {book.author}</p>}
                        {book.isbn && <p className="text-gray-500">ISBN: {book.isbn}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error Details */}
              {selectedJob.status === 'failed' && (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-sm">
                    <strong className="text-red-700">Error Code:</strong> {selectedJob.error_code}
                  </p>
                  <p className="text-sm mt-1">
                    <strong className="text-red-700">Message:</strong> {selectedJob.error}
                  </p>
                  {selectedJob.can_retry && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleRetry(selectedJob.id);
                        setShowDetails(false);
                      }}
                      className="mt-3"
                    >
                      Retry Job
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DetectionJobHistory;
