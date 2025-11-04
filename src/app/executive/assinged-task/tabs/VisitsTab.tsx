'use client';

import React, { useState, useEffect } from 'react';
import './VisitsTab.css';
import VPOEditModal from '../../components/VPOEditModal';

interface VisitPlan {
  planId: string;
  storeId: string;
  storeName: string;
  city: string;
  plannedVisitDate: string;
  createdByRole: 'ADMIN' | 'EXECUTIVE';
  status: 'SUBMITTED' | 'COMPLETED';
}

interface StoreDetails {
  id: string;
  storeName: string;
  city: string;
  fullAddress?: string;
  partnerBrands: string[];
}

interface VPODataModal {
  id: string;
  status: string;
  plannedVisitDate: string;
  createdByRole: string;
  adminComment?: string;
  canEdit: boolean;
  stores: StoreDetails[];
}

interface VisitPlansResponse {
  success: boolean;
  data: {
    visitPlans: VisitPlan[];
    totalRows: number;
  };
  error?: string;
}

interface VisitsTabProps {
  onCountUpdate?: () => void;
}

const VisitsTab: React.FC<VisitsTabProps> = ({ onCountUpdate }) => {
  const [visitPlans, setVisitPlans] = useState<VisitPlan[]>([]);
  const [submittedVisits, setSubmittedVisits] = useState<VisitPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingPlanIds, setCompletingPlanIds] = useState<Set<string>>(new Set());

  // VPO Edit modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [vpoData, setVpoData] = useState<VPODataModal | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch visit plans from API
  const fetchVisitPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/executive/assigned-tasks/pending-visit', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please login again.');
        } else if (response.status === 403) {
          throw new Error('Access denied. Executive role required.');
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }

      const result: VisitPlansResponse = await response.json();
      
      if (result.success) {
        const allVisits = result.data.visitPlans || [];
        // Filter based on individual store status, not document status
        const pendingVisits = allVisits
          .filter(visit => visit.status === 'SUBMITTED')
          .sort((a, b) => new Date(b.plannedVisitDate).getTime() - new Date(a.plannedVisitDate).getTime());
        const completedVisits = allVisits
          .filter(visit => visit.status === 'COMPLETED')
          .sort((a, b) => new Date(b.plannedVisitDate).getTime() - new Date(a.plannedVisitDate).getTime());
        
        setVisitPlans(pendingVisits);
        setSubmittedVisits(completedVisits);
        setError(null);
      } else {
        throw new Error(result.error || 'Failed to fetch visit plans');
      }
    } catch (err) {
      console.error('Error fetching visit plans:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch visit plans');
      setVisitPlans([]);
      setSubmittedVisits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitPlans();
  }, []);

  // Open edit modal for a given plan
  const openEditModal = async (planId: string) => {
    try {
      setError(null);
      setSelectedPlanId(planId);
      // Fetch plan details
      const response = await fetch(`/api/executive/visit-plan/${planId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      if (!response.ok) {
        if (response.status === 404) throw new Error('Visit plan not found');
        if (response.status === 403) throw new Error('You are not authorized to view this visit plan');
        throw new Error('Failed to fetch visit plan');
      }
      const result = await response.json();
      const data = result?.data?.visitPlan;
      if (!result.success || !data) {
        throw new Error(result.error || 'Invalid response while fetching visit plan');
      }
      setVpoData(data);
      setIsEditOpen(true);
    } catch (err) {
      console.error('Error opening edit modal:', err);
      setError(err instanceof Error ? err.message : 'Failed to open edit modal');
    }
  };

  const closeEditModal = () => {
    setIsEditOpen(false);
    setSelectedPlanId(null);
    setVpoData(null);
  };

  // Save handler for modal
  const handleSaveVPO = async (payload: { storeIds: string[]; plannedVisitDate: string }) => {
    if (!selectedPlanId) return;
    try {
      setIsSaving(true);
      const response = await fetch(`/api/executive/visit-plan/${selectedPlanId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const msg = errJson.details ? `${errJson.error}: ${errJson.details}` : (errJson.error || 'Failed to save changes');
        throw new Error(msg);
      }
      // Refresh the list to reflect changes instantly
      await fetchVisitPlans();
      closeEditModal();
      // Update parent counts if provided
      if (onCountUpdate) onCountUpdate();
    } catch (err) {
      console.error('Error saving visit plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    // Reset time to 00:00:00 for accurate date comparison
    const visitDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    
    if (visitDate.getTime() === todayDate.getTime()) {
      return 'Today';
    } else if (visitDate.getTime() === yesterdayDate.getTime()) {
      return 'Yesterday';
    } else {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
  };

  // Handle mark as completed
  const handleMarkCompleted = async (planId: string, storeId: string) => {
    const completionKey = `${planId}-${storeId}`;
    if (completingPlanIds.has(completionKey)) return;

    try {
      setCompletingPlanIds(prev => new Set(prev).add(completionKey));
      
      const response = await fetch('/api/executive/assigned-tasks/pending-visit', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          planId: planId, 
          storeId: storeId 
        })
      });

      if (!response.ok) {
        throw new Error('Failed to mark visit plan as completed');
      }

      const result = await response.json();
      if (result.success) {
        // Refetch data to get the most up-to-date state from the server
        await fetchVisitPlans();
        
        // Update parent counts
        if (onCountUpdate) {
          onCountUpdate();
        }
      } else {
        throw new Error(result.error || 'Failed to mark visit plan as completed');
      }
    } catch (err) {
      console.error('Error marking visit plan as completed:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark visit plan as completed');
    } finally {
      setCompletingPlanIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(completionKey);
        return newSet;
      });
    }
  };

  return (
    <div className="pen-visit-tab-container">
      {loading ? (
        <div className="pen-visit-tab-loading">
          <div className="pen-visit-tab-loading-spinner"></div>
          <span className="pen-visit-tab-loading-text">Loading visit plans...</span>
        </div>
      ) : error ? (
        <div className="pen-visit-tab-error">
          <div className="pen-visit-tab-error-title">Error</div>
          <div>{error}</div>
        </div>
      ) : visitPlans.length === 0 ? (
        <div className="pen-visit-tab-empty">
          <div className="pen-visit-tab-empty-icon">🏪</div>
          <h3 className="pen-visit-tab-empty-title">No Pending Visits</h3>
          <p className="pen-visit-tab-empty-text">
            You don't have any pending visit.
          </p>
        </div>
      ) : (
        <div className="pen-visit-tab-table-container">
          <table className="pen-visit-tab-table">
            <thead>
              <tr>
                <th>Store Name</th>
                <th>City</th>
                <th>Visit Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visitPlans.map((plan) => (
                <tr key={`${plan.planId}-${plan.storeId}`}>
                  <td>
                    <div className="pen-visit-tab-store-name">{plan.storeName}</div>
                  </td>
                  <td>
                    <div className="pen-visit-tab-city">{plan.city}</div>
                  </td>
                  <td>
                    <div className="pen-visit-tab-date">{formatDate(plan.plannedVisitDate)}</div>
                  </td>
                  <td>
                    <div className="pen-visit-tab-action-cell">
                      <button 
                        className="pen-visit-tab-complete-btn"
                        onClick={() => handleMarkCompleted(plan.planId, plan.storeId)}
                        disabled={completingPlanIds.has(`${plan.planId}-${plan.storeId}`)}
                      >
                        {completingPlanIds.has(`${plan.planId}-${plan.storeId}`) ? 'Marking...' : 'Mark Completed'}
                      </button>
                      {plan.createdByRole === 'EXECUTIVE' && (
                        <button
                          className="pen-visit-tab-edit-btn"
                          onClick={() => openEditModal(plan.planId)}
                          style={{ marginLeft: '8px' }}
                        >
                          Edit Plan
                        </button>
                      )}
                      <span className="pen-visit-tab-created-by">
                        Created by {plan.createdByRole}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Edit VPO Modal */}
      {isEditOpen && vpoData && (
        <VPOEditModal
          isOpen={isEditOpen}
          onClose={closeEditModal}
          vpoData={vpoData}
          onSave={handleSaveVPO}
          isSubmitting={isSaving}
        />
      )}
    </div>
  );
};

export default VisitsTab;
