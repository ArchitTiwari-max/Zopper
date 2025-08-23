'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import './ExecutiveTodoList.css';

interface StoreData {
  id: number;
  storeName: string;
  issue: string;
  city: string;
  status: 'Pending' | 'Submitted';
}

const ExecutiveTodoList: React.FC = () => {
  const router = useRouter();
  const storeData: StoreData[] = [
    {
      id: 1,
      storeName: "Lucky Mobile Gallery",
      issue: "Display arrangement...",
      city: "Ghaziabad",
      status: "Pending"
    },
    {
      id: 2,
      storeName: "Techno Hub",
      issue: "Display arrangement...",
      city: "Noida",
      status: "Pending"
    },
    {
      id: 3,
      storeName: "Digital Express",
      issue: "Display arrangement...",
      city: "Delhi",
      status: "Submitted"
    },
    {
      id: 4,
      storeName: "Alpha Mobiles",
      issue: "Display arrangement...",
      city: "Noida",
      status: "Pending"
    },
    {
      id: 5,
      storeName: "Mobile World",
      issue: "Display arrangement...",
      city: "Delhi",
      status: "Pending"
    },
    {
      id: 6,
      storeName: "Smart Zone",
      issue: "Display arrangement...",
      city: "Delhi",
      status: "Submitted"
    },
    {
      id: 7,
      storeName: "Galaxy Store",
      issue: "Display arrangement...",
      city: "Gurgaon",
      status: "Submitted"
    },
    {
      id: 8,
      storeName: "Tech Paradise",
      issue: "Display arrangement...",
      city: "Faridabad",
      status: "Submitted"
    },
    {
      id: 9,
      storeName: "Galaxy Store",
      issue: "Display arrangement...",
      city: "Gurgaon",
      status: "Submitted"
    },
    {
      id: 10,
      storeName: "Galaxy Store",
      issue: "Display arrangement...",
      city: "Gurgaon",
      status: "Submitted"
    }
  ];

  const handleNavigateToDashboard = () => {
    router.push('/');
  };

  const handleNavigateToVisitHistory = () => {
    router.push('/visit-history');
  };

  const handleNavigateToSettings = () => {
    // Settings page to be implemented
    alert('Settings page coming soon!');
  };

  return (
    <div className="executive-todo-container">
      {/* Header */}

      {/* Main Content */}
      <main>
        <div className="pending-tasks-section">
          <h2 className="section-title">Pending Tasks</h2>
          <p className="section-subtitle">Complete your assigned store visits and reports</p>

          {/* Table */}
          <div className="table-container">
            <table className="tasks-table">
              <thead>
                <tr>
                  <th>STORE NAME</th>
                  <th>ISSUE</th>
                  <th>CITY</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {storeData.map((store) => (
                  <tr key={store.id}>
                    <td className="store-name">{store.storeName}</td>
                    <td className="issue">{store.issue}</td>
                    <td className="city">{store.city}</td>
                    <td>
                      <span 
                        className={`status-badge ${store.status.toLowerCase()}`}
                      >
                        {store.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-navigation">
        <button className="nav-item" onClick={handleNavigateToDashboard}>
          <span className="nav-icon">📊</span>
          <span className="nav-label">Dashboard</span>
        </button>
        <button className="nav-item" onClick={handleNavigateToVisitHistory}>
          <span className="nav-icon">📋</span>
          <span className="nav-label">Visit History</span>
        </button>
        <button className="nav-item" onClick={handleNavigateToSettings}>
          <span className="nav-icon">⚙️</span>
          <span className="nav-label">Settings</span>
        </button>
      </nav>
    </div>
  );
};

export default ExecutiveTodoList;
