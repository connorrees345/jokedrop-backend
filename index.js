const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = "mongodb+srv://jokedrop:<CandleWax1!>@<jokedrop-cluster>.mongodb.net/?retryWrites=true&w=majority"; // replace <your-password> and <your-cluster>
const client = new MongoClient(uri);
let db, users, jokes;

async function connectDB() {
  try {
    await client.connect();
    db = client.db("jokedrop");
    users = db.collection("users");
    jokes = db.collection("jokes");
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}

// Register
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  const existing = await users.findOne({ email });
  if (existing) return res.status(400).json({ success: false, error: 'User already exists' });

  const hashed = await bcrypt.hash(password, 10);
  await users.insertOne({
    email,
    password: hashed,
    name: "",
    location: "",
    dob: "",
    profilePicture: "",
    privacy: { name: true, location: true, dob: false },
    followers: [],
    following: []
  });
  res.json({ success: true });
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await users.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
  res.json({ success: true });
});

// Submit joke
app.post('/submit', async (req, res) => {
  const { email, joke } = req.body;
  if (!email || !joke) return res.status(400).json({ success: false, error: 'Email and joke are required' });
  await jokes.insertOne({ email, joke, status: 'pending' });
  res.json({ success: true });
});

// Get jokes
app.get('/jokes', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ success: false, error: 'Email required' });
  const userJokes = await jokes.find({ email, status: { $in: ['pending', 'approved'] } }).toArray();
  res.json({ success: true, jokes: userJokes });
});

// Trending jokes
app.get('/trending', async (req, res) => {
  const recent = await jokes.find({ status: 'approved' }).sort({ _id: -1 }).limit(10).toArray();
  const allUsers = await users.find({}).toArray();
  const trending = recent.map(joke => {
    const u = allUsers.find(user => user.email === joke.email);
    return {
      joke: joke.joke,
      name: u?.privacy?.name && u?.name ? u.name : u?.email || 'Unknown'
    };
  });
  res.json({ success: true, jokes: trending });
});

// Get profile
app.get('/profile', async (req, res) => {
  const email = req.query.email;
  const user = await users.findOne({ email });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  const { name, location, dob, profilePicture, privacy, followers, following } = user;
  res.json({ success: true, name, location, dob, profilePicture, privacy, followers, following });
});

// Update profile
app.post('/profile/update', async (req, res) => {
  const { email, name, location, dob, profilePicture, privacy } = req.body;
  const update = {
    $set: {
      name: name || "",
      location: location || "",
      dob: dob || "",
      profilePicture: profilePicture || "",
      privacy: {
        name: privacy?.name ?? true,
        location: privacy?.location ?? true,
        dob: privacy?.dob ?? false
      }
    }
  };
  const result = await users.updateOne({ email }, update);
  res.json({ success: result.modifiedCount > 0 });
});

// Change password
app.post('/change-password', async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  const user = await users.findOne({ email });
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) return res.status(401).json({ success: false, error: 'Incorrect password' });
  const hashed = await bcrypt.hash(newPassword, 10);
  await users.updateOne({ email }, { $set: { password: hashed } });
  res.json({ success: true });
});

// Follow user
app.post('/follow', async (req, res) => {
  const { follower, target } = req.body;
  if (!follower || !target || follower === target) return res.status(400).json({ success: false });
  const from = await users.findOne({ email: follower });
  const to = await users.findOne({ email: target });
  if (!from || !to) return res.status(404).json({ success: false });
  await users.updateOne({ email: follower }, { $addToSet: { following: target } });
  await users.updateOne({ email: target }, { $addToSet: { followers: follower } });
  res.json({ success: true });
});

// Suggestions
app.get('/users/suggestions', async (req, res) => {
  const email = req.query.email;
  const me = await users.findOne({ email });
  if (!me) return res.status(404).json({ success: false });
  const suggestions = await users.find({
    email: { $ne: email, $nin: me.following || [] }
  }).toArray();
  const usersList = suggestions.map(u => ({
    email: u.email,
    name: u.privacy?.name && u.name ? u.name : ""
  }));
  res.json({ success: true, users: usersList });
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
});
