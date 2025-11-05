'use client';

import React from 'react';

const DomainChangePage: React.FC = () => {
  const newDomain = 'salesdost.zopper.com';
  
  const handleRedirect = () => {
    window.location.href = `https://${newDomain}`;
  };
  
  return (
    <div className="domain-change-container">
      <div className="domain-change-content">
        <div className="logo-section">
          <div className="logo">
            <div className="logo-icon">S</div>
            <div className="logo-text-container">
              <span className="logo-text">SalesDost</span>
              <span className="logo-tagline">Safalta ka Sathi</span>
            </div>
          </div>
        </div>
        
        <div className="domain-change-message">
          <div className="domain-change-icon">🌐</div>
          <h1>We've Moved to a New Domain!</h1>
          
          <div className="domain-change-details">
            <div className="detail-item">
              <span className="detail-icon">✨</span>
              <span>New Domain: <a href={`https://${newDomain}`} className="domain-link"><strong>{newDomain}</strong></a></span>
            </div>
          </div>
          
          <div className="domain-change-footer">
            <p>You will be automatically redirected in a few seconds...</p>
            <button 
              onClick={handleRedirect} 
              className="redirect-btn"
            >
              🚀 Go to New Domain
            </button>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .domain-change-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 20px;
        }

        .domain-change-content {
          background: white;
          border-radius: 16px;
          padding: 40px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
          text-align: center;
          max-width: 500px;
          width: 100%;
          animation: fadeIn 0.5s ease-in;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .logo {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 40px;
          gap: 12px;
        }

        .logo-icon {
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 24px;
          font-weight: bold;
        }

        .logo-text-container {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .logo-text {
          font-size: 24px;
          font-weight: bold;
          color: #333;
          line-height: 1;
        }

        .logo-tagline {
          font-size: 12px;
          color: #666;
          margin-top: 2px;
        }

        .domain-change-message {
          text-align: center;
        }

        .domain-change-icon {
          font-size: 60px;
          margin-bottom: 20px;
          animation: bounce 2s infinite;
        }

        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .domain-change-message h1 {
          font-size: 28px;
          color: #333;
          margin-bottom: 16px;
          font-weight: 600;
        }

        .domain-change-message p {
          color: #666;
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 30px;
        }

        .domain-change-details {
          background: #f8f9fa;
          border-radius: 12px;
          padding: 20px;
          margin: 30px 0;
          text-align: left;
        }

        .detail-item {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
          font-size: 14px;
          color: #555;
        }

        .detail-item:last-child {
          margin-bottom: 0;
        }

        .detail-icon {
          margin-right: 10px;
          font-size: 16px;
          width: 20px;
        }

        .domain-link {
          color: #667eea;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .domain-link:hover {
          color: #764ba2;
          text-decoration: underline;
        }

        .domain-change-footer {
          margin-top: 30px;
        }

        .domain-change-footer p {
          color: #666;
          font-size: 14px;
          margin-bottom: 15px;
        }

        .redirect-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-weight: 500;
        }

        .redirect-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
        }

        .redirect-btn:active {
          transform: translateY(0);
        }

        /* Tablet styles */
        @media (max-width: 768px) {
          .domain-change-content {
            padding: 35px 25px;
            max-width: 90%;
          }

          .domain-change-message h1 {
            font-size: 26px;
          }

          .logo-text {
            font-size: 22px;
          }

          .domain-change-icon {
            font-size: 55px;
          }

          .domain-change-details {
            padding: 15px;
          }
        }

        /* Mobile styles */
        @media (max-width: 640px) {
          .domain-change-container {
            padding: 15px;
          }

          .domain-change-content {
            padding: 25px 20px;
            max-width: 95%;
            border-radius: 12px;
          }

          .domain-change-message h1 {
            font-size: 22px;
            line-height: 1.3;
          }

          .domain-change-message p {
            font-size: 15px;
            margin-bottom: 25px;
          }

          .logo {
            margin-bottom: 30px;
            gap: 10px;
          }

          .logo-icon {
            width: 45px;
            height: 45px;
            font-size: 20px;
          }

          .logo-text {
            font-size: 20px;
          }

          .logo-tagline {
            font-size: 11px;
          }

          .domain-change-icon {
            font-size: 50px;
            margin-bottom: 15px;
          }

          .domain-change-details {
            padding: 15px;
            margin: 20px 0;
          }

          .detail-item {
            font-size: 13px;
            margin-bottom: 10px;
            flex-wrap: wrap;
          }

          .detail-icon {
            margin-right: 8px;
            width: 18px;
            font-size: 14px;
          }

          .redirect-btn {
            padding: 10px 20px;
            font-size: 13px;
            width: 100%;
            max-width: 200px;
          }
        }

        /* Small mobile styles */
        @media (max-width: 480px) {
          .domain-change-content {
            padding: 20px 15px;
          }

          .domain-change-message h1 {
            font-size: 20px;
          }

          .domain-change-message p {
            font-size: 14px;
          }

          .logo {
            flex-direction: column;
            gap: 8px;
            margin-bottom: 25px;
          }

          .logo-text-container {
            align-items: center;
          }

          .domain-change-details {
            padding: 12px;
          }

          .detail-item {
            font-size: 12px;
          }

          .redirect-btn {
            padding: 8px 16px;
            font-size: 12px;
          }
        }

        /* Very small screens */
        @media (max-width: 360px) {
          .domain-change-container {
            padding: 10px;
          }

          .domain-change-content {
            padding: 15px 10px;
          }

          .domain-change-icon {
            font-size: 40px;
          }

          .domain-change-message h1 {
            font-size: 18px;
          }
        }
      `}</style>

      <script dangerouslySetInnerHTML={{
        __html: `
          setTimeout(function() {
            window.location.href = 'https://${newDomain}';
          }, 5000);
        `
      }} />
    </div>
  );
};

export default DomainChangePage;
