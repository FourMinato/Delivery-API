import express, { Request, Response } from "express";
import { conn } from "../dbconn";
import mysql from "mysql";
import multer from "multer";
import { initializeApp } from "firebase/app";
import { getStorage, ref, getDownloadURL, uploadBytesResumable, deleteObject } from "firebase/storage";
import Config from '../api/config/firebase.config';
import { UserGetResponse } from '../api/Model/UserGet'


export const router = express.Router();
initializeApp(Config.firebaseConfig);
const storage = getStorage();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // จำกัดขนาดไฟล์ที่ 5MB
    },
});

// ฟังก์ชันสำหรับลบรูปเดิมใน Firebase
async function deleteOldProfileImage(oldImageUrl: string | null) {
    if (oldImageUrl) {
        try {
            const oldImageRef = ref(storage, oldImageUrl);
            await deleteObject(oldImageRef);
            console.log("Old profile image deleted successfully");
        } catch (error) {
            console.error("Error deleting old profile image:", error);
        }
    }
}


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

router.get("/user/:id", (req, res) => {
    const userId = req.params.id;
    const sql = "SELECT * FROM users WHERE user_id = ?";

    conn.query(sql, [userId], (err, result) => {
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
                    data: result[0]  // ส่งข้อมูลผู้ใช้คนเดียว
                });
            } else {
                res.status(400).json({
                    message: 'User not found'
                });
            }
        }
    });
});

router.post("/login", (req: Request, res: Response) => {
    // รับค่าจาก body
    const { phone, password } = req.body;

    // ตรวจสอบว่ามีค่าส่งมาไหม
    if (!phone || !password) {
        return res.status(400).json({
            success: false,
            message: 'กรุณากรอกเบอร์โทรศัพท์และรหัสผ่าน'
        });
    }

    const sql = "SELECT * FROM users WHERE phone = ?";

    conn.query(sql, [phone], (err: any, result: UserGetResponse[]) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                message: 'Internal Server Error'
            });
        }

        if (result.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ'
            });
        }

        const user = result[0];

        if (password !== user.password) {
            return res.status(401).json({
                success: false,
                message: 'รหัสผ่านไม่ถูกต้อง'
            });
        }

        const userType = user.type === 1 ? 'ผู้ใช้ทั่วไป' : 'ไรเดอร์';

        res.status(200).json({
            success: true,
            message: `เข้าสู่ระบบสำเร็จ (${userType})`,
        });
    });
});


