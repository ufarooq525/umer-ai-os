import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h2>404 - Page Not Found</h2>
      <p style={{ color: '#888', marginTop: '12px' }}>The requested resource could not be found.</p>
      <Link href="/" style={{ color: '#d97706', display: 'inline-block', marginTop: '16px' }}>
        Return to Mission Control
      </Link>
    </div>
  );
}
