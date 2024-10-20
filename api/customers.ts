import express from "express";
import { conn } from "../dbconn";
import mysql from "mysql";
import multer from "multer";
import { v4 as uuidv4 } from 'uuid';
import { initializeApp } from "firebase/app";
import { getStorage, ref, getDownloadURL, uploadBytesResumable } from "firebase/storage";
import Config from '../api/config/firebase.config';


export const router = express.Router();

initializeApp(Config.firebaseConfig);
const storage = getStorage();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // จำกัดขนาดไฟล์ที่ 5MB
    },
});


function giveCurrrentDateTime() {
    return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
}

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



// แก้ไข API route สำหรับการลงทะเบียนผู้ใช้ทั่วไป
router.post("/register", upload.single('profile_image'), async (req, res) => {
    try {
        const { username, phone, password, address, gps_location } = req.body;

        if (!username || !phone || !password || !address) {
            return res.status(400).json({ message: 'Username, Phone, Password, and Address are required' });
        }

        let profile_image_url = null;

        if (req.file) {
            const dateTime = giveCurrrentDateTime();
            const storageRef = ref(storage, `files/${req.file.originalname + "_" + dateTime}`);

            const metadata = {
                contentType: req.file.mimetype,
            };

            try {
                const snapshot = await uploadBytesResumable(storageRef, req.file.buffer, metadata);
                profile_image_url = await getDownloadURL(snapshot.ref);
                console.log("File uploaded successfully. URL:", profile_image_url);
            } catch (error) {
                console.error("Error uploading file:", error);
                return res.status(500).json({ message: 'Error uploading file' });
            }
        }

        const checkExisting = 'SELECT COUNT(*) AS count FROM users WHERE phone = ?';

        conn.query(checkExisting, [phone], (err, result) => {
            if (err) {
                console.error("Error checking existing user:", err.message);
                return res.status(500).json({ message: 'Error during user check.' });
            }

            if (result[0].count > 0) {
                return res.status(409).json({ message: 'Phone number already exists' });
            }

            const insert = "INSERT INTO users (username, phone, password, address, gps_location, profile_image, type) VALUES (?,?,?,?,?,?,?)";

            conn.query(insert, [username, phone, password, address, gps_location, profile_image_url, 1], (err, result) => {
                if (err) {
                    console.error("Error during insertion:", err.message);
                    return res.status(500).json({ message: 'Error during insertion.' });
                }

                console.log("Inserted user with profile image URL:", profile_image_url);

                if (result.affectedRows > 0) {
                    return res.status(200).json({
                        message: 'User registered successfully',
                        profile_image: profile_image_url
                    });
                } else {
                    return res.status(404).json({ message: 'Registration failed' });
                }
            });
        });
    } catch (error) {
        console.error("Error in registration process:", error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post("/register/riders", upload.single('profile_image'), async (req, res) => {
    try {
        const { username, phone, password, car_license } = req.body;

        if (!username || !phone || !password || !car_license) {
            return res.status(400).json({ message: 'Username, Phone, Password, and Car License are required' });
        }

        let profile_image_url = null;

        if (req.file) {
            const dateTime = giveCurrrentDateTime();
            const storageRef = ref(storage, `files/${req.file.originalname + "_" + dateTime}`);

            const metadata = {
                contentType: req.file.mimetype,
            };

            try {
                const snapshot = await uploadBytesResumable(storageRef, req.file.buffer, metadata);
                profile_image_url = await getDownloadURL(snapshot.ref);
                console.log("File uploaded successfully. URL:", profile_image_url);
            } catch (error) {
                console.error("Error uploading file:", error);
                return res.status(500).json({ message: 'Error uploading file' });
            }
        }

        const checkExisting = 'SELECT COUNT(*) AS count FROM users WHERE phone = ?';

        conn.query(checkExisting, [phone], (err, result) => {
            if (err) {
                console.error("Error checking existing user:", err.message);
                return res.status(500).json({ message: 'Error during user check.' });
            }

            if (result[0].count > 0) {
                return res.status(409).json({ message: 'Phone number already exists' });
            }

            const insert = "INSERT INTO users (username, phone, password, car_license, profile_image, type) VALUES (?,?,?,?,?,?)";

            conn.query(insert, [username, phone, password, car_license, profile_image_url, 2], (err, result) => {
                if (err) {
                    console.error("Error during insertion:", err.message);
                    return res.status(500).json({ message: 'Error during insertion.' });
                }

                console.log("Inserted user with profile image URL:", profile_image_url);

                if (result.affectedRows > 0) {
                    return res.status(200).json({
                        message: 'User registered successfully',
                        profile_image: profile_image_url
                    });
                } else {
                    return res.status(404).json({ message: 'Registration failed' });
                }
            });
        });
    } catch (error) {
        console.error("Error in rider registration process:", error);
        res.status(500).json({ message: 'Internal server error' });
    }
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