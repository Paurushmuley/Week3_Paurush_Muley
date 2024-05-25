"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const weather_1 = require("./models/weather");
const dotenv_1 = __importDefault(require("dotenv"));
const body_parser_1 = __importDefault(require("body-parser"));
const dbConfig_1 = require("./models/dbConfig");
const nodemailer_1 = __importDefault(require("nodemailer"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
const GEOCODING_API_KEY = process.env.GEOCODING_API_KEY;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT, 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const transporter = nodemailer_1.default.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
});
app.get('/api/test-db-connection', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield dbConfig_1.sequelize.authenticate();
        res.status(200).send('Database connection has been established successfully.');
    }
    catch (error) {
        console.error('Unable to connect to the database:', error);
        res.status(500).send('Unable to connect to the database');
    }
}));
app.post('/api/SaveWeatherMapping', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const cities = req.body;
    const weatherDataList = [];
    for (const cityObj of cities) {
        try {
            const { city, country } = cityObj;
            const geoResponse = yield axios_1.default.get(`https://api.api-ninjas.com/v1/geocoding?city=${city}&country=${country}`, {
                headers: { 'X-Api-Key': GEOCODING_API_KEY }
            });
            const { latitude, longitude } = geoResponse.data[0];
            console.log(latitude, longitude);
            const weatherResponse = yield axios_1.default.get(`https://weatherapi-com.p.rapidapi.com/current.json?q=${latitude},${longitude}`, {
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
        }
        catch (error) {
            console.error('Error fetching data for city:', cityObj, error);
            return res.status(500).send('Error fetching weather data');
        }
    }
    try {
        yield weather_1.Weather.bulkCreate(weatherDataList);
        res.status(201).send('Weather data saved successfully');
    }
    catch (error) {
        console.error('Error saving weather data:', error);
        res.status(500).send('Error saving weather data');
    }
}));
app.get('/api/weatherDashboard', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { city } = req.query;
        let weatherData;
        if (city) {
            // Fetch all data related to the specified city
            weatherData = yield weather_1.Weather.findAll({ where: { city } });
        }
        else {
            // Fetch the latest weather conditions for all cities
            weatherData = yield dbConfig_1.sequelize.query(`
        SELECT w1.*
        FROM "Weather" w1
        JOIN (
          SELECT city, MAX(date) AS latest_date
          FROM "Weather"
          GROUP BY city
        ) w2
        ON w1.city = w2.city AND w1.date = w2.latest_date
      `, { model: weather_1.Weather });
        }
        res.json(weatherData);
    }
    catch (error) {
        console.error('Error fetching weather data:', error);
        res.status(500).json({ message: 'Error fetching weather data', details: error });
    }
}));
app.post('/api/mailWeatherData', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { city } = req.body;
        let weatherData;
        if (city) {
            weatherData = yield weather_1.Weather.findAll({ where: { city } });
        }
        else {
            weatherData = yield dbConfig_1.sequelize.query(`
        SELECT w1.*
        FROM "Weather" w1
        JOIN (
          SELECT city, MAX(date) AS latest_date
          FROM "Weather"
          GROUP BY city
        ) w2
        ON w1.city = w2.city AND w1.date = w2.latest_date
      `, { model: weather_1.Weather });
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
          ${weatherData.map((data) => `
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
        yield transporter.sendMail(mailOptions);
        res.status(200).send('Email sent successfully');
    }
    catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ message: 'Error sending email', details: error });
    }
}));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
//# sourceMappingURL=app.js.map