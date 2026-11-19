import { lazy, Suspense, useEffect, useState } from "react";
import { downloadDocument } from "../api";
import { BUILTIN_DOC } from "../model";

const ReactMarkdown = lazy(() => import("react-markdown"));

export function Documents({ docs, onUpload, onDelete, busy }) {
  return (
    <>
      <header className="heading">
        <h1>Docs</h1>
        <button className="btn primary" onClick={onUpload}>
          + Upload document
        </button>
      </header>
      <div className="doc-list">
        {[BUILTIN_DOC, ...docs].map((doc) => (
          <article key={doc.id} className="panel doc-card">
            <a
              className="doc-card-link"
              href={`#doc/${encodeURIComponent(doc.id)}`}
            >
              <span className="tags">
                <span className="tag scope">{doc.kind.toUpperCase()}</span>
              </span>
              <h2>{doc.title}</h2>
              <span className="hint">{doc.file_name}</span>
            </a>
            {doc.builtin ? (
              <span className="hint">Included document</span>
            ) : (
              <button
                className="btn danger"
                disabled={busy}
                onClick={() => onDelete(doc)}
                aria-label={`Delete ${doc.title}`}
              >
                Delete
              </button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

function UploadedDocument({ doc }) {
  const [content, setContent] = useState({ loading: true });
  useEffect(() => {
    let active = true;
    let objectUrl;
    async function load() {
      try {
        const file = await downloadDocument(doc.path);
        if (!active) return;
        if (doc.kind === "pdf") {
          objectUrl = URL.createObjectURL(
            new Blob([file], { type: "application/pdf" }),
          );
          setContent({ url: objectUrl });
        } else {
          const text = await file.text();
          if (active) setContent({ text });
        }
      } catch (error) {
        if (active) setContent({ error: error.message });
      }
    }
    load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.path, doc.kind]);
  if (content.loading)
    return (
      <div id="file-view" className="panel">
        Loading document…
      </div>
    );
  if (content.error)
    return (
      <div id="file-view" className="panel" role="alert">
        {content.error}
      </div>
    );
  if (doc.kind === "md")
    return (
      <div id="file-view" className="panel">
        <div className="markdown">
          <Suspense fallback={<p>Loading document…</p>}>
            <ReactMarkdown>{content.text}</ReactMarkdown>
          </Suspense>
        </div>
      </div>
    );
  if (doc.kind === "html")
    return (
      <iframe
        className="viewer"
        title={doc.title}
        sandbox=""
        srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">${content.text}`}
      />
    );
  return <iframe className="viewer" title={doc.title} src={content.url} />;
}

export function DocumentViewer({ doc, onDelete, busy }) {
  return (
    <>
      <header className="doc-toolbar">
        <a href="#docs" className="btn">
          Back to Docs
        </a>
        {!doc.builtin && (
          <button
            className="btn danger"
            disabled={busy}
            onClick={() => onDelete(doc)}
            aria-label={`Delete ${doc.title}`}
          >
            Delete document
          </button>
        )}
      </header>
      {doc.builtin ? (
        <iframe
          className="viewer"
          title={doc.title}
          src={`${import.meta.env.BASE_URL}release-handoff.html`}
          sandbox="allow-scripts allow-popups"
        />
      ) : (
        <UploadedDocument key={doc.id} doc={doc} />
      )}
    </>
  );
}
