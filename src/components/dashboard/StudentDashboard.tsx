import { useState } from 'react';
import DashboardLayout, { studentTabs } from './DashboardLayout';
import StudentOverview from './student/StudentOverview';
import StudentComplaints from './student/StudentComplaints';
import NewComplaint from './student/NewComplaint';

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <StudentOverview onNavigate={setActiveTab} />;
      case 'complaints':
        return <StudentComplaints />;
      case 'new':
        return <NewComplaint onSuccess={() => setActiveTab('complaints')} />;
      default:
        return <StudentOverview onNavigate={setActiveTab} />;
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab} tabs={studentTabs}>
      {renderContent()}
    </DashboardLayout>
  );
}
