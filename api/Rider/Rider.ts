import express, { Request, Response } from "express";
import { conn } from "../../dbconn";
import multer from "multer";
import { getStorage, ref, getDownloadURL, uploadBytesResumable, deleteObject } from "firebase/storage";
import { initializeApp } from "firebase/app";


export const riderRouter = express.Router();
const storage = getStorage();


const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // จำกัดขนาดไฟล์ที่ 5MB
    },
});


function getCurrentDateTime() {
    return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
}

async function deleteImage(imageUrl: string) {
    try {
        const urlObj = new URL(imageUrl);
        const imagePath = urlObj.pathname.split('/o/')[1];
        const decodedPath = decodeURIComponent(imagePath);

        const fileRef = ref(storage, decodedPath);
        await deleteObject(fileRef);
        console.log("Old image deleted successfully");
    } catch (error) {
        console.error("Error deleting old image:", error);
    }
}



riderRouter.get("/all-riders", (req: Request, res: Response) => {
    const sql = `
        SELECT user_id, username, phone, car_license, profile_image
        FROM users
        WHERE type = 2
    `;

    conn.query(sql, (err, result) => {
        if (err) {
            console.error("Error fetching riders:", err);
            return res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลไรเดอร์'
            });
        }
        res.status(200).json({
            success: true,
            total_riders: result.length,
            data: result
        });
    });
});


// API สำหรับดูรายการออเดอร์ที่ยังไม่มีไรเดอร์รับ
riderRouter.get("/all-orders", (req: Request, res: Response) => {
    const sql = `
        SELECT do.*, ds.status_name 
        FROM delivery_orders do
        JOIN delivery_status ds ON do.status_id = ds.status_id
        WHERE do.status_id = 1
    `;
    conn.query(sql, (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการดึงข้อมูลออเดอร์" });
        }
        res.json({ success: true, data: result });
    });
});

// API สำหรับไรเดอร์รับออเดอร์
riderRouter.post("/accept-order", upload.single('status_image'), (req, res) => {
    const { userId, orderId } = req.body;

    if (!req.file) {
        return res.status(400).json({ success: false, message: "กรุณาอัพโหลดรูปภาพสถานะ" });
    }

    const dateTime = getCurrentDateTime();
    const storageRef = ref(storage, `status_images/${req.file.originalname}_${dateTime}`);
    const metadata = {
        contentType: req.file.mimetype,
    };

    const uploadTask = uploadBytesResumable(storageRef, req.file.buffer, metadata);

    uploadTask.on('state_changed',
        (snapshot) => {
            // อัพเดตความคืบหน้าการอัพโหลด (ถ้าต้องการ)
        },
        (error) => {
            console.error("Upload failed:", error);
            res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการอัพโหลดรูปภาพ" });
        },
        () => {
            getDownloadURL(uploadTask.snapshot.ref).then((imageUrl) => {
                // อัพเดตข้อมูลในตาราง delivery_status_tracking
                const updateQuery = `
                    UPDATE delivery_status_tracking 
                    SET rider_id = ?, status_id = 2, status_image = ?, timestamp = CURRENT_TIMESTAMP
                    WHERE order_id = ? AND status_id = 1
                `;

                conn.query(updateQuery, [userId, imageUrl, orderId], (updateErr, updateResult) => {
                    if (updateErr) {
                        console.error("Database update error:", updateErr);
                        return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการอัพเดตฐานข้อมูล" });
                    }

                    if (updateResult.affectedRows === 0) {
                        return res.status(400).json({ success: false, message: "ไม่สามารถรับออเดอร์ได้ หรือออเดอร์ถูกรับไปแล้ว" });
                    }

                    // อัพเดตสถานะในตาราง delivery_orders
                    conn.query("UPDATE delivery_orders SET status_id = 2 WHERE order_id = ?", [orderId], (orderErr) => {
                        if (orderErr) {
                            console.error("Order update error:", orderErr);
                            return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการอัพเดตสถานะออเดอร์" });
                        }

                        res.json({ success: true, message: "รับออเดอร์และอัพเดตสถานะสำเร็จ", imageUrl });
                    });
                });
            }).catch((urlError) => {
                console.error("Error getting download URL:", urlError);
                res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการรับ URL รูปภาพ" });
            });
        }
    );
});

