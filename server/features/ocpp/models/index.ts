import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../../../config/sequelize.config';
import { ChargePointStatus } from '../types/ocpp.types';

class ChargePoint extends Model {
    public id!: number;
    public chargePointId!: string;
    public vendor!: string;
    public model!: string;
    public serialNumber!: string;
    public firmwareVersion?: string;
    public status!: ChargePointStatus;
    public lastHeartbeat!: Date;
    public lastBootNotification!: Date;
    public readonly created_at!: Date;
    public readonly updated_at!: Date;
}

ChargePoint.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        chargePointId: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        vendor: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        model: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        serialNumber: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        firmwareVersion: {
            type: DataTypes.STRING,
        },
        status: {
            type: DataTypes.ENUM(...Object.values(ChargePointStatus)),
            allowNull: false,
            defaultValue: ChargePointStatus.Available,
        },
        lastHeartbeat: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        lastBootNotification: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        sequelize,
        tableName: 'charge_points',
        timestamps: true,
        underscored: true,
    }
);

class Transaction extends Model {
    public id!: number;
    public chargePointId!: string;
    public connectorId!: number;
    public idTag!: string;
    public startTime!: Date;
    public endTime?: Date;
    public meterStart!: number;
    public meterStop?: number;
    public status!: 'Started' | 'Completed' | 'Stopped';
    public readonly created_at!: Date;
    public readonly updated_at!: Date;
}

Transaction.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        chargePointId: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: ChargePoint,
                key: 'chargePointId',
            },
        },
        connectorId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        idTag: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        startTime: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        endTime: {
            type: DataTypes.DATE,
        },
        meterStart: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        meterStop: {
            type: DataTypes.INTEGER,
        },
        status: {
            type: DataTypes.ENUM('Started', 'Completed', 'Stopped'),
            allowNull: false,
            defaultValue: 'Started',
        },
    },
    {
        sequelize,
        tableName: 'transactions',
        timestamps: true,
        underscored: true,
    }
);

class MeterValue extends Model {
    public id!: number;
    public transactionId!: number;
    public timestamp!: Date;
    public value!: number;
    public unit!: string;
    public readonly created_at!: Date;
}

MeterValue.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        transactionId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: Transaction,
                key: 'id',
            },
        },
        timestamp: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        value: {
            type: DataTypes.FLOAT,
            allowNull: false,
        },
        unit: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'Wh',
        },
    },
    {
        sequelize,
        tableName: 'meter_values',
        timestamps: true,
        underscored: true,
    }
);

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

export { ChargePoint, Transaction, MeterValue };