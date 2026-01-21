import { useState } from 'react';
import DashboardLayout, { adminTabs } from './DashboardLayout';
import AdminOverview from './admin/AdminOverview';
import AdminComplaints from './admin/AdminComplaints';
import AdminCategories from './admin/AdminCategories';
import AdminReports from './admin/AdminReports';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <AdminOverview onNavigate={setActiveTab} />;
      case 'complaints':
        return <AdminComplaints />;
      case 'categories':
        return <AdminCategories />;
      case 'reports':
        return <AdminReports />;
      default:
        return <AdminOverview onNavigate={setActiveTab} />;
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab} tabs={adminTabs}>
      {renderContent()}
    </DashboardLayout>
  );
}
