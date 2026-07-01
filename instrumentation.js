// instrumentation.js
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { MongoClient } = await import('mongodb');
    
    const uri = process.env.MONGO_URL;
    if (!uri) {
      console.error('MONGO_URL environment variable is not set');
      process.exit(1);
    }
    
    const client = new MongoClient(uri);
    try {
      await client.connect();
      const db = client.db('quicknotes');
      
      // Ensure the notes collection exists with indexes
      const collections = await db.listCollections({ name: 'notes' }).toArray();
      if (collections.length === 0) {
        await db.createCollection('notes');
      }
      
      const notes = db.collection('notes');
      
      // Create indexes idempotently (createIndex is a no-op if index exists)
      await notes.createIndex({ pinned: -1, createdAt: -1 });
      await notes.createIndex({ title: 'text' });
      
      console.log('Migration: notes collection ready');
    } catch (err) {
      console.error('Migration failed:', err);
      process.exit(1);
    } finally {
      await client.close();
    }
  }
}
