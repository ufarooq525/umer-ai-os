'use client';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h2>Something went wrong</h2>
      <p style={{ color: '#ef4444', marginTop: '12px' }}>{error.message}</p>
      <button
        onClick={() => reset()}
        style={{
          marginTop: '16px',
          padding: '8px 16px',
          background: '#d97706',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}
