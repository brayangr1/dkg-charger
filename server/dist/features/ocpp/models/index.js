"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeterValue = exports.Transaction = exports.ChargePoint = void 0;
const sequelize_1 = require("sequelize");
const sequelize_config_1 = require("../../../config/sequelize.config");
const ocpp_types_1 = require("../types/ocpp.types");
class ChargePoint extends sequelize_1.Model {
}
exports.ChargePoint = ChargePoint;
ChargePoint.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    chargePointId: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    vendor: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    model: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    serialNumber: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    firmwareVersion: {
        type: sequelize_1.DataTypes.STRING,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM(...Object.values(ocpp_types_1.ChargePointStatus)),
        allowNull: false,
        defaultValue: ocpp_types_1.ChargePointStatus.Available,
    },
    lastHeartbeat: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
    lastBootNotification: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
}, {
    sequelize: sequelize_config_1.sequelize,
    tableName: 'charge_points',
    timestamps: true,
    underscored: true,
});
class Transaction extends sequelize_1.Model {
}
exports.Transaction = Transaction;
Transaction.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    chargePointId: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        references: {
            model: ChargePoint,
            key: 'chargePointId',
        },
    },
    connectorId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
    },
    idTag: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    startTime: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
    },
    endTime: {
        type: sequelize_1.DataTypes.DATE,
    },
    meterStart: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
    },
    meterStop: {
        type: sequelize_1.DataTypes.INTEGER,
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('Started', 'Completed', 'Stopped'),
        allowNull: false,
        defaultValue: 'Started',
    },
}, {
    sequelize: sequelize_config_1.sequelize,
    tableName: 'transactions',
    timestamps: true,
    underscored: true,
});
class MeterValue extends sequelize_1.Model {
}
exports.MeterValue = MeterValue;
MeterValue.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    transactionId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Transaction,
            key: 'id',
        },
    },
    timestamp: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
    },
    value: {
        type: sequelize_1.DataTypes.FLOAT,
        allowNull: false,
    },
    unit: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Wh',
    },
}, {
    sequelize: sequelize_config_1.sequelize,
    tableName: 'meter_values',
    timestamps: true,
    underscored: true,
});
// Establecer relaciones
Transaction.hasMany(MeterValue, {
    foreignKey: 'transactionId',
    as: 'meterValues',
});
MeterValue.belongsTo(Transaction, {
    foreignKey: 'transactionId',
    as: 'transaction',
});
ChargePoint.hasMany(Transaction, {
    foreignKey: 'chargePointId',
    as: 'transactions',
});
Transaction.belongsTo(ChargePoint, {
    foreignKey: 'chargePointId',
    as: 'chargePoint',
});
