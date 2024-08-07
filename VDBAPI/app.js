const express = require('express');

const cors = require('cors');

const mysql = require('mysql2/promise');

const app = express();


app.use(express.json());

app.use(cors());

async function createPool() {
    return await mysql.createPool({
        host: process.env.MYSQL_HOST || 'srv1391.hstgr.io',
        user: process.env.MYSQL_USER || 'u858543158_technopour',
        password: process.env.MYSQL_PASSWORD || 'Wvh1z]SL#3',
        database: process.env.MYSQL_DATABASE || 'u858543158_33zBrmCUqoJ7',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
}


// Middleware to log requests
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

//check company_name,email,jt in both tables
app.get('/check-data', async (req, res) => {
    const { tableName } = req.query;

    // Validate tableName to prevent SQL injection
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
        return res.status(400).json({ error: 'Invalid table name' });
    }

    // Query to get related data
    const getRelatedDataQuery = `
        SELECT 
            vector19.*,
            ${tableName}.company_name AS company_name2,
            ${tableName}.job_title AS job_title2,
            ${tableName}.email_address AS email_address2
        FROM vector19 
        JOIN ${tableName} ON vector19.pid = ${tableName}.pid;
    `;

    let connection;
    const pool = await createPool();

    try {
        connection = await pool.getConnection();

        // Fetch related data
        const [rows] = await connection.query(getRelatedDataQuery);
        if (rows.length === 0) {
            throw new Error('No related records found');
        }

        // Prepare the response data
        const responseData = rows.map(row => ({
            ...row,
            company_name_matches: row.company_name === row.company_name2,
            job_title_matches: row.job_title === row.job_title2,
            email_address_matches: row.email_address === row.email_address2
        }));

        res.json(responseData);
    } catch (error) {
        console.error('Error checking company data:', error);
        res.status(500).json({ error: 'Error checking company data' });
    } finally {
        if (connection) {
            await connection.release();
        }
    }
});



// Join the tables and fetch data

app.get('/joined-data', async (req, res) => {
    const connection = await createPool();
    const query = `
        SELECT * FROM vector19 
        JOIN pfsrhngye22150d11a387f5d49d98c 
        ON vector19.pid = pfsrhngye22150d11a387f5d49d98c.pid;
    `;

    try {
        const [results] = await connection.query(query);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error });
    } finally {
        await connection.end();
    }
});


// GET API to fetch the total count of rows updated in the whole table
app.get('/update-job-titles', async (req, res) => {
    const { ids, newJobTitle, tableName } = req.query;

    // Validate tableName to prevent SQL injection
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
        return res.status(400).json({ error: 'Invalid table name' });
    }

    // Convert ids to an array of numbers
    const idList = ids ? ids.split(',').map(id => parseInt(id, 10)) : [];

    // Validate ids array
    if (idList.length === 0) {
        return res.status(400).json({ error: 'No IDs provided' });
    }

    // Queries
    const getRelatedIdQuery = `SELECT * FROM vector19 JOIN ${tableName} 
        ON vector19.pid = ${tableName}.pid WHERE vector19.id IN (?);`;
    const updateVector19Query = `UPDATE vector19 SET job_title = ? WHERE id IN (?);`;
    const updateTable2Query = `UPDATE ${tableName} SET job_title = ? WHERE id IN (?);`;

    // Queries to get the total count of rows in each table
    const getTotalRowsVector19Query = `SELECT COUNT(*) as totalRows FROM vector19;`;
    const getTotalRowsTable2Query = `SELECT COUNT(*) as totalRows FROM ${tableName};`;

    // Queries to fetch updated rows
    const getUpdatedRowsVector19Query = `SELECT * FROM vector19 WHERE id IN (?);`;
    const getUpdatedRowsTable2Query = `SELECT * FROM ${tableName} WHERE id IN (?);`;

    
    let connection;

    const pool = await createPool();

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Fetch related data
        const [rows] = await connection.query(getRelatedIdQuery, [idList]);
        if (rows.length === 0) {
            throw new Error('No related records found');
        }

        const relatedColumnIds = rows.map(row => row.id);

        // Update job title in the first table
        const [updateResult1] = await connection.query(updateVector19Query, [newJobTitle, idList]);

        // Update job title in the second table
        const [updateResult2] = await connection.query(updateTable2Query, [newJobTitle, relatedColumnIds]);

        // Commit the transaction
        await connection.commit();

        // Get the total count of rows in each table
        const [[totalRowsVector19]] = await connection.query(getTotalRowsVector19Query);
        const [[totalRowsTable2]] = await connection.query(getTotalRowsTable2Query);

        // Fetch updated rows
        const [updatedRowsVector19] = await connection.query(getUpdatedRowsVector19Query, [idList]);
        const [updatedRowsTable2] = await connection.query(getUpdatedRowsTable2Query, [relatedColumnIds]);

        
        res.json({
            message: 'Job title updated in both tables',
            updatedRows: {
                vector19: updatedRowsVector19,
                table2: updatedRowsTable2,
            },
            totalRows: {
                vector19: totalRowsVector19.totalRows,
                table2: totalRowsTable2.totalRows,
            },
            updatedJobTitle: newJobTitle,
        });
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Error during rollback:', rollbackError);
            }
        }
        console.error('Error updating job titles:', error);
        res.status(500).json({ error: 'Error updating job titles' });
    } finally {
        if (connection) {
            await connection.release();
        }
    }
});



// Start the server
const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});




