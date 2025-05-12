// index.js — complete backend with MongoDB, user auth, profile editing, moderation, jokes

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// Schemas
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  name: String,
  location: String,
  dob: String,
  profilePicture: String,
  followers: [String],
  following: [String],
  privacy: {
    name: Boolean,
    location: Boolean,
    dob: Boolean
  }
});
const jokeSchema = new mongoose.Schema({
  email: String,
  joke: String,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Joke = mongoose.model('Joke', jokeSchema);

// Preload admin user for testing
(async () => {
  const exists = await User.findOne({ email: 'admin@joke-drop.com' });
  if (!exists) {
    await User.create({
      email: 'admin@joke-drop.com',
      password: 'connorrees',
      name: 'Admin',
      location: '',
      dob: '',
      profilePicture: '',
      followers: [],
      following: [],
      privacy: { name: true, location: true, dob: false }
    });
    console.log('Test admin user created.');
  }
})();

// Register
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, error: 'Missing fields' });
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ success: false, error: 'User exists' });

  await User.create({ email, password, name: '', location: '', dob: '', followers: [], following: [], privacy: { name: true, location: true, dob: false } });
  res.json({ success: true });
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || user.password !== password) return res.status(401).json({ success: false, error: 'Invalid credentials' });
  res.json({ success: true });
});

// Submit a joke
app.post('/submit', async (req, res) => {
  const { email, joke } = req.body;
  if (!email || !joke) return res.status(400).json({ success: false, error: 'Missing data' });
  await Joke.create({ email, joke });
  res.json({ success: true });
});

// Get jokes for user (pending + approved)
app.get('/jokes', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ success: false, error: 'Missing email' });
  const jokes = await Joke.find({ email, status: { $in: ['pending', 'approved'] } }).sort({ createdAt: -1 });
  res.json({ success: true, jokes });
});

// Profile GET
app.get('/profile', async (req, res) => {
  const { email } = req.query;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  const { name, location, dob, profilePicture, privacy, followers, following } = user;
  res.json({ success: true, name, location, dob, profilePicture, privacy, followers, following });
});

// Profile POST
app.post('/profile', async (req, res) => {
  const { email, name, location, dob, profilePicture, privacy } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  user.name = name || '';
  user.location = location || '';
  user.dob = dob || '';
  user.profilePicture = profilePicture || '';
  user.privacy = { name: !!privacy?.name, location: !!privacy?.location, dob: !!privacy?.dob };
  await user.save();
  res.json({ success: true });
});

// Change password
app.post('/change-password', async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  const user = await User.findOne({ email });
  if (!user || user.password !== currentPassword) return res.status(401).json({ success: false, error: 'Wrong password' });
  user.password = newPassword;
  await user.save();
  res.json({ success: true });
});

// Moderator GET: fetch pending jokes
app.get('/moderate', async (req, res) => {
  try {
    const jokes = await Joke.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.json({ success: true, jokes });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch jokes' });
  }
});

// Moderator POST: approve/reject jokes
app.post('/moderate', async (req, res) => {
  const { id, action } = req.body;
  if (!id || !['approved', 'rejected'].includes(action)) return res.status(400).json({ success: false, error: 'Invalid data' });
  try {
    await Joke.findByIdAndUpdate(id, { status: action });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Update failed' });
  }
});

// Suggested users
app.get('/users/suggestions', async (req, res) => {
  const { email } = req.query;
  const user = await User.findOne({ email });
  if (!user) return res.json({ success: false, users: [] });
  const users = await User.find({ email: { $ne: email }, email: { $nin: user.following } });
  res.json({ success: true, users });
});

// Follow a user
app.post('/follow', async (req, res) => {
  const { follower, target } = req.body;
  if (!follower || !target) return res.status(400).json({ success: false, error: 'Missing info' });

  const userA = await User.findOne({ email: follower });
  const userB = await User.findOne({ email: target });
  if (!userA || !userB) return res.status(404).json({ success: false, error: 'User not found' });

  if (!userA.following.includes(target)) userA.following.push(target);
  if (!userB.followers.includes(follower)) userB.followers.push(follower);

  await userA.save();
  await userB.save();
  res.json({ success: true });
});

// Trending jokes
app.get('/trending', async (req, res) => {
  const jokes = await Joke.find({ status: 'approved' }).sort({ createdAt: -1 }).limit(10);
  const enriched = await Promise.all(jokes.map(async j => {
    const user = await User.findOne({ email: j.email });
    return {
      name: user?.privacy?.name ? user.name : user.email,
      joke: j.joke
    };
  }));
  res.json({ success: true, jokes: enriched });
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));