router.post("/register", upload.single('profile_image'), async (req, res) => {
    try {
        const { username, phone, password, confirm_password, address, gps_location } = req.body;

        // ตรวจสอบว่าฟิลด์จำเป็นไม่เป็น null และไม่เป็นช่องว่าง
        if (!username || username.trim() === '' ||
            !phone || phone.trim() === '' ||
            !password || password.trim() === '' ||
            !confirm_password || confirm_password.trim() === '' ||
            !address || address.trim() === '') {
            return res.status(400).json({ message: 'Username, Phone, Password, Confirm Password, and Address are required and cannot be empty' });
        }

        // ตรวจสอบว่ารหัสผ่านและการยืนยันรหัสผ่านตรงกัน
        if (password !== confirm_password) {
            return res.status(400).json({ message: 'Password and Confirm Password do not match' });
        }

        let profile_image_url = null;

        if (req.file) {
            const dateTime = giveCurrrentDateTime();
            const storageRef = ref(storage, `Profile_Rider/${req.file.originalname + "_" + dateTime}`);

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

        conn.query(checkExisting, [phone.trim()], (err, result) => {
            if (err) {
                console.error("Error checking existing user:", err.message);
                return res.status(500).json({ message: 'Error during user check.' });
            }

            if (result[0].count > 0) {
                return res.status(409).json({ message: 'Phone number already exists' });
            }

            const insert = "INSERT INTO users (username, phone, password, address, gps_location, profile_image, type) VALUES (?,?,?,?,?,?,?)";

            conn.query(insert, [
                username.trim(),
                phone.trim(),
                password.trim(),
                address.trim(),
                gps_location ? gps_location.trim() : null,
                profile_image_url,
                1
            ], (err, result) => {
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
        const { username, phone, password, confirm_password, car_license } = req.body;

        // ตรวจสอบว่าฟิลด์จำเป็นไม่เป็น null และไม่เป็นช่องว่าง
        if (!username || username.trim() === '' ||
            !phone || phone.trim() === '' ||
            !password || password.trim() === '' ||
            !confirm_password || confirm_password.trim() === '' ||
            !car_license || car_license.trim() === '') {
            return res.status(400).json({ message: 'Username, Phone, Password, Confirm Password, and Car License are required and cannot be empty' });
        }

        // ตรวจสอบว่ารหัสผ่านและการยืนยันรหัสผ่านตรงกัน
        if (password !== confirm_password) {
            return res.status(400).json({ message: 'Password and Confirm Password do not match' });
        }

        let profile_image_url = null;

        if (req.file) {
            const dateTime = giveCurrrentDateTime();
            const storageRef = ref(storage, `Profile_Rider/${req.file.originalname + "_" + dateTime}`);

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

        conn.query(checkExisting, [phone.trim()], (err, result) => {
            if (err) {
                console.error("Error checking existing user:", err.message);
                return res.status(500).json({ message: 'Error during user check.' });
            }

            if (result[0].count > 0) {
                return res.status(409).json({ message: 'Phone number already exists' });
            }

            const insert = "INSERT INTO users (username, phone, password, car_license, profile_image, type) VALUES (?,?,?,?,?,?)";

            //เพิ่ม .trim() เพื่อตัดช่องว่างหน้า-หลังก่อนบันทึกข้อมูล
            conn.query(insert, [
                username.trim(),
                phone.trim(),
                password.trim(),
                car_license.trim(),
                profile_image_url,
                2
            ], (err, result) => {
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

// อัพเดตข้อมูลผู้ใช้ทั่วไป
router.put("/update/user/:id", upload.single('profile_image'), async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.id);

        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'รหัสผู้ใช้ไม่ถูกต้อง'
            });
        }

        const { username, phone, password, address, gps_location } = req.body;

        // ตรวจสอบข้อมูลที่จำเป็น
        if (!username || !phone) {
            return res.status(400).json({
                success: false,
                message: 'กรุณากรอกชื่อผู้ใช้และเบอร์โทรศัพท์'
            });
        }

        // ดึงข้อมูลผู้ใช้เดิม
        const getUserSql = "SELECT * FROM users WHERE user_id = ? AND type = 1";
        conn.query(getUserSql, [userId], async (err, result: any) => {
            if (err) {
                console.error("Error fetching user data:", err);
                return res.status(500).json({
                    success: false,
                    message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้'
                });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'ไม่พบข้อมูลผู้ใช้'
                });
            }

            const oldUser = result[0];
            let profile_image_url = oldUser.profile_image;

            // ถ้ามีการอัปโหลดรูปภาพใหม่
            if (req.file) {
                try {
                    const dateTime = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
                    const storageRef = ref(storage, `profile_images/${req.file.originalname}_${dateTime}`);
                    const metadata = {
                        contentType: req.file.mimetype,
                    };
                    const snapshot = await uploadBytesResumable(storageRef, req.file.buffer, metadata);
                    profile_image_url = await getDownloadURL(snapshot.ref);
                    console.log("อัปโหลดรูปโปรไฟล์ใหม่สำเร็จ URL:", profile_image_url);

                    // ลบรูปภาพเก่า (ถ้ามี)
                    if (oldUser.profile_image) {
                        await deleteOldProfileImage(oldUser.profile_image);
                        console.log("ลบรูปโปรไฟล์เก่าสำเร็จ");
                    }
                } catch (uploadError) {
                    console.error("เกิดข้อผิดพลาดในการอัปโหลดรูปโปรไฟล์ใหม่:", uploadError);
                    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอัปโหลดรูปโปรไฟล์' });
                }
            }

            // เตรียมข้อมูลสำหรับอัปเดต
            const updateData: any = {
                username: username,
                phone: phone,
                address: address || oldUser.address,
                gps_location: gps_location || oldUser.gps_location,
                profile_image: profile_image_url
            };

            // อัปเดตรหัสผ่านเฉพาะเมื่อมีการส่งมา
            if (password) {
                // ควรมีการ hash password ก่อนบันทึก
                updateData.password = password;
            }

            // อัปเดตข้อมูลในฐานข้อมูล
            const updateUserSql = "UPDATE users SET ? WHERE user_id = ? AND type = 1";
            conn.query(updateUserSql, [updateData, userId], (updateErr, updateResult: any) => {
                if (updateErr) {
                    console.error("Error updating user:", updateErr);
                    return res.status(500).json({
                        success: false,
                        message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลผู้ใช้'
                    });
                }

                if (updateResult.affectedRows === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'ไม่พบข้อมูลผู้ใช้หรือไม่ใช่ผู้ใช้ทั่วไป'
                    });
                }

                res.status(200).json({
                    success: true,
                    message: 'อัปเดตข้อมูลผู้ใช้สำเร็จ',
                    data: {
                        user_id: userId
                    }
                });
            });
        });
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในกระบวนการอัปเดตข้อมูลผู้ใช้:", error);
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
    }
});

// อัพเดตข้อมูลไรเดอร์
router.put("/update/rider/:id", upload.single('profile_image'), async (req: Request, res: Response) => {
    try {
        const riderId = parseInt(req.params.id);

        if (isNaN(riderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid rider ID'
            });
        }

        const { username, phone, password, car_license } = req.body;

        // ตรวจสอบข้อมูลที่จำเป็น
        if (!username || !phone || !car_license) {
            return res.status(400).json({
                success: false,
                message: 'กรุณากรอกชื่อผู้ใช้, เบอร์โทรศัพท์, และเลขทะเบียนรถ'
            });
        }

        // ดึงข้อมูลไรเดอร์เดิม
        const getRiderSql = "SELECT * FROM users WHERE user_id = ? AND type = 2";
        conn.query(getRiderSql, [riderId], async (err: any, result: any) => {
            if (err) {
                console.error("Error fetching rider data:", err);
                return res.status(500).json({
                    success: false,
                    message: 'Error fetching rider data'
                });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Rider not found'
                });
            }

            const oldRider = result[0];
            let profile_image_url = oldRider.profile_image;

            // ถ้ามีการอัปโหลดรูปภาพใหม่
            if (req.file) {
                try {
                    const dateTime = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
                    const storageRef = ref(storage, `rider_images/${req.file.originalname}_${dateTime}`);
                    const metadata = {
                        contentType: req.file.mimetype,
                    };
                    const snapshot = await uploadBytesResumable(storageRef, req.file.buffer, metadata);
                    profile_image_url = await getDownloadURL(snapshot.ref);
                    console.log("New rider profile image uploaded successfully. URL:", profile_image_url);

                    // ลบรูปภาพเก่า (ถ้ามี)
                    if (oldRider.profile_image) {
                        await deleteOldProfileImage(oldRider.profile_image);
                    }
                } catch (uploadError) {
                    console.error("Error uploading new rider profile image:", uploadError);
                    return res.status(500).json({ message: 'Error uploading new rider profile image' });
                }
            }

            // อัปเดตข้อมูลในฐานข้อมูล
            const updateRiderSql = "UPDATE users SET username = ?, phone = ?, password = ?, car_license = ?, profile_image = ? WHERE user_id = ? AND type = 2";
            const updateValues = [
                username,
                phone,
                password ? password : oldRider.password, // ควรมีการ hash password ก่อนบันทึก
                car_license,
                profile_image_url,
                riderId
            ];

            conn.query(updateRiderSql, updateValues, (updateErr: any, updateResult: any) => {
                if (updateErr) {
                    console.error("Error updating rider:", updateErr);
                    return res.status(500).json({
                        success: false,
                        message: 'Error updating rider'
                    });
                }

                if (updateResult.affectedRows === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Rider not found or not a rider'
                    });
                }

                res.status(200).json({
                    success: true,
                    message: 'อัปเดตข้อมูลไรเดอร์สำเร็จ',
                    data: {
                        user_id: riderId
                    }
                });
            });
        });
    } catch (error) {
        console.error("Error in rider update process:", error);
        res.status(500).json({ message: 'Internal server error' });
    }
});