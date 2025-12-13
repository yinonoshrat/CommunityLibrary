import React, { useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Dialog,
  DialogContent,
  Stack,
  Tooltip,
  Slider,
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Close as CloseIcon,
  RestartAlt as ResetIcon,
} from '@mui/icons-material';

interface JobImagePreviewProps {
  imageUrl?: string;
  altText?: string;
  visible: boolean;
}

export const JobImagePreview: React.FC<JobImagePreviewProps> = ({
  imageUrl,
  altText = 'Detection Image',
  visible,
}) => {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(2.75);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);

  if (!visible || !imageUrl) return null;

  const handleOpen = () => {
    setOpen(true);
    setScale(2.75);
    setPosition({ x: 0, y: 0 });
  };

  const handleClose = () => setOpen(false);

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.5, 5));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.5, 0.5));
  const handleReset = () => {
    setScale(2.75);
    setPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    const newScale = Math.min(Math.max(scale + delta, 0.5), 5);
    setScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ 
        x: e.touches[0].clientX - position.x, 
        y: e.touches[0].clientY - position.y 
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  return (
    <Paper sx={{ p: 0, mb: 3, overflow: 'hidden', position: 'relative' }}>
      <Box 
        sx={{ 
          width: '100%', 
          height: 300, 
          bgcolor: '#f5f5f5',
          position: 'relative',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
        onClick={handleOpen}
      >
        <img 
          src={imageUrl} 
          alt={altText} 
          style={{ 
            maxWidth: '100%', 
            maxHeight: '100%', 
            objectFit: 'contain' 
          }} 
        />
        
        {/* Overlay Controls */}
        <Box 
          sx={{ 
            position: 'absolute', 
            top: 8, 
            right: 8, 
            display: 'flex', 
            gap: 1,
            bgcolor: 'rgba(255,255,255,0.8)',
            borderRadius: 1,
            p: 0.5,
            zIndex: 10
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Tooltip title="הגדל תמונה">
            <IconButton size="small" onClick={handleOpen}>
              <ZoomInIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Box 
          sx={{ 
            position: 'absolute', 
            bottom: 0, 
            left: 0, 
            right: 0, 
            bgcolor: 'rgba(0,0,0,0.5)', 
            color: 'white', 
            p: 0.5, 
            textAlign: 'center',
            opacity: 0,
            transition: 'opacity 0.2s',
            '&:hover': { opacity: 1 }
          }}
        >
          <Typography variant="caption">לחץ להגדלה</Typography>
        </Box>
      </Box>

      {/* Full Screen Zoom Dialog */}
      <Dialog 
        open={open} 
        onClose={handleClose}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: { 
            height: '95vh', 
            maxHeight: '95vh',
            m: 1,
            bgcolor: '#121212',
            color: 'white',
            overflow: 'hidden'
          }
        }}
      >
        {/* Toolbar */}
        <Box sx={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          zIndex: 100, 
          p: 1, 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)'
        }}>
          <Typography variant="subtitle1" sx={{ ml: 2, textShadow: '0 1px 2px black' }}>
            {altText}
          </Typography>
          
          <Stack direction="row" spacing={1} alignItems="center" sx={{ bgcolor: 'rgba(0,0,0,0.5)', borderRadius: 2, p: 0.5 }}>
            <IconButton onClick={handleZoomOut} sx={{ color: 'white' }}><ZoomOutIcon /></IconButton>
            <Slider 
              value={scale} 
              min={0.5} 
              max={5} 
              step={0.1} 
              onChange={(_, val) => setScale(val as number)}
              sx={{ width: 100, color: 'white' }}
            />
            <IconButton onClick={handleZoomIn} sx={{ color: 'white' }}><ZoomInIcon /></IconButton>
            <IconButton onClick={handleReset} sx={{ color: 'white' }}><ResetIcon /></IconButton>
          </Stack>

          <IconButton onClick={handleClose} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        <DialogContent 
          sx={{ 
            p: 0, 
            height: '100%', 
            overflow: 'hidden', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <img 
            ref={imageRef}
            src={imageUrl} 
            alt={altText} 
            draggable={false}
            style={{ 
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              userSelect: 'none'
            }} 
          />
        </DialogContent>
      </Dialog>
    </Paper>
  );
};
