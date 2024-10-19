import express from "express";
import { conn } from "../../dbconn";
import mysql from "mysql";


const multer = require('multer');
const upload = multer({ dest: 'uploads/' });


export const router = express.Router();


router.get("/", (req, res) => {

    const sql = "select * from riders";

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

// แก้ไข API route สำหรับการลงทะเบียนไรเดอร์
router.post("/register/riders", async (req, res) => {
    const { username, phone, email, password, car_license, profile_image } = req.body

    if (!username || !phone || !email || !password || !car_license) {
        return res.status(400).json({ message: 'Username, Phone, Email, Password, and Car License are required' });
    }

    const checkExisting = 'SELECT COUNT(*) AS count FROM users WHERE email = ? OR phone = ?';

    conn.query(checkExisting, [email, phone], (err, result) => {
        if (err) {
            console.error("Error checking existing user:", err.message);
            return res.status(500).send('Error during user check.');
        }

        if (result[0].count > 0) {
            return res.status(409).json({ message: 'Email or Phone number already exists' });
        }

        const insert = "INSERT INTO users (username, phone, email, password, car_license, profile_image, type) VALUES (?,?,?,?,?,?,?)";

        conn.query(insert, [username, phone, email, password, car_license, profile_image, 2], (err, result) => {
            if (err) {
                console.error("Error during insertion:", err.message);
                return res.status(500).send('Error during insertion.');
            }

            if (result.affectedRows > 0) {
                return res.status(200).json({ message: 'Inserted Successfully' });
            } else {
                return res.status(404).send('Insertion Failed');
            }
        });
    });
});