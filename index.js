// index.js - Full backend with MongoDB for Joke Drop
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  name: String,
  location: String,
  dob: String,
  profilePicture: String,
  privacy: {
    name: Boolean,
    location: Boolean,
    dob: Boolean
  },
  followers: [String],
  following: [String]
});

const jokeSchema = new mongoose.Schema({
  email: String,
  joke: String,
  status: String,
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Joke = mongoose.model('Joke', jokeSchema);

app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ success: false, error: 'User already exists' });
  const hashed = await bcrypt.hash(password, 10);
  await User.create({
    email, password: hashed,
    name: '', location: '', dob: '', profilePicture: '',
    privacy: { name: true, location: true, dob: false },
    followers: [], following: []
  });
  res.json({ success: true });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
  res.json({ success: true });
});

app.post('/submit', async (req, res) => {
  const { email, joke } = req.body;
  if (!email || !joke) return res.status(400).json({ success: false, error: 'Missing info' });
  await Joke.create({ email, joke, status: 'pending' });
  res.json({ success: true });
});

app.get('/jokes', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ success: false, error: 'Email required' });
  const jokes = await Joke.find({ email, status: { $in: ['pending', 'approved'] } });
  res.json({ success: true, jokes });
});

app.get('/trending', async (req, res) => {
  const trending = await Joke.aggregate([
    { $match: { status: 'approved' } },
    { $sample: { size: 5 } }
  ]);
  res.json({ success: true, jokes: trending });
});

app.get('/profile', async (req, res) => {
  const { email } = req.query;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  const { name, location, dob, profilePicture, privacy, followers, following } = user;
  res.json({ success: true, name, location, dob, profilePicture, privacy, followers, following });
});

app.post('/profile', async (req, res) => {
  const { email, name, location, dob, profilePicture, privacy } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  user.name = name || '';
  user.location = location || '';
  user.dob = dob || '';
  user.profilePicture = profilePicture || '';
  user.privacy = privacy;
  await user.save();
  res.json({ success: true });
});

app.post('/change-password', async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
    return res.status(401).json({ success: false, error: 'Invalid password' });
  }
  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ success: true });
});

app.post('/delete', async (req, res) => {
  const { email } = req.body;
  await User.deleteOne({ email });
  await Joke.deleteMany({ email });
  res.json({ success: true });
});

app.post('/follow', async (req, res) => {
  const { follower, target } = req.body;
  const user = await User.findOne({ email: follower });
  const targetUser = await User.findOne({ email: target });
  if (!user || !targetUser) return res.status(404).json({ success: false, error: 'User not found' });
  if (!user.following.includes(target)) user.following.push(target);
  if (!targetUser.followers.includes(follower)) targetUser.followers.push(follower);
  await user.save();
  await targetUser.save();
  res.json({ success: true });
});

app.get('/users/suggestions', async (req, res) => {
  const { email } = req.query;
  const currentUser = await User.findOne({ email });
  const suggestions = await User.find({
    email: { $ne: email, $nin: currentUser.following }
  }).limit(5);
  res.json({ success: true, users: suggestions });
});

app.get('/moderate', async (req, res) => {
  const { email } = req.query;
  if (email !== 'admin@joke-drop.com') return res.status(403).json({ success: false, error: 'Forbidden' });
  const jokes = await Joke.find({ status: 'pending' });
  res.json({ success: true, jokes });
});

app.post('/moderate', async (req, res) => {
  const { email, jokeId, action } = req.body;
  if (email !== 'admin@joke-drop.com') return res.status(403).json({ success: false, error: 'Forbidden' });
  const joke = await Joke.findById(jokeId);
  if (!joke) return res.status(404).json({ success: false, error: 'Joke not found' });
  joke.status = action === 'approve' ? 'approved' : 'rejected';
  await joke.save();
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
