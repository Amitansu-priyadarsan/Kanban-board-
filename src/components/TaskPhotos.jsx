import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, ExternalLink, Trash2 } from "lucide-react";
import * as api from "../api";
import { displayDate } from "../model";
import { PHOTO_ACCEPT, PHOTO_HINT } from "../photos";

function PhotoCard({ photo, onDelete, busy }) {
  const [image, setImage] = useState({ loading: true });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    api
      .getPhotoUrl(photo.path)
      .then((url) => {
        if (active) setImage({ url });
      })
      .catch((error) => {
        if (active) setImage({ error: error.message });
      });
    return () => {
      active = false;
    };
  }, [photo.path, retry]);
  return (
    <article className="issue-photo">
      {image.url ? (
        <a
          className="photo-preview"
          href={image.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${photo.file_name}`}
        >
          <img
            src={image.url}
            alt={photo.file_name}
            loading="lazy"
            onError={() =>
              setImage({ error: "This photo could not be loaded." })
            }
          />
          <span>
            <ExternalLink size={13} aria-hidden="true" />
            View full photo
          </span>
        </a>
      ) : (
        <div className="photo-placeholder">
          {image.error ? (
            <>
              <p>{image.error}</p>
              <button
                className="btn"
                onClick={() => {
                  setImage({ loading: true });
                  setRetry((value) => value + 1);
                }}
              >
                Reload photo
              </button>
            </>
          ) : (
            "Loading photo…"
          )}
        </div>
      )}
      <div className="photo-caption">
        <strong>{photo.file_name}</strong>
        <time dateTime={photo.created_at}>
          {displayDate(photo.created_at)} IST
        </time>
        <button
          type="button"
          className="btn danger"
          disabled={busy}
          onClick={() => onDelete(photo)}
          aria-label={`Delete photo ${photo.file_name}`}
        >
          <Trash2 size={13} aria-hidden="true" />
          Delete
        </button>
      </div>
    </article>
  );
}

export default function TaskPhotos({ taskId, parentBusy, inform }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cleanup, setCleanup] = useState([]);
  const current = useRef(0);
  const mutation = useRef(false);
  const load = useCallback(async () => {
    const request = ++current.current;
    setLoading(true);
    try {
      const result = await api.getTaskPhotos(taskId);
      if (current.current !== request) return;
      setPhotos(result);
      setError("");
    } catch (err) {
      if (current.current === request) setError(err.message);
    } finally {
      if (current.current === request) setLoading(false);
    }
  }, [taskId]);
  const invalidate = useCallback(() => {
    current.current++;
  }, []);
  useEffect(() => {
    load();
    return invalidate;
  }, [load, invalidate]);
  const run = async (action) => {
    if (mutation.current || parentBusy) return;
    mutation.current = true;
    setBusy(true);
    try {
      await action();
    } catch (err) {
      inform(err.message, true);
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  };
  const upload = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const files = Array.from(
      form.elements.namedItem("photos")?.files || [],
    ).filter((file) => file.size);
    run(async () => {
      const result = await api.uploadTaskPhotos(taskId, files);
      form.reset();
      inform(
        result.error
          ? `${result.uploaded} photos uploaded. Remaining photos stopped: ${result.error}. Select the remaining photos to retry.`
          : `${result.uploaded} ${result.uploaded === 1 ? "photo" : "photos"} uploaded.`,
        Boolean(result.error),
      );
      await load();
    });
  };
  const remove = (photo) => {
    if (
      !window.confirm(
        `Delete photo “${photo.file_name}”? This cannot be undone.`,
      )
    )
      return;
    run(async () => {
      const result = await api.deleteTaskPhoto(photo);
      invalidate();
      setLoading(false);
      setPhotos((items) => items.filter((item) => item.id !== photo.id));
      if (result.cleanupError) {
        setCleanup((items) => [...items, photo]);
        inform(
          `Photo removed, but file cleanup failed: ${result.cleanupError}`,
          true,
        );
      } else inform("Photo deleted.");
    });
  };
  return (
    <section className="panel task-photos" aria-label="Issue photos">
      <div className="section-title">
        <h2>
          <ImagePlus size={18} aria-hidden="true" />
          Photos <span>{photos.length}</span>
        </h2>
        <button
          className="btn"
          type="button"
          disabled={busy || parentBusy || loading}
          onClick={load}
        >
          Refresh photos
        </button>
      </div>
      <form className="photo-upload" onSubmit={upload}>
        <label>
          Add photos
          <input
            className="field"
            name="photos"
            type="file"
            accept={PHOTO_ACCEPT}
            multiple
            required
            disabled={busy || parentBusy}
          />
        </label>
        <p className="hint">{PHOTO_HINT}</p>
        <button className="btn" disabled={busy || parentBusy}>
          {busy ? "Working…" : "Upload photos"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p className="hint">Loading photos…</p>
      ) : photos.length ? (
        <div className="photo-grid">
          {photos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              onDelete={remove}
              busy={busy || parentBusy}
            />
          ))}
        </div>
      ) : (
        !error && (
          <p className="photo-empty">
            Add screenshots or photos to explain this issue.
          </p>
        )
      )}
      {cleanup.map((photo) => (
        <div className="photo-cleanup" key={photo.id}>
          <span>File cleanup needed: {photo.file_name}</span>
          <button
            className="btn"
            disabled={busy || parentBusy}
            onClick={() =>
              run(async () => {
                await api.cleanupPhotoFile(photo.path);
                setCleanup((items) =>
                  items.filter((item) => item.id !== photo.id),
                );
                inform("Photo file deleted.");
              })
            }
          >
            Retry file cleanup
          </button>
        </div>
      ))}
    </section>
  );
}
