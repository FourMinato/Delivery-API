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

    const checkEmail = 'SELECT COUNT(*) AS count FROM users WHERE email = ?';

    conn.query(checkEmail, [email], (err, result) => {
        if (err) {
            console.error("Error checking email:", err.message);
            return res.status(500).send('Error during email check.');
        }

        if (result[0].count > 0) {
            // ตรวจพบ email ซ้ำ
            return res.status(409).json({ message: 'Email already exists' });
        }

        const insert = "INSERT INTO users (username, phone, email, password, type) VALUES (?,?,?,?,?)";

        conn.query(insert, [username, phone, email, password, 1], (err, result) => {
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

    if (!email || !password || !car_license) {
        return res.status(400).json({ message: 'Email, Password, and Car License cannot be null' });
    }

    const checkEmail = 'SELECT COUNT(*) AS count FROM users WHERE email = ?';

    conn.query(checkEmail, [email], (err, result) => {
        if (err) {
            console.error("Error checking email:", err.message);
            return res.status(500).send('Error during email check.');
        }

        if (result[0].count > 0) {
            return res.status(409).json({ message: 'Email already exists' });
        }

        const insert = "INSERT INTO users (username, phone, email, password, car_license, type) VALUES (?,?,?,?,?,?)";

        conn.query(insert, [username, phone, email, password, car_license, 2], (err, result) => {
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


//Update

// อัพเดตข้อมูล users
router.put("/update/user/:id", (req, res) => {
    const userId = req.params.id;
    const { username, phone, email, password, address } = req.body as {
        username?: string; phone?: string; email?: string; password?: string; address?: string;
    };

    // สร้างอ็อบเจ็กต์สำหรับเก็บข้อมูลที่จะอัพเดต
    const updateData: { [key: string]: string } = {};
    if (username !== undefined) updateData.username = username;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (password !== undefined) updateData.password = password;
    if (address !== undefined) updateData.address = address;

    // ตรวจสอบว่ามีข้อมูลที่จะอัพเดตหรือไม่
    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'No fields to update' });
    }

    // สร้างคำสั่ง SQL สำหรับการอัพเดต
    const sql = "UPDATE users SET ? WHERE user_id = ?";

    // ทำการ query
    conn.query(sql, [updateData, userId], (err, result) => {
        if (err) {
            console.error("Error updating user:", err.message);
            return res.status(500).json({ message: 'Internal Server Error' });
        }

        if (result.affectedRows > 0) {
            res.status(200).json({ message: 'User updated successfully' });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    });
});

// อัพเดตข้อมูล riders
router.put("/update/rider/:id", (req, res) => {
    const riderId = req.params.id;
    const { username, phone, email, password, car_license } = req.body as {
        username?: string; phone?: string; email?: string; password?: string; car_license?: string;
    };

    // สร้างอ็อบเจ็กต์สำหรับเก็บข้อมูลที่จะอัพเดต
    const updateData: { [key: string]: string } = {};
    if (username !== undefined) updateData.username = username;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (password !== undefined) updateData.password = password;
    if (car_license !== undefined) updateData.car_license = car_license;

    // ตรวจสอบว่ามีข้อมูลที่จะอัพเดตหรือไม่
    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'No fields to update' });
    }

    // สร้างคำสั่ง SQL สำหรับการอัพเดต
    const sql = "UPDATE riders SET ? WHERE rider_id = ?";

    // ทำการ query
    conn.query(sql, [updateData, riderId], (err, result) => {
        if (err) {
            console.error("Error updating user:", err.message);
            return res.status(500).json({ message: 'Internal Server Error' });
        }

        if (result.affectedRows > 0) {
            res.status(200).json({ message: 'User updated successfully' });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    });
});

