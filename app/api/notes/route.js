// app/api/notes/route.js
import { getNotesCollection } from '../../../lib/db.js';
import { ObjectId } from 'mongodb';

function noteToJSON(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...rest };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const notes = await getNotesCollection();
    let cursor;
    if (q && q.trim().length > 0) {
      cursor = notes.find(
        { title: { $regex: q.trim(), $options: 'i' } },
        { sort: { pinned: -1, createdAt: -1 } }
      );
    } else {
      cursor = notes.find({}, { sort: { pinned: -1, createdAt: -1 } });
    }
    const docs = await cursor.toArray();
    return Response.json(docs.map(noteToJSON), { status: 200 });
  } catch (err) {
    console.error('GET /api/notes error:', err);
    return Response.json({ error: 'INTERNAL_ERROR', message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
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
    const now = new Date();
    const notes = await getNotesCollection();
    const result = await notes.insertOne({ title, body: noteBody, pinned, createdAt: now });
    const created = await notes.findOne({ _id: result.insertedId });
    return Response.json(noteToJSON(created), { status: 201 });
  } catch (err) {
    console.error('POST /api/notes error:', err);
    return Response.json({ error: 'INTERNAL_ERROR', message: 'Internal server error' }, { status: 500 });
  }
}
