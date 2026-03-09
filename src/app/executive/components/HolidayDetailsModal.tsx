'use client';

import React from 'react';
import './HolidayDetailsModal.css';

interface HolidayRequest {
    id: string;
    secNames: string[];
    reason: string;
    startDate: string;
    endDate: string;
    status: string;
    submittedAt: string;
    storeName?: string;
    adminComment?: string;
    reviewedAt?: string;
    reviewedBy?: string;
    type?: 'VACATION' | 'WEEK_OFF';
    replacementAvailable?: boolean | null;
}

interface HolidayDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    holiday: HolidayRequest | null;
}

const HolidayDetailsModal: React.FC<HolidayDetailsModalProps> = ({
    isOpen,
    onClose,
    holiday
}) => {
    const getStatusColor = (status: string) => {
        switch (status?.toUpperCase()) {
            case 'PENDING':
                return '#ffc107'; // yellow
            case 'APPROVED':
                return '#28a745'; // green
            case 'REJECTED':
                return '#dc3545'; // red
            default:
                return '#6c757d'; // gray
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    React.useEffect(() => {
        if (isOpen) {
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape') onClose();
            };
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
            return () => {
                document.removeEventListener('keydown', handleKeyDown);
                document.body.style.overflow = 'unset';
            };
        }
    }, [isOpen, onClose]);

    if (!isOpen || !holiday) return null;

    return (
        <div className="holiday-modal-overlay" onClick={handleOverlayClick}>
            <div className="holiday-modal-content" onClick={e => e.stopPropagation()}>
                <div className="holiday-modal-header">
                    <h2 className="holiday-modal-title">Vacation Request Details</h2>
                    <button className="holiday-modal-close" onClick={onClose}>×</button>
                </div>

                <div className="holiday-modal-body">
                    {/* Basic Info Section */}
                    <div className="holiday-detail-section">
                        <h3 className="holiday-detail-section-title">Request Information</h3>
                        <div className="holiday-detail-grid">

                            <div className="holiday-detail-item">
                                <span className="holiday-detail-label">Submitted On</span>
                                <span className="holiday-detail-value">{formatDate(holiday.submittedAt)}</span>
                            </div>
                            <div className="holiday-detail-item">
                                <span className="holiday-detail-label">Store</span>
                                <span className="holiday-detail-value">{holiday.storeName || 'N/A'}</span>
                            </div>
                            <div className="holiday-detail-item">
                                <span className="holiday-detail-label">Request Type</span>
                                <span className="holiday-detail-value" style={{
                                    color: holiday.type === 'WEEK_OFF' ? '#17a2b8' : '#6f42c1',
                                    fontWeight: 'bold'
                                }}>
                                    {holiday.type === 'WEEK_OFF' ? 'Week Off' : 'Vacation'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Date Range Section */}
                    <div className="holiday-detail-section">
                        <h3 className="holiday-detail-section-title">Duration</h3>
                        <div className="holiday-detail-grid">
                            <div className="holiday-detail-item">
                                <span className="holiday-detail-label">Start Date</span>
                                <span className="holiday-detail-value">{formatDate(holiday.startDate)}</span>
                            </div>
                            <div className="holiday-detail-item">
                                <span className="holiday-detail-label">End Date</span>
                                <span className="holiday-detail-value">{formatDate(holiday.endDate)}</span>
                            </div>
                        </div>
                    </div>

                    {/* SEC Names Section */}
                    <div className="holiday-detail-section">
                        <h3 className="holiday-detail-section-title">SEC Details</h3>
                        <div className="holiday-detail-text">
                            {holiday.secNames && holiday.secNames.length > 0
                                ? holiday.secNames.join(', ')
                                : 'No SEC names provided'}
                        </div>
                    </div>

                    {/* Reason Section */}
                    <div className="holiday-detail-section">
                        <h3 className="holiday-detail-section-title">Reason</h3>
                        <div className="holiday-detail-text">
                            {holiday.reason}
                        </div>
                    </div>

                    {/* Replacement Info Section (Vacation Only) */}
                    {holiday.type !== 'WEEK_OFF' && (
                        <div className="holiday-detail-section">
                            <h3 className="holiday-detail-section-title">Replacement Staff</h3>
                            <div className="holiday-detail-item">
                                <span className="holiday-detail-label">Availability</span>
                                <span className="holiday-detail-value">
                                    {holiday.replacementAvailable === true ? 'Yes' : holiday.replacementAvailable === false ? 'No' : 'N/A'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Admin Comment Section (if available) */}
                    {(holiday.adminComment || holiday.reviewedBy) && (
                        <div className="holiday-detail-section">
                            <h3 className="holiday-detail-section-title">Admin Review</h3>
                            <div className="holiday-detail-grid" style={{ marginBottom: '12px' }}>
                                {holiday.reviewedBy && (
                                    <div className="holiday-detail-item">
                                        <span className="holiday-detail-label">Reviewed By</span>
                                        <span className="holiday-detail-value">{holiday.reviewedBy}</span>
                                    </div>
                                )}
                                {holiday.reviewedAt && (
                                    <div className="holiday-detail-item">
                                        <span className="holiday-detail-label">Reviewed On</span>
                                        <span className="holiday-detail-value">{formatDate(holiday.reviewedAt)}</span>
                                    </div>
                                )}
                            </div>
                            {holiday.adminComment && (
                                <div className="holiday-detail-text holiday-admin-comment">
                                    {holiday.adminComment}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="holiday-modal-footer">
                    <button className="btn-secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default HolidayDetailsModal;
