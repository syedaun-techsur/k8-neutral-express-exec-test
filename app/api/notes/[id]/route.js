// app/api/notes/[id]/route.js
import { getNotesCollection } from '../../../../lib/db.js';
import { ObjectId } from 'mongodb';

function noteToJSON(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...rest };
}

function parseId(rawId) {
  try {
    return new ObjectId(rawId);
  } catch {
    return null;
  }
}

export async function GET(request, { params }) {
  const id = parseId(params.id);
  if (id === null) {
    return Response.json({ error: 'NOTE_NOT_FOUND', message: 'Note not found' }, { status: 404 });
  }
  try {
    const notes = await getNotesCollection();
    const doc = await notes.findOne({ _id: id });
    if (!doc) {
      return Response.json({ error: 'NOTE_NOT_FOUND', message: 'Note not found' }, { status: 404 });
    }
    return Response.json(noteToJSON(doc), { status: 200 });
  } catch (err) {
    console.error('GET /api/notes/[id] error:', err);
    return Response.json({ error: 'INTERNAL_ERROR', message: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const id = parseId(params.id);
  if (id === null) {
    return Response.json({ error: 'NOTE_NOT_FOUND', message: 'Note not found' }, { status: 404 });
  }
  try {
    const notes = await getNotesCollection();
    const existing = await notes.findOne({ _id: id });
    if (!existing) {
      return Response.json({ error: 'NOTE_NOT_FOUND', message: 'Note not found' }, { status: 404 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'BAD_REQUEST', message: 'Invalid request body' }, { status: 400 });
    }
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return Response.json({ error: 'TITLE_REQUIRED', message: 'Title is required' }, { status: 400 });
    }
    const noteBody = typeof body.body === 'string' ? body.body : null;
    const pinned = Boolean(body.pinned ?? false);
    await notes.updateOne({ _id: id }, { $set: { title, body: noteBody, pinned } });
    const updated = await notes.findOne({ _id: id });
    return Response.json(noteToJSON(updated), { status: 200 });
  } catch (err) {
    console.error('PUT /api/notes/[id] error:', err);
    return Response.json({ error: 'INTERNAL_ERROR', message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const id = parseId(params.id);
  if (id === null) {
    return Response.json({ error: 'NOTE_NOT_FOUND', message: 'Note not found' }, { status: 404 });
  }
  try {
    const notes = await getNotesCollection();
    const result = await notes.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      return Response.json({ error: 'NOTE_NOT_FOUND', message: 'Note not found' }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('DELETE /api/notes/[id] error:', err);
    return Response.json({ error: 'INTERNAL_ERROR', message: 'Internal server error' }, { status: 500 });
  }
}
