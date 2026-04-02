const express = require('express');
const axios = require('axios');
const db = require('./db');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.send("OK"));

app.post('/predict', async (req, res) => {
  const text = req.body.text;

  const response = await axios.post('http://ml-service/predict', { text });
  const sentiment = response.data.sentiment;

  db.query(
    'INSERT INTO predictions (input_text, sentiment) VALUES (?, ?)',
    [text, sentiment]
  );

  res.json({ sentiment });
});

app.listen(3000, () => console.log("Backend running"));