'use client';

import React, { useState, useRef } from 'react';

interface UploadedImage {
  url: string;
  public_id: string;
  bytes: number;
  format: string;
}

interface ImageUploadProps {
  onUpload: (images: UploadedImage[]) => void;
  multiple?: boolean;
  maxFiles?: number;
  className?: string;
  existingImages?: UploadedImage[];
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  onUpload,
  multiple = true,
  maxFiles = 5,
  className = '',
  existingImages = []
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [images, setImages] = useState<UploadedImage[]>(existingImages);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    const remainingSlots = maxFiles - images.length;
    
    if (fileArray.length > remainingSlots) {
      setError(`You can only upload ${remainingSlots} more image(s). Maximum ${maxFiles} images allowed.`);
      return;
    }

    uploadFiles(fileArray);
  };

  const uploadFiles = async (files: File[]) => {
    setUploading(true);
    setError(null);
    const newImages: UploadedImage[] = [];

    for (const file of files) {
      try {
        // Create progress entry
        const tempId = Math.random().toString(36).substr(2, 9);
        setUploadProgress(prev => ({ ...prev, [tempId]: 0 }));

        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });

        const result = await response.json();

        if (result.success) {
          newImages.push(result.data);
          setUploadProgress(prev => ({ ...prev, [tempId]: 100 }));
        } else {
          throw new Error(result.error || 'Upload failed');
        }

        // Remove progress entry after a short delay
        setTimeout(() => {
          setUploadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[tempId];
            return newProgress;
          });
        }, 1000);

      } catch (error) {
        console.error('Upload error:', error);
        setError(error instanceof Error ? error.message : 'Upload failed');
      }
    }

    if (newImages.length > 0) {
      const updatedImages = [...images, ...newImages];
      setImages(updatedImages);
      onUpload(updatedImages);
    }

    setUploading(false);
  };

  const removeImage = async (index: number) => {
    const imageToRemove = images[index];
    
    try {
      // Delete from Cloudinary
      const response = await fetch('/api/upload', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ public_id: imageToRemove.public_id })
      });

      if (response.ok) {
        const updatedImages = images.filter((_, i) => i !== index);
        setImages(updatedImages);
        onUpload(updatedImages);
      } else {
        throw new Error('Failed to delete image');
      }
    } catch (error) {
      console.error('Delete error:', error);
      setError('Failed to delete image');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`image-upload-container ${className}`}>
      {/* Upload Area */}
      <div
        className={`photo-upload-area ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={(e) => handleFileSelect(e.target.files)}
          style={{ display: 'none' }}
          disabled={uploading || images.length >= maxFiles}
        />
        
        <div className="upload-icon">
          {uploading ? '⏳' : '🖼️'}
        </div>
        <div className="upload-text">
          <div>
            {uploading ? 'Uploading...' : 'Click to upload photos or drag and drop'}
          </div>
          <div className="upload-formats">
            PNG, JPG, WebP up to 5MB • {images.length}/{maxFiles} uploaded
          </div>
        </div>
      </div>

      {/* Progress indicators */}
      {Object.entries(uploadProgress).map(([id, progress]) => (
        <div key={id} className="upload-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <span className="progress-text">{progress}%</span>
        </div>
      ))}

      {/* Error display */}
      {error && (
        <div className="upload-error">
          <span>❌ {error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Uploaded Images Preview */}
      {images.length > 0 && (
        <div className="uploaded-images">
          <h4>Uploaded Images ({images.length})</h4>
          <div className="images-grid">
            {images.map((image, index) => (
              <div key={image.public_id} className="image-preview">
                <img 
                  src={image.url} 
                  alt={`Upload ${index + 1}`}
                  className="preview-image"
                />
                <div className="image-overlay">
                  <div className="image-info">
                    <span className="image-format">{image.format.toUpperCase()}</span>
                    <span className="image-size">{formatFileSize(image.bytes)}</span>
                  </div>
                  <button
                    className="remove-image-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(index);
                    }}
                    title="Remove image"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .image-upload-container {
          width: 100%;
        }

        .photo-upload-area {
          border: 2px dashed #ddd;
          border-radius: 8px;
          padding: 40px 20px;
          text-align: center;
          background: #f9f9f9;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .photo-upload-area:hover {
          border-color: #007bff;
          background: #f0f8ff;
        }

        .photo-upload-area.drag-over {
          border-color: #007bff;
          background: #e3f2fd;
        }

        .photo-upload-area.uploading {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .upload-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .upload-text div:first-child {
          font-size: 16px;
          font-weight: 500;
          color: #333;
          margin-bottom: 8px;
        }

        .upload-formats {
          font-size: 14px;
          color: #666;
        }

        .upload-progress {
          margin: 10px 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .progress-bar {
          flex: 1;
          height: 6px;
          background: #e0e0e0;
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #007bff;
          transition: width 0.3s ease;
        }

        .progress-text {
          font-size: 12px;
          color: #666;
          min-width: 35px;
        }

        .upload-error {
          background: #fee;
          border: 1px solid #fcc;
          color: #c33;
          padding: 10px;
          border-radius: 4px;
          margin: 10px 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .upload-error button {
          background: none;
          border: none;
          color: #c33;
          cursor: pointer;
          font-size: 16px;
        }

        .uploaded-images {
          margin-top: 20px;
        }

        .uploaded-images h4 {
          margin-bottom: 15px;
          color: #333;
          font-size: 16px;
        }

        .images-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 15px;
        }

        .image-preview {
          position: relative;
          aspect-ratio: 1;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #ddd;
        }

        .preview-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .image-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 8px;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .image-preview:hover .image-overlay {
          opacity: 1;
        }

        .image-info {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: white;
        }

        .remove-image-btn {
          background: rgba(255, 255, 255, 0.9);
          border: none;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          cursor: pointer;
          font-size: 14px;
          align-self: flex-end;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .remove-image-btn:hover {
          background: #ff4444;
          color: white;
        }
      `}</style>
    </div>
  );
};

export default ImageUpload;
