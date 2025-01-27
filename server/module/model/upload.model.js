const uploadModel = (sequelize, Sequelize) => {
    const Upload = sequelize.define('upload', {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false
        },
        fileName: {
            type: Sequelize.STRING(255),
            allowNull: true
        },
        videoPath: {
            type: Sequelize.STRING(255),
            allowNull: true
        },
        isActive: {
            type: Sequelize.BOOLEAN,
            defaultValue: true,
            allowNull: false
        },
        createdAt: {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW,
            allowNull: false
        },
        updatedAt: {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW,
            allowNull: true
        },
        isDeleted: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
            allowNull: false
        },
    }, {
        timestamps: true,  // Automatically manage createdAt and updatedAt
        tableName: 'upload',  // Specify the table name
        charset: 'utf8mb4',  // Character set
        collate: 'utf8mb4_0900_ai_ci',  // Collation
    });

    // Associations
    // Client.associate = function(models) {
    //     // Association with User model
    //     Client.belongsTo(models.user, {
    //         foreignKey: 'createdBy',
    //         onDelete: 'RESTRICT',
    //         onUpdate: 'CASCADE'
    //     });
    // };

    return Upload;
};

export default uploadModel;
