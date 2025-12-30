export default function LoadingSearchResults() {
  return (
    <div className="page-header" aria-busy="true" aria-live="polite">
      <h1 className="page-title">
        <span className="sr-only">Loading search results</span>
        <span aria-hidden="true" className="blinking-cursor">_</span>
      </h1>
      <p className="temporary-message temporary-message-info" role="status" aria-live="polite">
        <span className="sr-only">Collecting works. Please wait.</span>
        <span aria-hidden="true">Loading...</span>
      </p>
    </div>
  );
}
