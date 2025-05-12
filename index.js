const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect(mongodb+srv://jokedrop:connorrees@jokedrop-cluster.4zcbnju.mongodb.net/?retryWrites=true&w=majority&appName=jokedrop-cluster , {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const Joke = require('./models/Joke');

app.use(cors());
app.use(express.json());

const users = []; // Temporary in-memory user store (you can switch to MongoDB later)

// Register
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ success: false, error: 'User already exists' });
  }

  const hashed = await bcrypt.hash(password, 10);
  users.push({
    email,
    password: hashed,
    name: "",
    location: "",
    dob: "",
    profilePicture: "",
    privacy: { name: true, location: true, dob: false }
  });

  res.json({ success: true });
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  res.json({ success: true });
});

// Submit joke to MongoDB
app.post('/submit', async (req, res) => {
  const { email, joke } = req.body;
  if (!email || !joke) {
    return res.status(400).json({ success: false, error: 'Email and joke are required' });
  }

  try {
    const newJoke = new Joke({ email, joke, status: 'pending' });
    await newJoke.save();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to save joke' });
  }
});

// Get user's jokes (approved or pending)
app.get('/jokes', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ success: false, error: 'Email required' });

  try {
    const jokes = await Joke.find({ email, status: { $in: ['approved', 'pending'] } });
    res.json({ success: true, jokes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch jokes' });
  }
});

// Get pending jokes for moderation
app.get('/moderation', async (req, res) => {
  try {
    const jokes = await Joke.find({ status: 'pending' });
    res.json({ success: true, jokes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch jokes' });
  }
});

// Approve or reject a joke
app.post('/moderate', async (req, res) => {
  const { id, action } = req.body;
  if (!id || !['approved', 'rejected'].includes(action)) {
    return res.status(400).json({ success: false, error: 'Invalid data' });
  }

  try {
    await Joke.findByIdAndUpdate(id, { status: action });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update joke' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Joke Drop backend running on port ${PORT}`);
});
