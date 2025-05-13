const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// MongoDB connection string (replace with your MongoDB URI)
const mongoURI = 'ongodb+srv://jokedrop:connorrees@jokedrop-cluster.4zcbnju.mongodb.net/?retryWrites=true&w=majority&appName=jokedrop-cluster';

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("MongoDB connection error:", err));

// User schema
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  name: { type: String, default: "" },
});

const User = mongoose.model('User', userSchema);

// Joke Schema
const jokeSchema = new mongoose.Schema({
  email: { type: String, required: true },
  joke: { type: String, required: true },
  status: { type: String, default: 'pending' },
});

const Joke = mongoose.model('Joke', jokeSchema);

// Register Route
app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) return res.status(400).json({ error: 'User already exists' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({ email, password: hashedPassword, name: "" });

  await newUser.save();
  res.json({ success: true });
});

// Login Route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({ success: true });
});

// Submit Joke Route
app.post('/submit', async (req, res) => {
  const { email, joke } = req.body;
  if (!email || !joke) return res.status(400).json({ error: 'Email and joke are required' });

  const newJoke = new Joke({ email, joke, status: 'pending' });
  await newJoke.save();
  res.json({ success: true });
});

// Get Jokes (for dashboard)
app.get('/jokes', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const jokes = await Joke.find({ email: email });
  res.json({ success: true, jokes });
});

// Serve the app
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
