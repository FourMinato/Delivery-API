import express from "express";
import { conn } from "../dbconn";
import mysql from "mysql";


export const router = express.Router();


router.get("/", (req, res) => {

    const sql = "select * from users";

    conn.query(sql, (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).json({
                message: 'Internal Server Error'
            });
        } else {
            if (result.length > 0) {

                res.status(200).json({
                    success: true,
                    message: 'Get Data Success',
                    data: result

                });

            } else {
                res.status(400).json({
                    message: 'Get Data failed'
                });
            }
        }
    });

});



router.post("/register", async (req, res) => {
    const { username, phone, email, password } = req.body

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and Password cannot be null' });
    }

    const checkEmail = ' select count(*) as count From users where email = ?';

    conn.query(checkEmail, [email], (err, result) => {
        if (err) {
            console.error("Error checking email:", err.message);
            return res.status(500).send('Error during email check.');
        }

        if (result[0].count > 0) {
            // ตรวจพบ email ซ้ำ
            return res.status(409).json({ message: 'Email already exists' });
        }

        const insert = "INSERT INTO users (username, phone, email, password) VALUES (?,?,?,?)";

        conn.query(insert, [username, phone, email, password], (err, result) => {
            if (err) {
                console.error("Error during insertion:", err.message);
                return res.status(500).send('Error during insertion.');
            }

            if (result.affectedRows > 0) {
                return res.status(200).json({ message: 'Inserted Successfully' });
            } else {
                return res.status(404).send('Insertion Failed');
            }
        })
    })
});

router.post("/register/riders", async (req, res) => {
    const { username, phone, email, password, car_license } = req.body

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and Password cannot be null' });
    }

    const checkEmail = ' select count(*) as count From riders where email = ?';

    conn.query(checkEmail, [email], (err, result) => {
        if (err) {
            console.error("Error checking email:", err.message);
            return res.status(500).send('Error during email check.');
        }

        if (result[0].count > 0) {
            // ตรวจพบ email ซ้ำ
            return res.status(409).json({ message: 'Email already exists' });
        }

        const insert = "INSERT INTO users (username, phone, email, password, car_license) VALUES (?,?,?,?,?)";

        conn.query(insert, [username, phone, email, password], (err, result) => {
            if (err) {
                console.error("Error during insertion:", err.message);
                return res.status(500).send('Error during insertion.');
            }

            if (result.affectedRows > 0) {
                return res.status(200).json({ message: 'Inserted Successfully' });
            } else {
                return res.status(404).send('Insertion Failed');
            }
        })
    })
});


//Update

// อัพเดตข้อมูล users
router.put("/update/user", (req, res) => {
    const { user_id, ...updateData } = req.body;

    if (!user_id) return res.status(400).json(
        { message: 'User ID is required' }
    );

    const fields = Object.keys(updateData).filter(
        key => updateData[key] !== undefined
    );

    if (fields.length === 0) return res.status(400).json(
        { message: 'No fields to update' }
    );

    const sql = `UPDATE users SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE user_id = ?`;

    const values = [...fields.map(f => updateData[f]), user_id];

    conn.query(sql, values, (err, result) => {

        if (err) return res.status(500).json(
            { message: 'Internal Server Error' }
        );
        res.status(result.affectedRows > 0 ? 200 : 404).json(
            {
                message: result.affectedRows > 0 ? 'User updated successfully' : 'User not found'
            });
    });
});

// อัพเดตข้อมูล riders
router.put("/update/rider", (req, res) => {
    const { rider_id, ...updateData } = req.body;
    if (!rider_id) return res.status(400).json(
        { message: 'Rider ID is required' }
    );

    const fields = Object.keys(updateData).filter(
        key => updateData[key] !== undefined
    );
    if (fields.length === 0) return res.status(400).json({ message: 'No fields to update' });

    const sql = `UPDATE riders SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE rider_id = ?`;

    const values = [...fields.map(f => updateData[f]), rider_id];

    conn.query(sql, values, (err, result) => {
        if (err) return res.status(500).json(
            { message: 'Internal Server Error' }
        );
        res.status(result.affectedRows > 0 ? 200 : 404).json(
            {
                message: result.affectedRows > 0 ? 'Rider updated successfully' : 'Rider not found'
            });
    });
});