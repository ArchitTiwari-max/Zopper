import { Suspense } from 'react';
import ExecutiveForm from '../routes/ExecutiveForm/ExecutiveForm';

function ExecutiveFormFallback() {
  return (
    <div className="loading-container" style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontSize: '18px'
    }}>
      Loading form...
    </div>
  );
}

export default function ExecutiveFormPage() {
  return (
    <Suspense fallback={<ExecutiveFormFallback />}>
      <ExecutiveForm />
    </Suspense>
  );
}
