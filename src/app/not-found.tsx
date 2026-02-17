import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page-header" aria-labelledby="page-title">
      <h1 className="page-title" id="page-title">Page Not Found</h1>
      <section aria-labelledby="not-found-info">
        <h2 className="title-section" id="not-found-info">Information</h2>
        <p className="description">The requested page does not exist.</p>
        <div className="action-links">
          <Link href="/" className="action-btn btn-positive">Back to home</Link>
        </div>
      </section>
    </div>
  );
}
