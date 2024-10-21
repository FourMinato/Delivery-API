import express, { Request, Response } from "express";
import { conn } from "../../dbconn";
import {OrderResponse, OrderItem } from '../Model/OurderGet';

import { getStorage, ref, getDownloadURL, uploadBytesResumable, deleteObject } from "firebase/storage";
import multer from "multer";


export const router = express.Router();
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

// เพิ่มฟังก์ชันสำหรับลบรูปภาพจาก Firebase Storage
async function deleteImageFromFirebase(imageUrl: string) {
    try {
        // ดึงเฉพาะส่วนของ path จาก URL
        const urlObj = new URL(imageUrl);
        const imagePath = urlObj.pathname.split('/o/')[1];
        const decodedPath = decodeURIComponent(imagePath);

        const fileRef = ref(storage, decodedPath);
        await deleteObject(fileRef);
        console.log("Old image deleted successfully");
    } catch (error) {
        console.error("Error deleting old image:", error);
        // ถ้าต้องการให้โปรแกรมหยุดทำงานเมื่อลบไม่สำเร็จ ให้ throw error
        // throw error;
    }
}

router.post("/items", upload.single('item_image'), async (req: Request, res: Response) => {
    const { item_name, item_description, item_quantity, item_price } = req.body;
    let item_image_url: string | null = null;

    if (req.file) {
        try {
            const dateTime = getCurrentDateTime();
            const storageRef = ref(storage, `item_images/${req.file.originalname + "_" + dateTime}`);
            const snapshot = await uploadBytesResumable(storageRef, req.file.buffer, {
                contentType: req.file.mimetype,
            });
            item_image_url = await getDownloadURL(snapshot.ref);
        } catch (error) {
            console.error("Error uploading image:", error);
        }
    }

    const newItem = {
        item_name,
        item_description,
        item_quantity: parseInt(item_quantity),
        item_price: parseFloat(item_price),
        item_image: item_image_url
    };

    conn.query("INSERT INTO order_items SET ?", newItem, (err, result: any) => {
        if (err) {
            console.error("Error creating item:", err);
            return res.status(500).json({
                success: false,
                message: 'เกิดข้อผิดพลาดในการสร้างรายการสินค้า'
            });
        }

        res.status(201).json({
            success: true,
            message: 'สร้างรายการสินค้าสำเร็จ',
            data: { ...newItem, item_id: result.insertId }
        });
    });
});



router.post("/orders", async (req: Request, res: Response) => {
    const { sender_id, receiver_phone, item_ids } = req.body;

    if (!sender_id || !receiver_phone || !item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'กรุณากรอกข้อมูลให้ครบถ้วน รวมถึงรายการ item_id'
        });
    }

    // ตรวจสอบเบอร์โทรศัพท์
    conn.query("SELECT * FROM users WHERE phone = ?", [receiver_phone], (err, users) => {
        if (err || users.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'เบอร์โทรศัพท์ไม่ถูกต้องหรือไม่มีอยู่ในระบบ'
            });
        }

        // ดึงข้อมูลสินค้าจาก item_ids
        conn.query("SELECT * FROM order_items WHERE item_id IN (?)", [item_ids], (itemErr, items: any[]) => {
            if (itemErr) {
                return res.status(500).json({
                    success: false,
                    message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า'
                });
            }

            if (items.length !== item_ids.length) {
                return res.status(400).json({
                    success: false,
                    message: 'มีรายการสินค้าบางรายการไม่ถูกต้อง'
                });
            }

            // คำนวณยอดรวมของออเดอร์
            const total_amount = items.reduce((sum, item) => sum + (item.item_price * item.item_quantity), 0);
            const total_items = items.reduce((sum, item) => sum + item.item_quantity, 0);

            // สร้างออเดอร์ใหม่
            const newOrder = {
                sender_id,
                receiver_phone,
                item_ids: item_ids[0], // เก็บ item_id แรกตามโครงสร้าง DB
                status_id: 1,
                total_amount,
                total_items
            };

            // Insert ลงในตาราง delivery_orders
            conn.query("INSERT INTO delivery_orders SET ?", newOrder, (orderErr, orderResult: any) => {
                if (orderErr) {
                    return res.status(500).json({
                        success: false,
                        message: 'เกิดข้อผิดพลาดในการสร้างออเดอร์'
                    });
                }

                const orderId = orderResult.insertId;

                // สร้าง status tracking สำหรับออเดอร์ใหม่
                conn.query(
                    "INSERT INTO delivery_status_tracking (order_id, status_id) VALUES (?, ?)",
                    [orderId, 1],
                    (trackingErr) => {
                        if (trackingErr) {
                            return res.status(500).json({
                                success: false,
                                message: 'เกิดข้อผิดพลาดในการสร้างสถานะการติดตาม'
                            });
                        }

                        res.status(201).json({
                            success: true,
                            message: 'สร้างออเดอร์สำเร็จ',
                            data: {
                                order_id: orderId,
                                ...newOrder,
                                items: items // ส่งข้อมูลสินค้าทั้งหมดกลับไป
                            }
                        });
                    }
                );
            });
        });
    });
});

