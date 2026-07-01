// app/notes/[id]/edit/page.js
import { getNotesCollection } from '../../../../lib/db.js';
import { ObjectId } from 'mongodb';
import EditNoteClient from './EditNoteClient.js';

export default async function EditNotePage({ params }) {
  const { id: rawId } = await params;

  let objectId;
  try {
    objectId = new ObjectId(rawId);
  } catch {
    objectId = null;
  }

  let note = null;
  let fetchError = false;

  if (objectId) {
    try {
      const notesCol = await getNotesCollection();
      const doc = await notesCol.findOne({ _id: objectId });
      if (doc) {
        const { _id, ...rest } = doc;
        note = { id: _id.toString(), ...rest };
      }
    } catch (err) {
      console.error('EditNotePage DB error:', err);
      fetchError = true;
    }
  }

  if (!objectId || (!fetchError && note === null)) {
    return (
      <>
        <title>Note not found — QuickNotes</title>
        <header>
          <nav className="navbar">
            <a href="/" className="navBack">← Home</a>
          </nav>
        </header>
        <main>
          <div className="container" style={{ paddingTop: '48px' }}>
            <h1 style={{ fontSize: '1.25rem', marginBottom: '12px' }}>Note not found.</h1>
            <p style={{ color: 'var(--color-muted)', marginBottom: '24px' }}>
              This note may have been deleted.
            </p>
            <a href="/" className="navBack">← Back to all notes</a>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <title>Edit note — QuickNotes</title>
      <EditNoteClient note={note} />
    </>
  );
}
