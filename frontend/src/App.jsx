import React from 'react';
import AppRoutes from './routes/AppRoutes';
import { DashboardLanguageProvider } from './module/user/LanguageContext';
import { ProfileCompletionProvider } from './module/user/components/ProfileCompletionContext';
import ErrorBoundary from './module/user/components/ErrorBoundary';

import PwaStatusBanner from './shared/PwaStatusBanner';

function App() {
  return (
    <ErrorBoundary>
      <DashboardLanguageProvider>
        <ProfileCompletionProvider>
          <PwaStatusBanner />
          <AppRoutes />
        </ProfileCompletionProvider>
      </DashboardLanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
