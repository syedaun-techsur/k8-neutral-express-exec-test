// lib/db.js
import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URL;
if (!uri) {
  console.error('MONGO_URL environment variable is not set');
  process.exit(1);
}

let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  // In development, use a global variable to preserve across HMR reloads
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

export async function getDb() {
  const c = await clientPromise;
  return c.db('quicknotes');
}

export async function getNotesCollection() {
  const db = await getDb();
  return db.collection('notes');
}