// API สำหรับไรเดอร์อัปเดตสถานะออเดอร์พร้อมรูปภาพ
riderRouter.post("/update-order-status", upload.single('status_image'), (req, res) => {
    const { userId, orderId, statusId } = req.body;

    if (!req.file) {
        return res.status(400).json({ success: false, message: "กรุณาอัพโหลดรูปภาพสถานะ" });
    }

    const dateTime = getCurrentDateTime();
    const storageRef = ref(storage, `status_images/${req.file.originalname}_${dateTime}`);
    const metadata = {
        contentType: req.file.mimetype,
    };

    const uploadTask = uploadBytesResumable(storageRef, req.file.buffer, metadata);

    uploadTask.on('state_changed',
        (snapshot) => {
            // อัพเดตความคืบหน้าการอัพโหลด (ถ้าต้องการ)
        },
        (error) => {
            console.error("Upload failed:", error);
            res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการอัพโหลดรูปภาพ" });
        },
        () => {
            getDownloadURL(uploadTask.snapshot.ref).then((imageUrl) => {
                // ดึงข้อมูลสถานะและรูปภาพเก่า
                conn.query("SELECT status_id, status_image FROM delivery_status_tracking WHERE order_id = ? ORDER BY timestamp DESC LIMIT 1", [orderId], (selectErr, selectResult) => {
                    if (selectErr) {
                        console.error("Select error:", selectErr);
                        return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการตรวจสอบสถานะเดิม" });
                    }

                    const oldStatus = selectResult[0];
                    if (!oldStatus || parseInt(statusId) <= oldStatus.status_id) {
                        return res.status(400).json({ success: false, message: "ไม่สามารถอัพเดตสถานะได้" });
                    }

                    // อัพเดตข้อมูลในตาราง delivery_status_tracking
                    const updateQuery = `
                        UPDATE delivery_status_tracking 
                        SET status_id = ?, status_image = ?, timestamp = CURRENT_TIMESTAMP
                        WHERE order_id = ? AND status_id = ?
                    `;

                    conn.query(updateQuery, [statusId, imageUrl, orderId, oldStatus.status_id], (updateErr, updateResult) => {
                        if (updateErr) {
                            console.error("Database update error:", updateErr);
                            return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการอัพเดตฐานข้อมูล" });
                        }

                        if (updateResult.affectedRows === 0) {
                            return res.status(400).json({ success: false, message: "ไม่สามารถอัพเดตสถานะได้ หรือสถานะถูกเปลี่ยนไปแล้ว" });
                        }

                        // อัพเดตสถานะในตาราง delivery_orders
                        conn.query("UPDATE delivery_orders SET status_id = ? WHERE order_id = ?", [statusId, orderId], (orderErr) => {
                            if (orderErr) {
                                console.error("Order update error:", orderErr);
                                return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการอัพเดตสถานะออเดอร์" });
                            }

                            // ลบรูปภาพเก่า
                            if (oldStatus.status_image) {
                                deleteImage(oldStatus.status_image);
                            }

                            res.json({ success: true, message: "อัพเดตสถานะและรูปภาพสำเร็จ", imageUrl });
                        });
                    });
                });
            }).catch((urlError) => {
                console.error("Error getting download URL:", urlError);
                res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการรับ URL รูปภาพ" });
            });
        }
    );
});

// API สำหรับไรเดอร์ดูออเดอร์ปัจจุบันของตัวเอง
riderRouter.get("/current-order/:userId", (req: Request, res: Response) => {
    const userId = req.params.userId;

    const sql = `
        SELECT do.*, ds.status_name 
        FROM delivery_orders do
        JOIN delivery_status ds ON do.status_id = ds.status_id
        JOIN delivery_status_tracking dst ON do.order_id = dst.order_id
        WHERE dst.rider_id = ? AND do.status_id IN (2, 3)
        ORDER BY dst.timestamp DESC
        LIMIT 1
    `;
    conn.query(sql, [userId], (err, result) => {
        if (err) {
            return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการดึงข้อมูลออเดอร์" });
        }
        if (result.length === 0) {
            return res.json({ success: true, message: "ไม่มีออเดอร์ที่กำลังดำเนินการ", data: null });
        }
        res.json({ success: true, data: result[0] });
    });
});

// API สำหรับไรเดอร์อัปเดตตำแหน่ง GPS
riderRouter.post("/update-location", (req: Request, res: Response) => {
    const { userId, orderId, latitude, longitude } = req.body;

    const sql = `
        INSERT INTO rider_locations (rider_id, order_id, latitude, longitude)
        VALUES (?, ?, ?, ?)
    `;
    conn.query(sql, [userId, orderId, latitude, longitude], (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการอัปเดตตำแหน่ง" });
        }
        res.json({ success: true, message: "อัปเดตตำแหน่งสำเร็จ" });
    });
});