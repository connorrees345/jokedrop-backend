const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://<username>:<password>@<cluster>.mongodb.net/jokedrop?retryWrites=true&w=majority')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

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
  following: [String],
  role: { type: String, default: 'user' }
});

const jokeSchema = new mongoose.Schema({
  email: String,
  name: String,
  joke: String,
  status: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Joke = mongoose.model('Joke', jokeSchema);

app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ success: false, error: 'User already exists' });

  const hashed = await bcrypt.hash(password, 10);
  const user = new User({
    email,
    password: hashed,
    name: '',
    location: '',
    dob: '',
    profilePicture: '',
    privacy: { name: true, location: true, dob: false },
    followers: [],
    following: [],
    role: email === 'admin@joke-drop.com' ? 'moderator' : 'user'
  });

  await user.save();
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

app.get('/profile', async (req, res) => {
  const email = req.query.email;
  console.log('Fetching profile for:', email);
  if (!email) return res.status(400).json({ success: false, error: 'Email required' });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  const { name, location, dob, profilePicture, privacy, followers, following, role } = user;
  res.json({ success: true, name, location, dob, profilePicture, privacy, followers, following, role });
});

app.post('/profile', async (req, res) => {
  const { email, name, location, dob, profilePicture, privacy } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  user.name = name || '';
  user.location = location || '';
  user.dob = dob || '';
  user.profilePicture = profilePicture || '';
  user.privacy = {
    name: privacy?.name ?? true,
    location: privacy?.location ?? true,
    dob: privacy?.dob ?? false
  };

  await user.save();
  res.json({ success: true });
});

app.post('/submit', async (req, res) => {
  const { email, name, joke } = req.body;
  if (!email || !joke) return res.status(400).json({ success: false, error: 'Email and joke required' });

  const newJoke = new Joke({ email, name, joke, status: 'pending' });
  await newJoke.save();
  res.json({ success: true });
});

app.get('/jokes', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ success: false, error: 'Email required' });

  const jokes = await Joke.find({ email, status: { $in: ['approved', 'pending'] } });
  res.json({ success: true, jokes });
});

app.get('/trending', async (req, res) => {
  const jokes = await Joke.find({ status: 'approved' }).sort({ createdAt: -1 }).limit(10);
  res.json({ success: true, jokes });
});

app.post('/follow', async (req, res) => {
  const { follower, target } = req.body;
  const followerUser = await User.findOne({ email: follower });
  const targetUser = await User.findOne({ email: target });

  if (!followerUser || !targetUser) return res.status(404).json({ success: false, error: 'User not found' });

  if (!followerUser.following.includes(target)) followerUser.following.push(target);
  if (!targetUser.followers.includes(follower)) targetUser.followers.push(follower);

  await followerUser.save();
  await targetUser.save();
  res.json({ success: true });
});

app.get('/users/suggestions', async (req, res) => {
  const email = req.query.email;
  const all = await User.find({ email: { $ne: email } }).limit(5);
  res.json({ success: true, users: all });
});

app.get('/pending-jokes', async (req, res) => {
  const email = req.query.email;
  const user = await User.findOne({ email });
  if (!user || user.role !== 'moderator') {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  const jokes = await Joke.find({ status: 'pending' });
  res.json({ success: true, jokes });
});

app.post('/approve-joke', async (req, res) => {
  const { email, id } = req.body;
  const user = await User.findOne({ email });
  if (!user || user.role !== 'moderator') {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  await Joke.findByIdAndUpdate(id, { status: 'approved' });
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`✅ Joke Drop backend running on port ${PORT}`));