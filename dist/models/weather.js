"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Weather = void 0;
const sequelize_1 = require("sequelize");
const dbConfig_1 = require("./dbConfig");
class Weather extends sequelize_1.Model {
}
exports.Weather = Weather;
Weather.init({
    city: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    country: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    weather: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    time: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
    },
    longitude: {
        type: sequelize_1.DataTypes.FLOAT,
        allowNull: false,
    },
    latitude: {
        type: sequelize_1.DataTypes.FLOAT,
        allowNull: false,
    },
}, {
    sequelize: dbConfig_1.sequelize,
    modelName: 'Weather',
});
//# sourceMappingURL=weather.js.map