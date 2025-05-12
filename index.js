// Joke Drop backend with MongoDB, authentication, joke submission, profile updates, and moderation

const express = require('express');
const fs = require('fs');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

app.use(cors());
app.use(express.json());

let db, usersCollection, jokesCollection;

// Connect to MongoDB
MongoClient.connect(MONGO_URI)
  .then(client => {
    db = client.db('jokedrop');
    usersCollection = db.collection('users');
    jokesCollection = db.collection('jokes');
    console.log('✅ Connected to MongoDB');
    app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Register
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  const existing = await usersCollection.findOne({ email });
  if (existing) return res.status(400).json({ success: false, error: 'User already exists' });

  const hashed = await bcrypt.hash(password, 10);
  const user = {
    email,
    password: hashed,
    name: '',
    location: '',
    dob: '',
    profilePicture: '',
    privacy: { name: true, location: true, dob: false },
    followers: [],
    following: []
  };
  await usersCollection.insertOne(user);
  res.json({ success: true });
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await usersCollection.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
  res.json({ success: true });
});

// Submit Joke
app.post('/submit', async (req, res) => {
  const { email, joke } = req.body;
  if (!email || !joke) return res.status(400).json({ success: false, error: 'Email and joke required' });
  await jokesCollection.insertOne({ email, joke, status: 'pending' });
  res.json({ success: true });
});

// Get user's jokes
app.get('/jokes', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ success: false, error: 'Email required' });
  const jokes = await jokesCollection.find({ email, status: { $in: ['pending', 'approved'] } }).toArray();
  res.json({ success: true, jokes });
});

// Get profile
app.get('/profile', async (req, res) => {
  const { email } = req.query;
  const user = await usersCollection.findOne({ email });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  const { name, location, dob, profilePicture, privacy, followers, following } = user;
  res.json({ success: true, name, location, dob, profilePicture, privacy, followers, following });
});

// Update profile
app.post('/profile', async (req, res) => {
  const { email, name, location, dob, profilePicture, privacy } = req.body;
  await usersCollection.updateOne({ email }, {
    $set: {
      name: name || '',
      location: location || '',
      dob: dob || '',
      profilePicture: profilePicture || '',
      privacy: {
        name: privacy?.name ?? true,
        location: privacy?.location ?? true,
        dob: privacy?.dob ?? false
      }
    }
  });
  res.json({ success: true });
});

// Change password
app.post('/change-password', async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  const user = await usersCollection.findOne({ email });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  if (!(await bcrypt.compare(currentPassword, user.password))) {
    return res.status(401).json({ success: false, error: 'Incorrect current password' });
  }
  const hashed = await bcrypt.hash(newPassword, 10);
  await usersCollection.updateOne({ email }, { $set: { password: hashed } });
  res.json({ success: true });
});

// Suggested users (not already followed)
app.get('/users/suggestions', async (req, res) => {
  const { email } = req.query;
  const currentUser = await usersCollection.findOne({ email });
  if (!currentUser) return res.status(404).json({ success: false });
  const users = await usersCollection.find({
    email: { $ne: email, $nin: currentUser.following }
  }).limit(5).toArray();
  res.json({ success: true, users });
});

// Follow another user
app.post('/follow', async (req, res) => {
  const { follower, target } = req.body;
  await usersCollection.updateOne({ email: follower }, { $addToSet: { following: target } });
  await usersCollection.updateOne({ email: target }, { $addToSet: { followers: follower } });
  res.json({ success: true });
});

// Get trending jokes (random 5 approved)
app.get('/trending', async (req, res) => {
  const jokes = await jokesCollection.aggregate([
    { $match: { status: 'approved' } },
    { $sample: { size: 5 } }
  ]).toArray();
  const results = await Promise.all(jokes.map(async (j) => {
    const user = await usersCollection.findOne({ email: j.email });
    return {
      joke: j.joke,
      name: user?.name || user?.email || 'Anonymous'
    };
  }));
  res.json({ success: true, jokes: results });
});

// Moderator: Get pending jokes
app.get('/moderate', async (req, res) => {
  const { email } = req.query;
  if (email !== 'admin@joke-drop.com') return res.status(403).json({ success: false });
  const jokes = await jokesCollection.find({ status: 'pending' }).toArray();
  const results = jokes.map(j => ({
    id: j._id,
    email: j.email,
    joke: j.joke
  }));
  res.json({ success: true, jokes: results });
});

// Moderator: Approve joke
app.post('/moderate/approve', async (req, res) => {
  const { email, id } = req.body;
  if (email !== 'admin@joke-drop.com') return res.status(403).json({ success: false });
  await jokesCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status: 'approved' } });
  res.json({ success: true });
});

// Moderator: Delete joke
app.post('/moderate/delete', async (req, res) => {
  const { email, id } = req.body;
  if (email !== 'admin@joke-drop.com') return res.status(403).json({ success: false });
  await jokesCollection.deleteOne({ _id: new ObjectId(id) });
  res.json({ success: true });
});