import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './Home';
import AdminSetPrice from './AdminSetPrice';
import Dashboard from './Dashboard';
import OcppManagement from './OcppManagement';
import Login from './Login';
import { DashboardProvider } from './DashboardContext';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <DashboardProvider>
        <Routes>
          <Route path="/" element={<Home />}>
            <Route path="admin-set-price" element={<AdminSetPrice />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="ocpp-management" element={<OcppManagement />} />
          </Route>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </DashboardProvider>
    </BrowserRouter>
  );
};

export default App;