'use client';

import React from 'react';
import './ExecutiveTodoList.css';

interface StoreData {
  id: number;
  storeName: string;
  issue: string;
  city: string;
  status: 'Pending' | 'Submitted';
}

const ExecutiveTodoListCSS: React.FC = () => {
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

  return (
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
  );
};

export default ExecutiveTodoListCSS;
