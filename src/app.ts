import express from 'express';
import axios from 'axios';
import { Weather } from './models/weather';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import { sequelize } from './models/dbConfig';
import nodemailer from 'nodemailer';

dotenv.config();
const app = express();
app.use(bodyParser.json());

const GEOCODING_API_KEY = process.env.GEOCODING_API_KEY;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT as string, 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});


app.get('/api/test-db-connection', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).send('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    res.status(500).send('Unable to connect to the database');
  }
});


app.post('/api/SaveWeatherMapping', async (req, res) => {
  const cities = req.body;
  const weatherDataList = [];

  for (const cityObj of cities) {
    try {
      const { city, country } = cityObj;
      const geoResponse = await axios.get(`https://api.api-ninjas.com/v1/geocoding?city=${city}&country=${country}`, {
        headers: { 'X-Api-Key': GEOCODING_API_KEY }     
      });
      const { latitude, longitude } = geoResponse.data[0];
      console.log(latitude, longitude);
      const weatherResponse = await axios.get(`https://weatherapi-com.p.rapidapi.com/current.json?q=${latitude},${longitude}`, {
        headers: {
          'X-RapidAPI-Key': WEATHER_API_KEY,
          'X-RapidAPI-Host': 'weatherapi-com.p.rapidapi.com'
        }
      });
      const weather = weatherResponse.data.current.condition.text;
      const time = new Date();

      weatherDataList.push({
        city,
        country,
        weather,
        time,
        longitude,
        latitude
      });
    } catch (error) {
      console.error('Error fetching data for city:', cityObj, error);
      return res.status(500).send('Error fetching weather data');
    }
  }

  try {
    await Weather.bulkCreate(weatherDataList);
    res.status(201).send('Weather data saved successfully');
  } catch (error) {
    console.error('Error saving weather data:', error);
    res.status(500).send('Error saving weather data');
  }
});


app.get('/api/weatherDashboard', async (req, res) => {
  try {
    const { city } = req.query;

    let weatherData;
    if (city) {
      // Fetch all data related to the specified city
      weatherData = await Weather.findAll({ where: { city } });
    } else {
      // Fetch the latest weather conditions for all cities
      weatherData = await sequelize.query(`
        SELECT w1.*
        FROM "Weather" w1
        JOIN (
          SELECT city, MAX(date) AS latest_date
          FROM "Weather"
          GROUP BY city
        ) w2
        ON w1.city = w2.city AND w1.date = w2.latest_date
      `, { model: Weather });


    }

    res.json(weatherData);
  } catch (error) {
    console.error('Error fetching weather data:', error);
    res.status(500).json({ message: 'Error fetching weather data', details: error });
  }
});


app.post('/api/mailWeatherData', async (req, res) => {
  try {
    const { city } = req.body;

    let weatherData;
    if (city) {
      weatherData = await Weather.findAll({ where: { city } });
    } else {
      weatherData = await sequelize.query(`
        SELECT w1.*
        FROM "Weather" w1
        JOIN (
          SELECT city, MAX(date) AS latest_date
          FROM "Weather"
          GROUP BY city
        ) w2
        ON w1.city = w2.city AND w1.date = w2.latest_date
      `, { model: Weather });
    }

    // Create an HTML table with the weather data
    const htmlTable = `
      <table border="1">
        <thead>
          <tr>
            <th>ID</th>
            <th>City</th>
            <th>Country</th>
            <th>Weather</th>
            <th>Longitude</th>
            <th>Latitude</th>
          </tr>
        </thead>
        <tbody>
          ${weatherData.map((data: any) => `
            <tr>
              <td>${data.id}</td>
              <td>${data.city}</td>
              <td>${data.country}</td>
              <td>${data.weather}</td>
              <td>${data.longitude}</td>
              <td>${data.latitude}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const mailOptions = {
      from: SMTP_USER,
      to: req.body.email, // Assume the email is provided in the request body
      subject: 'Weather Data',
      html: htmlTable,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).send('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ message: 'Error sending email', details: error });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