// API สำหรับอัปเดต order
router.put("/orders/:orderId", upload.single('item_image'), async (req: Request, res: Response) => {
    try {
        const orderId = req.params.orderId;
        const { sender_id, receiver_phone, item_name, item_description } = req.body;

        // ตรวจสอบข้อมูลที่จำเป็น
        if (!sender_id || !receiver_phone || !item_name || !item_description) {
            return res.status(400).json({
                success: false,
                message: 'กรุณากรอกข้อมูลให้ครบถ้วน'
            });
        }

        const checkPhoneSql = "SELECT * FROM users WHERE phone = ?";
        conn.query(checkPhoneSql, [receiver_phone], async (checkErr: any, checkResult: any) => {
            if (checkErr) {
                console.error("Error checking phone number:", checkErr);
                return res.status(500).json({
                    success: false,
                    message: 'เกิดข้อผิดพลาดในการตรวจสอบเบอร์โทรศัพท์'
                });
            }

            if (checkResult.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'เบอร์โทรศัพท์ไม่ถูกต้องหรือไม่มีอยู่ในระบบ'
                });
            }
        });



        // ดึงข้อมูล order เดิม
        const getOldOrderSql = "SELECT * FROM delivery_orders WHERE order_id = ?";
        conn.query(getOldOrderSql, [orderId], async (err: any, result: any) => {
            if (err) {
                console.error("Error fetching old order:", err);
                return res.status(500).json({
                    success: false,
                    message: 'Error fetching old order'
                });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            const oldOrder = result[0];
            let item_image_url = oldOrder.item_image;

            // ถ้ามีการอัปโหลดรูปภาพใหม่
            if (req.file) {
                const dateTime = getCurrentDateTime();
                const storageRef = ref(storage, `order_images/${req.file.originalname + "_" + dateTime}`);

                const metadata = {
                    contentType: req.file.mimetype,
                };

                try {
                    // อัปโหลดรูปภาพใหม่
                    const snapshot = await uploadBytesResumable(storageRef, req.file.buffer, metadata);
                    const newImageUrl = await getDownloadURL(snapshot.ref);
                    console.log("New item image uploaded successfully. URL:", newImageUrl);

                    // ลบรูปภาพเก่า
                    if (oldOrder.item_image) {
                        try {
                            await deleteImageFromFirebase(oldOrder.item_image);
                            console.log("Old image deleted successfully");
                        } catch (deleteError) {
                            console.error("Error deleting old image:", deleteError);
                            // ไม่ต้อง return error response ที่นี่ เพราะเราไม่ต้องการให้การอัปเดตล้มเหลวเพียงเพราะลบรูปเก่าไม่ได้
                        }
                    }

                    // อัปเดต item_image_url เฉพาะเมื่อการอัปโหลดรูปใหม่สำเร็จ
                    item_image_url = newImageUrl;
                } catch (uploadError) {
                    console.error("Error uploading new image:", uploadError);
                    return res.status(500).json({ message: 'Error uploading new image' });
                }
            }

            // อัปเดตข้อมูลในฐานข้อมูล
            const updateOrderSql = "UPDATE delivery_orders SET sender_id = ?, receiver_phone = ?, item_name = ?, item_description = ?, item_image = ?, updated_at = ? WHERE order_id = ?";
            const updateValues = [
                parseInt(sender_id),
                receiver_phone,
                item_name,
                item_description,
                item_image_url,
                new Date(),
                orderId
            ];

            conn.query(updateOrderSql, updateValues, (updateErr: any, updateResult: any) => {
                if (updateErr) {
                    console.error("Error updating order:", updateErr);
                    return res.status(500).json({
                        success: false,
                        message: 'Error updating order'
                    });
                }

                res.status(200).json({
                    success: true,
                    message: 'อัปเดตรายการสั่งซื้อสำเร็จ',
                });
            });
        });
    } catch (error) {
        console.error("Error in order update process:", error);
        res.status(500).json({ message: 'Internal server error' });
    }
});